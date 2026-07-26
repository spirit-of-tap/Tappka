import { createClient } from "@/lib/supabase/server";
import { RoomsWithFilter } from "@/components/reservations/rooms-with-filter";
import { ReservationsTabs } from "@/components/reservations/reservations-tabs";
import { getNextAvailableTime } from "@/lib/reservations/utils";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import type { RoomWithStatus, ReservationWithDetails } from "@/lib/reservations/types";

export const metadata = {
  title: "Rezervace | Tappka",
  description: "Rezervace místností v Tiimiakatemia Prague",
};

/**
 * Main reservations page showing all rooms and user's reservations
 */
export default async function ReservationsPage() {
  const supabase = await createClient();

  // Get current user's profile (reservations use profile.id, not auth user id)
  const profile = await getCurrentUserProfile(supabase);
  const profileId = profile?.id ?? "";

  // Fetch rooms with current reservations
  const now = new Date();
  const nowIso = now.toISOString();
  const in24hIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const [roomsResult, reservationsResult, myReservationsResult] = await Promise.all([
    // All rooms
    supabase
      .from("rooms")
      .select("*")
      .is("removed_at", null)
      .order("code"),

    // Current and upcoming reservations for today
    supabase
      .from("reservations")
      .select("*")
      .is("cancelled_at", null)
      .gte("end_at", nowIso)
      .lte("start_at", in24hIso)
      .order("start_at"),

    // User's own reservations (use profile.id, not auth user id)
    supabase
      .from("reservations")
      .select(`
        *,
        room:rooms(id, code, name)
      `)
      .eq("owner_profile_id", profileId)
      .is("cancelled_at", null)
      .gte("end_at", nowIso)
      .order("start_at")
      .limit(10),
  ]);

  // Process rooms with status
  const rooms = roomsResult.data || [];
  const reservations = reservationsResult.data || [];
  const myReservations = (myReservationsResult.data || []) as ReservationWithDetails[];

  const roomsWithStatus: RoomWithStatus[] = rooms.map((room) => {
    // Find current reservation for this room
    const roomReservations = reservations.filter((r) => r.room_id === room.id);
    const currentReservation = roomReservations.find((r) => {
      const start = new Date(r.start_at);
      const end = new Date(r.end_at);
      return now >= start && now < end;
    }) || null;

    // Calculate next available time
    const nextAvailableTime = currentReservation
      ? getNextAvailableTime(roomReservations, now)
      : null;

    return {
      ...room,
      currentReservation,
      nextAvailableTime,
    };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-heading font-bold">Rezervace místností</h2>
        <p className="text-muted-foreground mt-1">
          Vyber si místnost a zarezervuj si ji
        </p>
      </div>

      <ReservationsTabs myReservations={myReservations} />

      {/* Room List with Filter */}
      <div>
        <h3 className="text-xl font-heading font-semibold mb-4">Místnosti</h3>
        <RoomsWithFilter rooms={roomsWithStatus} />
      </div>
    </div>
  );
}
