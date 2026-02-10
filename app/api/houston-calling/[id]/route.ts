import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { addHours } from "date-fns";
import type { UpdateHoustonCallingInput } from "@/lib/reservations/types";

/**
 * GET /api/houston-calling/[id]
 * Get a single Houston Calling event with details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("houston_calling_events")
      .select(`
        *,
        reservation:reservations(*),
        team:teams(id, name, year)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Houston Calling nenalezen" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/houston-calling/[id] error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}

/**
 * PATCH /api/houston-calling/[id]
 * Update a Houston Calling event
 * Only coaches and admins can update HC events
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 });
    }

    // Check if user is coach or admin
    if (profile.role !== "coach" && profile.role !== "admin") {
      return NextResponse.json({ error: "Pouze kouči a administrátoři mohou upravovat Houston Calling" }, { status: 403 });
    }

    // Get existing HC event
    const { data: existingHC, error: fetchError } = await supabase
      .from("houston_calling_events")
      .select("*, reservation:reservations(*)")
      .eq("id", id)
      .single();

    if (fetchError || !existingHC) {
      return NextResponse.json({ error: "Houston Calling nenalezen" }, { status: 404 });
    }

    const body: UpdateHoustonCallingInput = await request.json();
    const { topic, start_time } = body;

    // Update HC event
    const hcUpdates: any = {};
    if (topic !== undefined) hcUpdates.topic = topic;
    hcUpdates.updated_at = new Date().toISOString();

    if (Object.keys(hcUpdates).length > 1) { // more than just updated_at
      const { error: updateHCError } = await supabase
        .from("houston_calling_events")
        .update(hcUpdates)
        .eq("id", id);

      if (updateHCError) {
        console.error("Error updating HC event:", updateHCError);
        return NextResponse.json({ error: "Nepodařilo se aktualizovat Houston Calling" }, { status: 500 });
      }
    }

    // Update reservation if needed
    const reservationUpdates: any = {};
    if (topic !== undefined) {
      const { data: team } = await supabase
        .from("teams")
        .select("name")
        .eq("id", existingHC.team_id)
        .single();
      reservationUpdates.title = `HC - ${team?.name} - ${topic}`;
    }
    if (start_time !== undefined) {
      const startDate = new Date(start_time);
      const endDate = addHours(startDate, 4);
      reservationUpdates.start_time = startDate.toISOString();
      reservationUpdates.end_time = endDate.toISOString();
    }

    if (Object.keys(reservationUpdates).length > 0) {
      const { error: updateReservationError } = await supabase
        .from("reservations")
        .update(reservationUpdates)
        .eq("id", existingHC.reservation_id);

      if (updateReservationError) {
        console.error("Error updating reservation:", updateReservationError);
        return NextResponse.json({ error: "Nepodařilo se aktualizovat rezervaci" }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Houston Calling aktualizován",
    });
  } catch (error) {
    console.error("PATCH /api/houston-calling/[id] error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}

/**
 * DELETE /api/houston-calling/[id]
 * Delete a Houston Calling event (also deletes reservation via CASCADE)
 * Only coaches and admins can delete HC events
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 });
    }

    // Check if user is coach or admin
    if (profile.role !== "coach" && profile.role !== "admin") {
      return NextResponse.json({ error: "Pouze kouči a administrátoři mohou mazat Houston Calling" }, { status: 403 });
    }

    // Get existing HC event
    const { data: existingHC, error: fetchError } = await supabase
      .from("houston_calling_events")
      .select("reservation_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingHC) {
      return NextResponse.json({ error: "Houston Calling nenalezen" }, { status: 404 });
    }

    // Delete the reservation (CASCADE will delete houston_calling_event)
    const { error: deleteError } = await supabase
      .from("reservations")
      .delete()
      .eq("id", existingHC.reservation_id);

    if (deleteError) {
      console.error("Error deleting reservation:", deleteError);
      return NextResponse.json({ error: "Nepodařilo se smazat Houston Calling" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Houston Calling smazán",
    });
  } catch (error) {
    console.error("DELETE /api/houston-calling/[id] error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
