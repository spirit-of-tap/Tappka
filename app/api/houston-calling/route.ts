import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { addHours } from "date-fns";
import type { CreateHoustonCallingInput } from "@/lib/reservations/types";

/**
 * POST /api/houston-calling
 * Create a new Houston Calling event
 * Only coaches and admins can create HC events
 */
export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: "Pouze kouči a administrátoři mohou vytvářet Houston Calling" }, { status: 403 });
    }

    const body: CreateHoustonCallingInput = await request.json();
    const { room_id, team_id, topic, start_time } = body;

    // Validation
    if (!room_id || !team_id || !topic || !start_time) {
      return NextResponse.json({ error: "Chybí povinné údaje" }, { status: 400 });
    }

    // Check room exists
    const { data: room } = await supabase
      .from("rooms")
      .select("id, name")
      .eq("id", room_id)
      .single();

    if (!room) {
      return NextResponse.json({ error: "Místnost neexistuje" }, { status: 404 });
    }

    // Check team exists
    const { data: team } = await supabase
      .from("teams")
      .select("id, name")
      .eq("id", team_id)
      .single();

    if (!team) {
      return NextResponse.json({ error: "Tým neexistuje" }, { status: 404 });
    }

    // Calculate end_time (start_time + 4 hours)
    const startDate = new Date(start_time);
    const endDate = addHours(startDate, 4);

    // Create reservation first
    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .insert({
        room_id,
        team_id,
        user_id: profile.id,
        reservation_type: "houston_calling",
        title: `HC - ${team.name} - ${topic}`,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        status: "active",
      })
      .select()
      .single();

    if (reservationError || !reservation) {
      console.error("Error creating reservation:", reservationError);
      return NextResponse.json({ error: "Nepodařilo se vytvořit rezervaci" }, { status: 500 });
    }

    // Create houston calling event
    const { data: hcEvent, error: hcError } = await supabase
      .from("houston_calling_events")
      .insert({
        reservation_id: reservation.id,
        team_id,
        topic,
        created_by: profile.id,
      })
      .select()
      .single();

    if (hcError || !hcEvent) {
      console.error("Error creating HC event:", hcError);
      // Rollback: delete the reservation
      await supabase.from("reservations").delete().eq("id", reservation.id);
      return NextResponse.json({ error: "Nepodařilo se vytvořit Houston Calling" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        houston_calling_event: hcEvent,
        reservation,
      },
      message: "Houston Calling vytvořen",
    });
  } catch (error) {
    console.error("POST /api/houston-calling error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}

/**
 * GET /api/houston-calling
 * List all Houston Calling events with details
 */
export async function GET(request: NextRequest) {
  try {
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
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching HC events:", error);
      return NextResponse.json({ error: "Nepodařilo se načíst Houston Calling události" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/houston-calling error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
