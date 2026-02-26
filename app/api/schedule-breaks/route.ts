import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { ScheduleBreakType } from "@/lib/reservations/types";
import { getCurrentUserProfile } from "@/lib/auth-helpers";

interface CreateBreakInput {
  break_type: ScheduleBreakType;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
}

/**
 * POST /api/schedule-breaks
 * Create a new schedule break and cancel overlapping TS reservations
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    // Get current user's profile ID
    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json(
        { error: "Uživatelský profil nenalezen" },
        { status: 403 }
      );
    }

    // Check if user is coach or admin
    if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Nedostatečná oprávnění" }, { status: 403 });
    }

    const body: CreateBreakInput = await request.json();
    const { break_type, name, start_date, end_date } = body;

    // Validation
    if (!break_type || !name || !start_date || !end_date) {
      return NextResponse.json({ error: "Chybí povinné údaje" }, { status: 400 });
    }

    const validTypes: ScheduleBreakType[] = ["days_of_joy", "holiday", "other"];
    if (!validTypes.includes(break_type)) {
      return NextResponse.json({ error: "Neplatný typ výjimky" }, { status: 400 });
    }

    // Create schedule break
    const { data: breakData, error: breakError } = await supabase
      .from("schedule_breaks")
      .insert({
        break_type,
        name: name.trim(),
        start_date,
        end_date,
        created_by: profile?.id,
      })
      .select()
      .single();

    if (breakError) {
      console.error("Error creating schedule break:", breakError);
      return NextResponse.json({ error: "Nepodařilo se vytvořit výjimku" }, { status: 500 });
    }

    // Delete existing TS reservations in this period
    // We need to find reservations where:
    // - reservation_type = 'training_session'
    // - start_time is within the break period
    const startDateTime = `${start_date}T00:00:00`;
    const endDateTime = `${end_date}T23:59:59`;

    const { data: cancelledReservations, error: cancelError } = await supabase
      .from("reservations")
      .delete()
      .eq("reservation_type", "training_session")
      .gte("start_time", startDateTime)
      .lte("start_time", endDateTime)
      .select("id");

    if (cancelError) {
      console.error("Error cancelling reservations:", cancelError);
      // Don't fail the whole operation, just log
    }

    const cancelledCount = cancelledReservations?.length || 0;

    return NextResponse.json({
      success: true,
      data: breakData,
      reservations_cancelled: cancelledCount,
      message: cancelledCount > 0
        ? `Vytvořeno. Zrušeno ${cancelledCount} TS rezervací.`
        : "Vytvořeno",
    });
  } catch (error) {
    console.error("POST /api/schedule-breaks error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}

/**
 * GET /api/schedule-breaks
 * List schedule breaks
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("schedule_breaks")
      .select("*")
      .order("start_date");

    if (error) {
      console.error("Error fetching schedule breaks:", error);
      return NextResponse.json({ error: "Nepodařilo se načíst výjimky" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/schedule-breaks error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
