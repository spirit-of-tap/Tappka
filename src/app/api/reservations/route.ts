import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse, after } from "next/server";
import {
  OPERATING_HOURS,
  type CreateReservationInput,
} from "@/lib/reservations/types";
import { ALLOWED_PAST_MS, isRoomAvailableOnDay } from "@/lib/reservations/utils";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { trackServer } from "@/lib/analytics-server";

const PRAGUE_TZ = "Europe/Prague";

function getPragueHourAndMinute(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("cs-CZ", {
    timeZone: PRAGUE_TZ,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  return { hour, minute };
}

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
    const ownerProfileId =
      searchParams.get("owner_profile_id") ?? searchParams.get("user_id");

    let query = supabase
      .from("reservations")
      .select(`
        *,
        room:rooms(id, code, name),
        user:profiles!owner_profile_id(id, name)
      `)
      .is("cancelled_at", null)
      .order("start_at");

    if (roomId) {
      query = query.eq("room_id", roomId);
    }

    if (startDate) {
      query = query.gt("end_at", startDate);
    }

    if (endDate) {
      query = query.lt("start_at", endDate);
    }

    if (ownerProfileId) {
      query = query.eq("owner_profile_id", ownerProfileId);
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

    const body = await request.json() as CreateReservationInput & {
      /** @deprecated use start_at */
      start_time?: string;
      /** @deprecated use end_at */
      end_time?: string;
    };
    const start_at = body.start_at ?? body.start_time;
    const end_at = body.end_at ?? body.end_time;
    const { room_id, title, person_count } = body;

    // Validation - title is required
    if (!room_id || !title || !person_count || !start_at || !end_at) {
      return NextResponse.json(
        { error: "Chybí povinné údaje" },
        { status: 400 }
      );
    }

    const startDate = new Date(start_at);
    const endDate = new Date(end_at);
    const now = new Date();

    // Check: end time is after start time
    if (endDate <= startDate) {
      return NextResponse.json(
        { error: "Čas konce musí být po čase začátku" },
        { status: 400 }
      );
    }

    // Check: not too far in the past (allow current 15-min slot)
    if (startDate.getTime() < now.getTime() - ALLOWED_PAST_MS) {
      return NextResponse.json(
        { error: "Nelze rezervovat v minulosti" },
        { status: 400 }
      );
    }

    // Check: within operating hours (always evaluated in Prague timezone)
    const { hour: startHour } = getPragueHourAndMinute(startDate);
    const { hour: endHour, minute: endMinutes } = getPragueHourAndMinute(endDate);

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
      .is("removed_at", null)
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
      .is("cancelled_at", null)
      .lt("start_at", end_at)
      .gt("end_at", start_at);

    if (existingRoomReservations && existingRoomReservations.length > 0) {
      return NextResponse.json(
        { error: "Místnost je v tomto čase již zarezervována" },
        { status: 409 }
      );
    }

    // Get current user's profile ID
    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json(
        { error: "Uživatelský profil nenalezen" },
        { status: 403 }
      );
    }

    // Check: user doesn't have another reservation at the same time
    const { data: existingUserReservations } = await supabase
      .from("reservations")
      .select("id, room:rooms(name)")
      .eq("owner_profile_id", profile.id)
      .is("cancelled_at", null)
      .lt("start_at", end_at)
      .gt("end_at", start_at);

    if (existingUserReservations && existingUserReservations.length > 0) {
      return NextResponse.json(
        { error: "V tomto čase už máš jinou rezervaci" },
        { status: 409 }
      );
    }

    // Create reservation
    const { data: reservation, error: insertError } = await supabase
      .from("reservations")
      .insert({
        room_id,
        owner_profile_id: profile.id,
        title: title.trim(),
        person_count,
        start_at,
        end_at,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
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

    after(() => {
      trackServer("feature_interaction", profile.id, {
        feature: "reservations",
        action: "created",
      });
    });

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
