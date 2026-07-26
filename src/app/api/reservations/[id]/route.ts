import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  OPERATING_HOURS,
  TIME_SLOT_MINUTES,
  type UpdateReservationInput,
} from "@/lib/reservations/types";
import { isRoomAvailableOnDay } from "@/lib/reservations/utils";
import { getCurrentUserProfile } from "@/lib/auth-helpers";

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

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/reservations/[id]
 * Get a single reservation
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const { data: reservation, error } = await supabase
      .from("reservations")
      .select(`
        *,
        room:rooms(id, code, name),
        user:profiles!owner_profile_id(id, name)
      `)
      .eq("id", id)
      .is("cancelled_at", null)
      .single();

    if (error || !reservation) {
      return NextResponse.json(
        { error: "Rezervace nenalezena" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: reservation });
  } catch (error) {
    console.error("GET /api/reservations/[id] error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reservations/[id]
 * Update a reservation
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Check ownership and get full reservation data
    const { data: existing } = await supabase
      .from("reservations")
      .select("*, room:rooms(*)")
      .eq("id", id)
      .is("cancelled_at", null)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Rezervace nenalezena" },
        { status: 404 }
      );
    }

    if (existing.owner_profile_id !== profile.id) {
      return NextResponse.json(
        { error: "Nemáš oprávnění upravovat tuto rezervaci" },
        { status: 403 }
      );
    }

    const body: UpdateReservationInput = await request.json();
    const allowedFields = ["title", "person_count", "start_at", "end_at"] as const;
    const updateData: Record<string, unknown> = {
      updated_by_profile_id: profile.id,
    };

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field as keyof UpdateReservationInput];
      }
    }

    // Validate times if they changed
    const hasTimeChange = "start_at" in body || "end_at" in body;
    if (hasTimeChange) {
      const start_at = (body.start_at ?? existing.start_at) as string;
      const end_at = (body.end_at ?? existing.end_at) as string;

      const startDate = new Date(start_at);
      const endDate = new Date(end_at);
      const now = new Date();

      if (endDate <= startDate) {
        return NextResponse.json(
          { error: "Čas konce musí být po čase začátku" },
          { status: 400 }
        );
      }

      // Allow current 15-min slot (same as POST)
      const ALLOWED_PAST_MS = TIME_SLOT_MINUTES * 60 * 1000;
      if (startDate.getTime() < now.getTime() - ALLOWED_PAST_MS) {
        return NextResponse.json(
          { error: "Nelze rezervovat v minulosti" },
          { status: 400 }
        );
      }

      // Check operating hours
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

      // Check room available on this day
      if (existing.room && !isRoomAvailableOnDay(existing.room as Parameters<typeof isRoomAvailableOnDay>[0], startDate)) {
        return NextResponse.json(
          { error: "Místnost není dostupná v tento den" },
          { status: 400 }
        );
      }

      // Check no overlap with other reservations for same room (exclude self)
      const { data: overlappingRoom } = await supabase
        .from("reservations")
        .select("id")
        .eq("room_id", existing.room_id)
        .is("cancelled_at", null)
        .lt("start_at", end_at)
        .gt("end_at", start_at)
        .neq("id", id);

      if (overlappingRoom && overlappingRoom.length > 0) {
        return NextResponse.json(
          { error: "Místnost je v tomto čase již zarezervována" },
          { status: 409 }
        );
      }

      // Check no overlap with user's other reservations (exclude self)
      const { data: overlappingUser } = await supabase
        .from("reservations")
        .select("id, room:rooms(name)")
        .eq("owner_profile_id", profile.id)
        .is("cancelled_at", null)
        .lt("start_at", end_at)
        .gt("end_at", start_at)
        .neq("id", id);

      if (overlappingUser && overlappingUser.length > 0) {
        return NextResponse.json(
          { error: "V tomto čase už máš jinou rezervaci" },
          { status: 409 }
        );
      }
    }

    if (Object.keys(updateData).length === 1) {
      return NextResponse.json(
        { error: "Žádné údaje k aktualizaci" },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from("reservations")
      .update(updateData)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Error updating reservation:", error);
      return NextResponse.json(
        { error: "Nepodařilo se aktualizovat rezervaci" },
        { status: 500 }
      );
    }

    if (!updated) {
      console.error("Update blocked by RLS - no rows affected", {
        reservationId: id,
        profileId: profile.id,
      });
      return NextResponse.json(
        { error: "Nepodařilo se aktualizovat rezervaci - chyba oprávnění" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Rezervace aktualizována",
    });
  } catch (error) {
    console.error("PATCH /api/reservations/[id] error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reservations/[id]
 * Soft-cancel a reservation
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    // Check ownership
    const { data: existing } = await supabase
      .from("reservations")
      .select("owner_profile_id, cancelled_at")
      .eq("id", id)
      .single();

    if (!existing || existing.cancelled_at) {
      return NextResponse.json(
        { error: "Rezervace nenalezena" },
        { status: 404 }
      );
    }

    if (existing.owner_profile_id !== profile.id) {
      return NextResponse.json(
        { error: "Nemáš oprávnění smazat tuto rezervaci" },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("reservations")
      .update({
        cancelled_at: now,
        cancelled_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
      .eq("id", id);

    if (error) {
      console.error("Error cancelling reservation:", error);
      return NextResponse.json(
        { error: "Nepodařilo se smazat rezervaci" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Rezervace smazána",
    });
  } catch (error) {
    console.error("DELETE /api/reservations/[id] error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}
