import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { addDays, format, parseISO, getDay } from "date-fns";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/recurring-schedules/[id]
 * Update a recurring schedule
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    // Check if user is coach or admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Nedostatečná oprávnění" }, { status: 403 });
    }

    const body = await request.json();
    const { room_id, team_id, day_of_week, start_time, end_time, valid_from, valid_until } = body;

    // Check if schedule exists
    const { data: existingSchedule } = await supabase
      .from("recurring_schedules")
      .select("*")
      .eq("id", id)
      .single();

    if (!existingSchedule) {
      return NextResponse.json({ error: "Rozvrh nenalezen" }, { status: 404 });
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (room_id !== undefined) updateData.room_id = room_id;
    if (team_id !== undefined) updateData.team_id = team_id;
    if (day_of_week !== undefined) updateData.day_of_week = day_of_week;
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (valid_from !== undefined) updateData.valid_from = valid_from;
    if (valid_until !== undefined) updateData.valid_until = valid_until;

    // Update the schedule
    const { data: updatedSchedule, error: updateError } = await supabase
      .from("recurring_schedules")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating recurring schedule:", updateError);
      return NextResponse.json({ error: "Nepodařilo se upravit rozvrh" }, { status: 500 });
    }

    // Cancel all future reservations linked to this schedule
    const now = new Date().toISOString();
    await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("recurring_schedule_id", id)
      .gte("start_time", now);

    // Regenerate reservations with new settings
    const finalSchedule = updatedSchedule;
    const startDate = parseISO(finalSchedule.valid_from);
    const endDate = parseISO(finalSchedule.valid_until);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentDate = startDate < today ? today : startDate;
    const reservationsToCreate = [];

    while (currentDate <= endDate) {
      if (getDay(currentDate) === finalSchedule.day_of_week) {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        const startDateTime = `${dateStr}T${finalSchedule.start_time}`;
        const endDateTime = `${dateStr}T${finalSchedule.end_time}`;

        reservationsToCreate.push({
          room_id: finalSchedule.room_id,
          team_id: finalSchedule.team_id,
          recurring_schedule_id: id,
          reservation_type: "training_session",
          title: "Training Session",
          start_time: startDateTime,
          end_time: endDateTime,
        });
      }
      currentDate = addDays(currentDate, 1);
    }

    // Insert new reservations
    if (reservationsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from("reservations")
        .insert(reservationsToCreate);

      if (insertError) {
        console.error("Error creating reservations:", insertError);
        // Don't fail the whole request, schedule was updated
      }
    }

    return NextResponse.json({
      success: true,
      schedule: finalSchedule,
      reservations_created: reservationsToCreate.length,
    });
  } catch (error) {
    console.error("PATCH /api/recurring-schedules/[id] error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}

/**
 * DELETE /api/recurring-schedules/[id]
 * Delete a recurring schedule and its associated reservations
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    // Check if user is coach or admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Nedostatečná oprávnění" }, { status: 403 });
    }

    // Check if schedule exists
    const { data: schedule } = await supabase
      .from("recurring_schedules")
      .select("id")
      .eq("id", id)
      .single();

    if (!schedule) {
      return NextResponse.json({ error: "Rozvrh nenalezen" }, { status: 404 });
    }

    // Cancel all future reservations linked to this schedule
    const now = new Date().toISOString();
    await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("recurring_schedule_id", id)
      .gte("start_time", now);

    // Delete the schedule (past reservations will remain with status)
    const { error } = await supabase
      .from("recurring_schedules")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting recurring schedule:", error);
      return NextResponse.json({ error: "Nepodařilo se smazat rozvrh" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Rozvrh smazán a budoucí rezervace zrušeny",
    });
  } catch (error) {
    console.error("DELETE /api/recurring-schedules/[id] error:", error);
    return NextResponse.json({ error: "Interní chyba serveru" }, { status: 500 });
  }
}
