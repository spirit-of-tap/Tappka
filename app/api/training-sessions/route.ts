import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { addHours } from "date-fns";
import type { CreateTrainingSessionInput } from "@/lib/reservations/types";

/**
 * POST /api/training-sessions
 * Create a new training session
 * Creates both a reservation and training_session record
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

    const body: CreateTrainingSessionInput = await request.json();
    const { room_id, team_id, topic, start_time, end_time, cross_slots_available, facilitator_ids } = body;

    // Validation
    if (!room_id || !team_id || !topic || !start_time || cross_slots_available === undefined) {
      return NextResponse.json({ error: "Chybí povinné údaje" }, { status: 400 });
    }

    // Check if user belongs to the team
    if (profile.team_id !== team_id) {
      return NextResponse.json({ error: "Nemůžeš vytvářet Training Sessions pro jiný tým" }, { status: 403 });
    }

    // Validate cross_slots_available
    if (cross_slots_available < 0 || cross_slots_available > 3) {
      return NextResponse.json({ error: "Počet cross míst musí být 0-3" }, { status: 400 });
    }

    // Check room exists
    const { data: room } = await supabase
      .from("rooms")
      .select("id, name, can_have_ts")
      .eq("id", room_id)
      .single();

    if (!room) {
      return NextResponse.json({ error: "Místnost neexistuje" }, { status: 404 });
    }

    if (room.can_have_ts === false) {
      return NextResponse.json(
        { error: "Tato místnost nepodporuje Training Sessions" },
        { status: 400 }
      );
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

    // Calculate end_time (use provided or default to start_time + 4 hours)
    const startDate = new Date(start_time);
    const endDate = end_time ? new Date(end_time) : addHours(startDate, 4);

    // Check: no overlapping active reservations for this room
    const { data: conflicts, error: conflictError } = await supabase
      .from("reservations")
      .select("id")
      .eq("room_id", room_id)
      .eq("status", "active")
      .lt("start_time", endDate.toISOString())
      .gt("end_time", startDate.toISOString());

    if (conflictError) {
      console.error("Error checking room conflicts:", conflictError);
      return NextResponse.json({ error: "Nepodařilo se ověřit dostupnost místnosti" }, { status: 500 });
    }

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        { error: "Místnost je v tomto čase již zarezervována" },
        { status: 409 }
      );
    }

    // Create reservation first
    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .insert({
        room_id,
        team_id,
        user_id: profile.id,
        reservation_type: "training_session",
        title: `TS - ${team.name} - ${topic}`,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        status: "active",
      })
      .select()
      .single();

    if (reservationError || !reservation) {
      if (reservationError?.code === "23P01") {
        return NextResponse.json(
          { error: "Místnost je v tomto čase již zarezervována" },
          { status: 409 }
        );
      }
      console.error("Error creating reservation:", reservationError);
      return NextResponse.json(
        { error: "Nepodařilo se vytvořit rezervaci" },
        { status: 500 }
      );
    }

    // Create training session
    const { data: trainingSession, error: tsError } = await supabase
      .from("training_sessions")
      .insert({
        reservation_id: reservation.id,
        team_id,
        topic,
        cross_slots_available,
        created_by: profile.id,
      })
      .select()
      .single();

    if (tsError || !trainingSession) {
      console.error("Error creating training session:", tsError);
      // Rollback: delete the reservation
      await supabase.from("reservations").delete().eq("id", reservation.id);
      return NextResponse.json({ error: "Nepodařilo se vytvořit Training Session" }, { status: 500 });
    }

    // Add facilitators if provided
    if (facilitator_ids && facilitator_ids.length > 0) {
      const facilitators = facilitator_ids.map((user_id) => ({
        training_session_id: trainingSession.id,
        user_id,
      }));

      const { error: facilitatorsError } = await supabase
        .from("training_session_facilitators")
        .insert(facilitators);

      if (facilitatorsError) {
        console.error("Error adding facilitators:", facilitatorsError);
        // Continue anyway - facilitators can be added later
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        training_session: trainingSession,
        reservation,
      },
      message: "Training Session vytvořen",
    });
  } catch (error) {
    console.error("POST /api/training-sessions error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}

/**
 * GET /api/training-sessions
 * List all training sessions with details
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("training_sessions")
      .select(`
        *,
        reservation:reservations(*),
        team:teams(id, name, year),
        facilitators:training_session_facilitators(
          id,
          user_id,
          user:profiles(id, name)
        ),
        cross_participants:training_session_cross_participants(
          id,
          user_id,
          joined_at,
          user:profiles(id, name)
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching training sessions:", error);
      return NextResponse.json({ error: "Nepodařilo se načíst Training Sessions" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/training-sessions error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
