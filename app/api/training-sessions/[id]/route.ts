import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import type { UpdateTrainingSessionInput } from "@/lib/reservations/types";

/**
 * GET /api/training-sessions/[id]
 * Get a single training session with details
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
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Training Session nenalezen" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/training-sessions/[id] error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}

/**
 * PATCH /api/training-sessions/[id]
 * Update a training session
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

    // Get existing training session
    const { data: existingTS, error: fetchError } = await supabase
      .from("training_sessions")
      .select("*, reservation:reservations(*)")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existingTS) {
      return NextResponse.json({ error: "Training Session nenalezen" }, { status: 404 });
    }

    // Check if user belongs to the team
    if (profile.team_id !== existingTS.team_id) {
      return NextResponse.json({ error: "Nemůžeš upravovat Training Sessions jiného týmu" }, { status: 403 });
    }

    const body: UpdateTrainingSessionInput = await request.json();
    const { topic, start_time, end_time, cross_slots_available, facilitator_ids } = body;

    // Update training session
    const tsUpdates: any = {};
    if (topic !== undefined) tsUpdates.topic = topic;
    if (cross_slots_available !== undefined) {
      if (cross_slots_available < 0 || cross_slots_available > 3) {
        return NextResponse.json({ error: "Počet cross míst musí být 0-3" }, { status: 400 });
      }
      tsUpdates.cross_slots_available = cross_slots_available;
    }
    tsUpdates.updated_at = new Date().toISOString();

    if (Object.keys(tsUpdates).length > 1) { // more than just updated_at
      const { error: updateTSError } = await supabase
        .from("training_sessions")
        .update(tsUpdates)
        .eq("id", id);

      if (updateTSError) {
        console.error("Error updating training session:", updateTSError);
        return NextResponse.json({ error: "Nepodařilo se aktualizovat Training Session" }, { status: 500 });
      }
    }

    // Update reservation if needed
    const reservationUpdates: any = {};
    if (topic !== undefined) {
      const { data: team } = await supabase
        .from("teams")
        .select("name")
        .eq("id", existingTS.team_id)
        .maybeSingle();
      reservationUpdates.title = `TS - ${team?.name} - ${topic}`;
    }
    if (start_time !== undefined || end_time !== undefined) {
      if (start_time !== undefined) {
        const startDate = new Date(start_time);
        reservationUpdates.start_time = startDate.toISOString();
        if (end_time !== undefined) {
          reservationUpdates.end_time = new Date(end_time).toISOString();
        } else {
          // Preserve original duration
          const originalDuration =
            new Date(existingTS.reservation.end_time).getTime() -
            new Date(existingTS.reservation.start_time).getTime();
          reservationUpdates.end_time = new Date(startDate.getTime() + originalDuration).toISOString();
        }
      } else if (end_time !== undefined) {
        reservationUpdates.end_time = new Date(end_time).toISOString();
      }

      if (start_time !== undefined && end_time !== undefined) {
        if (new Date(end_time) <= new Date(start_time)) {
          return NextResponse.json(
            { error: "Čas konce musí být po čase začátku" },
            { status: 400 }
          );
        }
      }

      // Check for room conflicts (excluding this session's own reservation)
      const newStartTime = reservationUpdates.start_time
        ?? new Date(existingTS.reservation.start_time).toISOString();
      const newEndTime = reservationUpdates.end_time
        ?? new Date(existingTS.reservation.end_time).toISOString();

      const { data: conflicts, error: conflictError } = await supabase
        .from("reservations")
        .select("id")
        .eq("room_id", existingTS.reservation.room_id)
        .eq("status", "active")
        .neq("id", existingTS.reservation_id)
        .lt("start_time", newEndTime)
        .gt("end_time", newStartTime);

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
    }

    if (Object.keys(reservationUpdates).length > 0) {
      const { error: updateReservationError } = await supabase
        .from("reservations")
        .update(reservationUpdates)
        .eq("id", existingTS.reservation_id);

      if (updateReservationError) {
        if (updateReservationError?.code === "23P01") {
          return NextResponse.json(
            { error: "Místnost je v tomto čase již zarezervována" },
            { status: 409 }
          );
        }
        console.error("Error updating reservation:", updateReservationError);
        return NextResponse.json({ error: "Nepodařilo se aktualizovat rezervaci" }, { status: 500 });
      }
    }

    // Update facilitators if provided
    if (facilitator_ids !== undefined) {
      // Delete existing facilitators
      await supabase
        .from("training_session_facilitators")
        .delete()
        .eq("training_session_id", id);

      // Add new facilitators
      if (facilitator_ids.length > 0) {
        const facilitators = facilitator_ids.map((user_id) => ({
          training_session_id: id,
          user_id,
        }));

        const { error: facilitatorsError } = await supabase
          .from("training_session_facilitators")
          .insert(facilitators);

        if (facilitatorsError) {
          console.error("Error updating facilitators:", facilitatorsError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Training Session aktualizován",
    });
  } catch (error) {
    console.error("PATCH /api/training-sessions/[id] error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}

/**
 * DELETE /api/training-sessions/[id]
 * Delete a training session (also deletes reservation via CASCADE)
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

    // Get existing training session
    const { data: existingTS, error: fetchError } = await supabase
      .from("training_sessions")
      .select("team_id, reservation_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existingTS) {
      return NextResponse.json({ error: "Training Session nenalezen" }, { status: 404 });
    }

    // Check if user belongs to the team
    if (profile.team_id !== existingTS.team_id) {
      return NextResponse.json({ error: "Nemůžeš mazat Training Sessions jiného týmu" }, { status: 403 });
    }

    // Delete the reservation (CASCADE will delete training_session and related records)
    const { error: deleteError } = await supabase
      .from("reservations")
      .delete()
      .eq("id", existingTS.reservation_id);

    if (deleteError) {
      console.error("Error deleting reservation:", deleteError);
      return NextResponse.json({ error: "Nepodařilo se smazat Training Session" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Training Session smazán",
    });
  } catch (error) {
    console.error("DELETE /api/training-sessions/[id] error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
