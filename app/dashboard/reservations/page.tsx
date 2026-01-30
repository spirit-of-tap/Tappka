import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RoomsWithFilter } from "@/components/reservations/rooms-with-filter";
import { ReservationsTabs } from "@/components/reservations/reservations-tabs";
import { getNextAvailableTime } from "@/lib/reservations/utils";
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
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/");
  }

  // Check if verified
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_verified")
    .eq("id", user.id)
    .single();

  if (!profile?.is_verified) {
    redirect("/verify");
  }

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
      .eq("status", "active")
      .gte("end_time", now)
      .lte("start_time", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      .order("start_time"),
    
    // Open issues
    supabase
      .from("room_issues")
      .select("room_id, issue_type")
      .eq("status", "open"),
    
    // User's own reservations
    supabase
      .from("reservations")
      .select(`
        *,
        room:rooms(id, code, name)
      `)
      .eq("user_id", user.id)
      .eq("status", "active")
      .gte("end_time", now)
      .order("start_time")
      .limit(10),
    
    // Get reservation IDs user has joined
    supabase
      .from("cowork_participants")
      .select("reservation_id")
      .eq("user_id", user.id),
    
    // Available coworks (open for cowork, active, upcoming - include all, we'll filter later)
    supabase
      .from("reservations")
      .select(`
        *,
        room:rooms(id, code, name),
        user:profiles!reservations_user_id_fkey(id, full_name),
        team:teams(id, name),
        cowork_participants(
          id,
          user_id,
          joined_at,
          user:profiles(id, full_name)
        )
      `)
      .eq("is_cowork_open", true)
      .eq("status", "active")
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
    !joinedReservationIds.has(c.id) && c.user_id !== user.id // Exclude joined and own reservations
  );
  
  console.log("User ID:", user.id);
  console.log("Joined reservation IDs:", Array.from(joinedReservationIds));
  console.log("All coworks count:", allCoworks.length);
  console.log("Joined coworks:", joinedCoworks.map(c => ({ id: c.id, title: c.title })));
  console.log("Available coworks:", availableCoworks.map(c => ({ id: c.id, title: c.title })));

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
