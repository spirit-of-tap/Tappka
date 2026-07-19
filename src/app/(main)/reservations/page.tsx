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

  // Fetch rooms with current reservations and issues
  const now = new Date().toISOString();

  const [roomsResult, reservationsResult, issuesResult, myReservationsResult, joinedIdsResult, coworksResult] = await Promise.all([
    // All rooms
    supabase
      .from("rooms")
      .select("*")
      .order("code"),

    // Current and upcoming reservations for today
    supabase
      .from("reservations")
      .select("*")
      .gte("end_time", now)
      .lte("start_time", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      .order("start_time"),

    // Open issues
    supabase
      .from("room_issues")
      .select("room_id, issue_type")
      .eq("status", "open"),

    // User's own reservations (use profile.id, not auth user id)
    supabase
      .from("reservations")
      .select(`
        *,
        room:rooms(id, code, name)
      `)
      .eq("user_id", profileId)
      .gte("end_time", now)
      .order("start_time")
      .limit(10),

    // Get reservation IDs user has joined (use profile.id)
    supabase
      .from("cowork_participants")
      .select("reservation_id")
      .eq("user_id", profileId),

    // Available coworks (open for cowork, active, upcoming - include all, we'll filter later)
    supabase
      .from("reservations")
      .select(`
        *,
        room:rooms(id, code, name),
        user:profiles!reservations_user_id_fkey(id, name),
        team:teams(id, name),
        cowork_participants(
          id,
          user_id,
          joined_at,
          user:profiles(id, name)
        )
      `)
      .eq("is_cowork_open", true)
      .gte("end_time", now)
      .order("start_time")
      .limit(50), // Increased limit to catch both joined and available
  ]);

  // Process rooms with status
  const rooms = roomsResult.data || [];
  const reservations = reservationsResult.data || [];
  const issues = issuesResult.data || [];
  const myReservations = (myReservationsResult.data || []) as ReservationWithDetails[];

  // Get IDs of reservations user has joined
  const joinedReservationIds = new Set(
    (joinedIdsResult.data || []).map((jp: any) => jp.reservation_id)
  );

  // Split all coworks into joined and available
  const allCoworks = (coworksResult.data || []) as ReservationWithDetails[];
  const joinedCoworks = allCoworks.filter(c => joinedReservationIds.has(c.id));
  const availableCoworks = allCoworks.filter(c =>
    !joinedReservationIds.has(c.id) && c.user_id !== profileId // Exclude joined and own reservations
  );

  const roomsWithStatus: RoomWithStatus[] = rooms.map((room) => {
    // Find current reservation for this room
    const roomReservations = reservations.filter((r) => r.room_id === room.id);
    const currentTime = new Date();
    const currentReservation = roomReservations.find((r) => {
      const start = new Date(r.start_time);
      const end = new Date(r.end_time);
      return currentTime >= start && currentTime < end;
    }) || null;

    // Find open issues
    const roomIssue = issues.find((i) => i.room_id === room.id);

    // Calculate next available time
    const nextAvailableTime = currentReservation
      ? getNextAvailableTime(roomReservations, currentTime)
      : null;

    return {
      ...room,
      currentReservation,
      nextAvailableTime,
      hasOpenIssue: !!roomIssue,
      issueType: roomIssue?.issue_type || null,
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

      {/* Desktop: Side-by-side, Mobile: See ReservationsTabs component */}
      <ReservationsTabs
        myReservations={myReservations}
        joinedCoworks={joinedCoworks}
        availableCoworks={availableCoworks}
      />

      {/* Room List with Filter */}
      <div>
        <h3 className="text-xl font-heading font-semibold mb-4">Místnosti</h3>
        <RoomsWithFilter rooms={roomsWithStatus} />
      </div>
    </div>
  );
}
