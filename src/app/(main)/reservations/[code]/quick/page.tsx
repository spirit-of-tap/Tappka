import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { RoomQuickStatus } from "@/components/reservations/room-quick-status";
import type { Room } from "@/lib/reservations/types";
import { getCurrentUserProfile } from "@/lib/auth-helpers";

interface QuickPageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: QuickPageProps) {
  const { code } = await params;
  return {
    title: `${code.toUpperCase()} | Quick Status | Tappka`,
  };
}

/**
 * Sort alternative rooms based on current room type
 */
function sortAlternativeRooms(rooms: Room[], currentRoom: Room): Room[] {
  const tsRoomCodes = ["d126", "d132", "d226"];
  const quietRepreCodes = ["d127", "d129"];
  const d107Code = "d107";

  const getPriority = (roomCode: string): number => {
    if (tsRoomCodes.includes(currentRoom.code)) {
      if (tsRoomCodes.includes(roomCode)) return 1;
      if (quietRepreCodes.includes(roomCode)) return 2;
      if (roomCode === d107Code) return 3;
      return 4;
    } else if (quietRepreCodes.includes(currentRoom.code)) {
      if (quietRepreCodes.includes(roomCode)) return 1;
      if (tsRoomCodes.includes(roomCode)) return 2;
      if (roomCode === d107Code) return 3;
      return 4;
    } else if (currentRoom.code === d107Code) {
      if (tsRoomCodes.includes(roomCode)) return 1;
      if (quietRepreCodes.includes(roomCode)) return 2;
      return 3;
    }
    return 99;
  };

  return [...rooms].sort((a, b) => getPriority(a.code) - getPriority(b.code));
}

/**
 * Quick status page for room scans
 * Shows instant room availability status with fullscreen colored design
 */
export default async function QuickStatusPage({ params }: QuickPageProps) {
  const { code } = await params;
  const supabase = await createClient();

  // Fetch room by code
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code.toLowerCase())
    .is("removed_at", null)
    .single();

  if (roomError || !room) {
    notFound();
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const twoHoursAhead = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getCurrentUserProfile(supabase, { user }) : null;
  const currentProfileId = profile?.id ?? null;

  // Fire independent queries in parallel
  const [
    { data: currentReservation },
    { data: nextReservation },
  ] = await Promise.all([
    // Current in-progress reservation
    supabase
      .from("reservations")
      .select(`*, user:profiles!owner_profile_id(id, name)`)
      .eq("room_id", room.id)
      .is("cancelled_at", null)
      .lte("start_at", nowIso)
      .gt("end_at", nowIso)
      .maybeSingle(),

    // Next upcoming reservation within 2 hours
    supabase
      .from("reservations")
      .select(`*, user:profiles!owner_profile_id(id, name)`)
      .eq("room_id", room.id)
      .is("cancelled_at", null)
      .gt("start_at", nowIso)
      .lte("start_at", twoHoursAhead)
      .order("start_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  // Determine status
  let status: 'free' | 'occupied' = currentReservation ? 'occupied' : 'free';

  // Compute milliseconds until next upcoming reservation for the occupancy check
  // (use raw ms to avoid rounding 14m31s → 15 which would skip the override)
  const msUntilNextReservation = nextReservation
    ? new Date(nextReservation.start_at).getTime() - now.getTime()
    : null;

  // Integer minutes used for display
  const minutesUntilNextReservation = msUntilNextReservation !== null
    ? Math.round(msUntilNextReservation / 60000)
    : null;

  // If next reservation starts in < 15 min, treat room as occupied so user
  // doesn't attempt to book a slot that will immediately fail at the API.
  if (status === 'free' && msUntilNextReservation !== null && msUntilNextReservation < 15 * 60 * 1000) {
    status = 'occupied';
  }

  // Build response data
  const quickStatusData = {
    room: {
      id: room.id,
      code: room.code,
      name: room.name,
      description: room.description,
    },
    status,
  };

  // Add current reservation details if occupied
  let currentReservationData = undefined;
  let alternativeRooms = undefined;

  // Show reservation details when there's an in-progress reservation
  if (currentReservation) {
    const endTime = new Date(currentReservation.end_at);
    const endsInMinutes = Math.round((endTime.getTime() - now.getTime()) / (1000 * 60));

    const occupantName = currentReservation.user?.name ??
      currentReservation.title ??
      "Neznámá osoba";

    currentReservationData = {
      title: currentReservation.title,
      occupantName,
      personCount: currentReservation.person_count,
      startTime: currentReservation.start_at,
      endTime: currentReservation.end_at,
      endsInMinutes,
      isMyReservation: currentReservation.owner_profile_id === currentProfileId,
    };
  } else if (nextReservation && minutesUntilNextReservation !== null && minutesUntilNextReservation < 15) {
    // Near-future reservation triggered the occupied override — show its details
    const endTime = new Date(nextReservation.end_at);
    const endsInMinutes = Math.round((endTime.getTime() - now.getTime()) / (1000 * 60));

    const occupantName = nextReservation.user?.name ??
      nextReservation.title ??
      "Neznámá osoba";

    currentReservationData = {
      title: nextReservation.title,
      occupantName,
      personCount: nextReservation.person_count,
      startTime: nextReservation.start_at,
      endTime: nextReservation.end_at,
      endsInMinutes,
      startsInMinutes: minutesUntilNextReservation,
      isMyReservation: nextReservation.owner_profile_id === currentProfileId,
    };
  }

  // When status is occupied (in-progress OR near-future reservation), show alternative rooms
  if (status === 'occupied') {
    // Fetch all other rooms and their current reservations in parallel
    const [{ data: allRooms }, { data: otherCurrentReservations }] = await Promise.all([
      supabase
        .from("rooms")
        .select("*")
        .neq("id", room.id)
        .is("removed_at", null)
        .order("code"),

      supabase
        .from("reservations")
        .select("room_id")
        .is("cancelled_at", null)
        .lte("start_at", nowIso)
        .gt("end_at", nowIso),
    ]);

    if (allRooms && allRooms.length > 0) {
      const occupiedRoomIds = new Set(
        (otherCurrentReservations || []).map((r) => r.room_id)
      );

      const freeRooms = allRooms.filter((r) => !occupiedRoomIds.has(r.id));

      // Sort by relevance and take top 3
      const sortedFreeRooms = sortAlternativeRooms(freeRooms, room);
      alternativeRooms = sortedFreeRooms.slice(0, 3).map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
      }));
    }
  }

  return (
    <RoomQuickStatus
      {...quickStatusData}
      currentReservation={currentReservationData}
      alternativeRooms={alternativeRooms}
      minutesUntilNextReservation={minutesUntilNextReservation}
    />
  );
}
