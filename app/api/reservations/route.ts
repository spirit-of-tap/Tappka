import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { 
  OPERATING_HOURS, 
  MAX_ADVANCE_BOOKING_DAYS,
  type CreateReservationInput,
} from "@/lib/reservations/types";
import { isRoomAvailableOnDay } from "@/lib/reservations/utils";

/**
 * GET /api/reservations
 * Fetch reservations with optional filters
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
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const userId = searchParams.get("user_id");

    let query = supabase
      .from("reservations")
      .select(`
        *,
        room:rooms(id, code, name),
        user:profiles(id, full_name),
        team:teams(id, name)
      `)
      .eq("status", "active")
      .order("start_time");

    if (roomId) {
      query = query.eq("room_id", roomId);
    }

    if (startDate) {
      query = query.gte("end_time", startDate);
    }

    if (endDate) {
      query = query.lte("start_time", endDate);
    }

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching reservations:", error);
      return NextResponse.json(
        { error: "Nepodařilo se načíst rezervace" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/reservations error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reservations
 * Create a new reservation
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const body: CreateReservationInput = await request.json();
    const { room_id, title, person_count, start_time, end_time, is_cowork_open } = body;

    // Validation - title is the reason (simplified)
    if (!room_id || !title || !person_count || !start_time || !end_time) {
      return NextResponse.json(
        { error: "Chybí povinné údaje" },
        { status: 400 }
      );
    }

    const startDate = new Date(start_time);
    const endDate = new Date(end_time);
    const now = new Date();

    // Check: end time is after start time
    if (endDate <= startDate) {
      return NextResponse.json(
        { error: "Čas konce musí být po čase začátku" },
        { status: 400 }
      );
    }

    // Check: not in the past
    if (startDate < now) {
      return NextResponse.json(
        { error: "Nelze rezervovat v minulosti" },
        { status: 400 }
      );
    }

    // Check: within booking window (2 weeks)
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + MAX_ADVANCE_BOOKING_DAYS);
    if (startDate > maxDate) {
      return NextResponse.json(
        { error: `Lze rezervovat maximálně ${MAX_ADVANCE_BOOKING_DAYS} dní dopředu` },
        { status: 400 }
      );
    }

    // Check: within operating hours
    const startHour = startDate.getHours();
    const endHour = endDate.getHours();
    const endMinutes = endDate.getMinutes();

    if (startHour < OPERATING_HOURS.start || startHour >= OPERATING_HOURS.end) {
      return NextResponse.json(
        { error: `Provozní hodiny jsou ${OPERATING_HOURS.start}:00 - ${OPERATING_HOURS.end}:00` },
        { status: 400 }
      );
    }

    if (endHour > OPERATING_HOURS.end || (endHour === OPERATING_HOURS.end && endMinutes > 0)) {
      return NextResponse.json(
        { error: `Provozní hodiny jsou ${OPERATING_HOURS.start}:00 - ${OPERATING_HOURS.end}:00` },
        { status: 400 }
      );
    }

    // Fetch room to check availability rules
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", room_id)
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: "Místnost neexistuje" },
        { status: 404 }
      );
    }

    // Check: room available on this day
    if (!isRoomAvailableOnDay(room, startDate)) {
      return NextResponse.json(
        { error: "Místnost není dostupná v tento den" },
        { status: 400 }
      );
    }

    // Check: no overlapping reservations for this room
    const { data: existingRoomReservations } = await supabase
      .from("reservations")
      .select("id")
      .eq("room_id", room_id)
      .eq("status", "active")
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    if (existingRoomReservations && existingRoomReservations.length > 0) {
      return NextResponse.json(
        { error: "Místnost je v tomto čase již zarezervována" },
        { status: 409 }
      );
    }

    // Check: user doesn't have another reservation at the same time
    const { data: existingUserReservations } = await supabase
      .from("reservations")
      .select("id, room:rooms(name)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .lt("start_time", end_time)
      .gt("end_time", start_time);

    if (existingUserReservations && existingUserReservations.length > 0) {
      return NextResponse.json(
        { error: "V tomto čase už máš jinou rezervaci" },
        { status: 409 }
      );
    }

    // Create reservation (title serves as reason - simplified)
    const { data: reservation, error: insertError } = await supabase
      .from("reservations")
      .insert({
        room_id,
        user_id: user.id,
        reservation_type: "personal",
        title: title.trim(),
        person_count,
        start_time,
        end_time,
        is_cowork_open: is_cowork_open || false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating reservation:", insertError);
      
      // Handle unique constraint violation (overlap)
      if (insertError.code === "23P01") {
        return NextResponse.json(
          { error: "Místnost je v tomto čase již zarezervována" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Nepodařilo se vytvořit rezervaci" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: reservation,
      message: "Rezervace vytvořena" 
    });
  } catch (error) {
    console.error("POST /api/reservations error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}
