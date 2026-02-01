import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { addDays, format, getDay, setHours, setMinutes } from "date-fns";
import { getCurrentUserProfile } from "@/lib/auth-helpers";

interface CreateScheduleInput {
  room_id: string;
  team_id: string;
  day_of_week: number;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  valid_from: string; // YYYY-MM-DD
  valid_until: string; // YYYY-MM-DD
}

/**
 * POST /api/recurring-schedules
 * Create a new recurring schedule and generate reservations
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    // Get current user's profile ID
    const profile = await getCurrentUserProfile(supabase);
    if (!profile) {
      return NextResponse.json(
        { error: "Uživatelský profil nenalezen" },
        { status: 403 }
      );
    }

    if (!profile || (profile?.role !== "coach" && profile?.role !== "admin")) {
      return NextResponse.json({ error: "Nedostatečná oprávnění" }, { status: 403 });
    }

    const body: CreateScheduleInput = await request.json();
    const { room_id, team_id, day_of_week, start_time, end_time, valid_from, valid_until } = body;

    // Validation
    if (!room_id || !team_id || day_of_week === undefined || !start_time || !end_time || !valid_from || !valid_until) {
      return NextResponse.json({ error: "Chybí povinné údaje" }, { status: 400 });
    }

    if (day_of_week < 0 || day_of_week > 6) {
      return NextResponse.json({ error: "Neplatný den v týdnu" }, { status: 400 });
    }

    // Check room exists and can have TS
    const { data: room } = await supabase
      .from("rooms")
      .select("id, can_have_ts")
      .eq("id", room_id)
      .single();

    if (!room) {
      return NextResponse.json({ error: "Místnost neexistuje" }, { status: 404 });
    }

    if (!room.can_have_ts) {
      return NextResponse.json({ error: "Tato místnost nemůže mít Training Sessions" }, { status: 400 });
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

    // Create recurring schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from("recurring_schedules")
      .insert({
        room_id,
        team_id,
        created_by: profile?.id,
        day_of_week,
        start_time,
        end_time,
        valid_from,
        valid_until,
      })
      .select()
      .single();

    if (scheduleError) {
      console.error("Error creating recurring schedule:", scheduleError);
      return NextResponse.json({ error: "Nepodařilo se vytvořit rozvrh" }, { status: 500 });
    }

    // Fetch schedule breaks to skip
    const { data: breaks } = await supabase
      .from("schedule_breaks")
      .select("start_date, end_date")
      .gte("end_date", valid_from)
      .lte("start_date", valid_until);

    const breakRanges = (breaks || []).map((b) => ({
      start: new Date(b.start_date),
      end: new Date(b.end_date),
    }));

    // Generate individual reservations
    const [startHour, startMin] = start_time.split(":").map(Number);
    const [endHour, endMin] = end_time.split(":").map(Number);
    const startDate = new Date(valid_from);
    const endDate = new Date(valid_until);

    // Find first occurrence of the day
    let currentDate = new Date(startDate);
    while (getDay(currentDate) !== day_of_week) {
      currentDate = addDays(currentDate, 1);
    }

    const reservations: {
      room_id: string;
      team_id: string;
      recurring_schedule_id: string;
      reservation_type: "training_session";
      title: string;
      start_time: string;
      end_time: string;
    }[] = [];

    while (currentDate <= endDate) {
      // Check if this date falls within a break
      const isInBreak = breakRanges.some(
        (range) => currentDate >= range.start && currentDate <= range.end
      );

      if (!isInBreak) {
        const reservationStart = setMinutes(setHours(new Date(currentDate), startHour), startMin);
        const reservationEnd = setMinutes(setHours(new Date(currentDate), endHour), endMin);

        reservations.push({
          room_id,
          team_id,
          recurring_schedule_id: schedule.id,
          reservation_type: "training_session",
          title: `TS - ${team.name}`,
          start_time: reservationStart.toISOString(),
          end_time: reservationEnd.toISOString(),
        });
      }

      currentDate = addDays(currentDate, 7);
    }

    // Insert reservations
    if (reservations.length > 0) {
      const { error: reservationsError } = await supabase
        .from("reservations")
        .insert(reservations);

      if (reservationsError) {
        console.error("Error creating reservations:", reservationsError);
        // Rollback: delete the schedule
        await supabase.from("recurring_schedules").delete().eq("id", schedule.id);
        return NextResponse.json({ error: "Nepodařilo se vygenerovat rezervace" }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      data: schedule,
      reservations_created: reservations.length,
      message: `Vytvořeno ${reservations.length} rezervací`,
    });
  } catch (error) {
    console.error("POST /api/recurring-schedules error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}

/**
 * GET /api/recurring-schedules
 * List recurring schedules
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("recurring_schedules")
      .select(`
        *,
        room:rooms(id, code, name),
        team:teams(id, name)
      `)
      .order("day_of_week");

    if (error) {
      console.error("Error fetching recurring schedules:", error);
      return NextResponse.json({ error: "Nepodařilo se načíst rozvrhy" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/recurring-schedules error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
