import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { OPERATING_HOURS, TIME_SLOT_MINUTES } from "@/lib/reservations/types";
import { inferReservationKind } from "@/lib/reservations/utils";

/**
 * GET /api/reservations/availability
 * Check available time slots for a room on a specific date
 * 
 * Query params:
 * - room_id: UUID of the room
 * - date: ISO date string (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("room_id");
    const dateStr = searchParams.get("date");

    if (!roomId) {
      return NextResponse.json({ error: "Chybí room_id" }, { status: 400 });
    }

    if (!dateStr) {
      return NextResponse.json({ error: "Chybí date" }, { status: 400 });
    }

    // Parse date
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Neplatné datum" }, { status: 400 });
    }

    // Check room exists and get availability rules
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, code, name, available_days")
      .eq("id", roomId)
      .is("removed_at", null)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "Místnost nenalezena" }, { status: 404 });
    }

    // Check if room is available on this day
    const dayOfWeek = date.getDay();
    if (room.available_days && room.available_days.length > 0) {
      if (!room.available_days.includes(dayOfWeek)) {
        return NextResponse.json({
          data: {
            room,
            date: dateStr,
            available: false,
            reason: "Místnost není dostupná v tento den",
            slots: [],
          },
        });
      }
    }

    // Build date range for the day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch reservations for this room on this date
    const { data: reservations, error: resError } = await supabase
      .from("reservations")
      .select("id, start_at, end_at, title, owner_profile_id")
      .eq("room_id", roomId)
      .is("cancelled_at", null)
      .gte("start_at", startOfDay.toISOString())
      .lte("start_at", endOfDay.toISOString())
      .order("start_at");

    if (resError) {
      console.error("Error fetching reservations:", resError);
      return NextResponse.json(
        { error: "Nepodařilo se načíst rezervace" },
        { status: 500 }
      );
    }

    // Generate all time slots
    const slots: {
      start: string;
      end: string;
      available: boolean;
      reservation?: {
        id: string;
        title: string;
        type: string;
      };
    }[] = [];

    const slotDate = new Date(date);
    slotDate.setHours(OPERATING_HOURS.start, 0, 0, 0);

    while (slotDate.getHours() < OPERATING_HOURS.end) {
      const slotStart = new Date(slotDate);
      const slotEnd = new Date(slotDate);
      slotEnd.setMinutes(slotEnd.getMinutes() + TIME_SLOT_MINUTES);

      // Check if this slot overlaps with any reservation
      const overlapping = reservations?.find((r) => {
        const resStart = new Date(r.start_at);
        const resEnd = new Date(r.end_at);
        return slotStart < resEnd && slotEnd > resStart;
      });

      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        available: !overlapping,
        reservation: overlapping
          ? {
              id: overlapping.id,
              title: overlapping.title,
              type: inferReservationKind(overlapping),
            }
          : undefined,
      });

      slotDate.setMinutes(slotDate.getMinutes() + TIME_SLOT_MINUTES);
    }

    // Calculate availability stats
    const availableSlots = slots.filter((s) => s.available).length;
    const totalSlots = slots.length;

    return NextResponse.json({
      data: {
        room,
        date: dateStr,
        available: availableSlots > 0,
        availableSlots,
        totalSlots,
        slots,
      },
    });
  } catch (error) {
    console.error("GET /api/reservations/availability error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}
