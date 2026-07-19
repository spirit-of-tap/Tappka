import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { addDays, format, getDay } from "date-fns";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { HOUSTON_CALLING_TITLE } from "@/lib/reservations/types";
import { pragueLocalToUtcISO, trainingSessionTitle } from "@/lib/reservations/utils";
import type { Insertable } from "@/lib/supabase/tables";

interface CreateScheduleInput {
  room_id: string;
  team_id: string;
  day_of_week: number;
  start_time: string; // HH:MM (time-of-day on recurring_schedules)
  end_time: string;   // HH:MM
  valid_from: string; // YYYY-MM-DD
  valid_until: string; // YYYY-MM-DD
  schedule_type?: "training_session" | "houston_calling";
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
    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json(
        { error: "Uživatelský profil nenalezen" },
        { status: 403 }
      );
    }

    if (profile.role !== "coach" && profile.role !== "admin") {
      return NextResponse.json({ error: "Nedostatečná oprávnění" }, { status: 403 });
    }

    const body: CreateScheduleInput = await request.json();
    const {
      room_id,
      team_id,
      day_of_week,
      start_time,
      end_time,
      valid_from,
      valid_until,
    } = body;
    const schedule_type = body.schedule_type ?? "training_session";

    // Validation
    if (!room_id || day_of_week === undefined || !start_time || !end_time || !valid_from || !valid_until) {
      return NextResponse.json({ error: "Chybí povinné údaje" }, { status: 400 });
    }

    if (schedule_type === "training_session" && !team_id) {
      return NextResponse.json({ error: "Training Session vyžaduje tým" }, { status: 400 });
    }

    if (day_of_week < 0 || day_of_week > 6) {
      return NextResponse.json({ error: "Neplatný den v týdnu" }, { status: 400 });
    }

    // Check room exists and can have TS
    const { data: room } = await supabase
      .from("rooms")
      .select("id, can_have_ts")
      .eq("id", room_id)
      .is("removed_at", null)
      .single();

    if (!room) {
      return NextResponse.json({ error: "Místnost neexistuje" }, { status: 404 });
    }

    if (schedule_type === "training_session" && !room.can_have_ts) {
      return NextResponse.json({ error: "Tato místnost nemůže mít Training Sessions" }, { status: 400 });
    }

    let teamName = TRAINING_FALLBACK_NAME;
    if (team_id) {
      const { data: team } = await supabase
        .from("teams")
        .select("id, name")
        .eq("id", team_id)
        .single();

      if (!team) {
        return NextResponse.json({ error: "Tým neexistuje" }, { status: 404 });
      }
      teamName = team.name;
    }

    // Create recurring schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from("recurring_schedules")
      .insert({
        room_id,
        team_id: schedule_type === "training_session" ? team_id : null,
        schedule_type,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
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
    const startDate = new Date(valid_from);
    const endDate = new Date(valid_until);

    // Find first occurrence of the day
    let currentDate = new Date(startDate);
    while (getDay(currentDate) !== day_of_week) {
      currentDate = addDays(currentDate, 1);
    }

    const reservationTitle =
      schedule_type === "houston_calling"
        ? HOUSTON_CALLING_TITLE
        : trainingSessionTitle(teamName);

    const reservations: Insertable<"reservations">[] = [];

    while (currentDate <= endDate) {
      // Check if this date falls within a break
      const isInBreak = breakRanges.some(
        (range) => currentDate >= range.start && currentDate <= range.end
      );

      if (!isInBreak) {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        const reservationStart = pragueLocalToUtcISO(dateStr, start_time);
        const reservationEnd = pragueLocalToUtcISO(dateStr, end_time);

        reservations.push({
          room_id,
          owner_profile_id: null,
          title: reservationTitle,
          start_at: reservationStart,
          end_at: reservationEnd,
          created_by_profile_id: profile.id,
          updated_by_profile_id: profile.id,
        });
      }

      currentDate = addDays(currentDate, 7);
    }

    // Insert reservations (admin client: owner_profile_id is null for system rows)
    if (reservations.length > 0) {
      const adminClient = createAdminClient();
      const { error: reservationsError } = await adminClient
        .from("reservations")
        .insert(reservations);

      if (reservationsError) {
        console.error("Error creating reservations:", reservationsError);
        // Rollback: soft-remove the schedule
        await supabase
          .from("recurring_schedules")
          .update({
            removed_at: new Date().toISOString(),
            updated_by_profile_id: profile.id,
          })
          .eq("id", schedule.id);
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

const TRAINING_FALLBACK_NAME = "Tým";

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
      .is("removed_at", null)
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
