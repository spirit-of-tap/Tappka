import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Calendar, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageBack } from "@/components/ui/page-back";
import { RoomScheduleView } from "@/components/reservations/room-schedule-view";
import { AlternativeRooms } from "@/components/reservations/alternative-rooms";
import { DAY_NAMES_CS } from "@/lib/reservations/types";
import type { Room, ReservationWithDetails, ScheduleBreak } from "@/lib/reservations/types";
import { getCurrentUserProfile } from "@/lib/auth-helpers";

interface RoomDetailPageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ date?: string }>;
}

export async function generateMetadata({ params }: RoomDetailPageProps) {
  const { code } = await params;
  return {
    title: `${code.toUpperCase()} | Rezervace`,
  };
}

/**
 * Room detail page with calendar and reservation form
 */
export default async function RoomDetailPage({ params, searchParams }: RoomDetailPageProps) {
  const { code } = await params;
  const { date: dateParam } = await searchParams;
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  // Fetch the user's profile to get the profile ID (used for ownership checks)
  const currentUserProfile = user ? await getCurrentUserProfile(supabase, { user }) : null;

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

  // Fetch data in parallel
  // Include past 7 days and future reservations for navigation
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const oneWeekAgoStr = oneWeekAgo.toISOString().split("T")[0];

  const [reservationsResult, alternativeRoomsResult, breaksResult] = await Promise.all([
    // Reservations for this room (past 7 days + future for calendar navigation)
    supabase
      .from("reservations")
      .select(`
        *,
        user:profiles!owner_profile_id(id, name, picture)
      `)
      .eq("room_id", room.id)
      .is("cancelled_at", null)
      .gte("start_at", oneWeekAgo.toISOString())
      .order("start_at"),

    // Alternative rooms for suggestions
    supabase
      .from("rooms")
      .select("*")
      .neq("id", room.id)
      .is("removed_at", null)
      .order("code"),

    // Schedule breaks for the date range (past 7 + future)
    supabase
      .from("schedule_breaks")
      .select("*")
      .gte("end_date", oneWeekAgoStr)
      .order("start_date"),
  ]);

  const reservations = (reservationsResult.data ?? []) as ReservationWithDetails[];
  const allAlternativeRooms = (alternativeRoomsResult.data || []) as Room[];
  const scheduleBreaks = (breaksResult.data || []) as ScheduleBreak[];

  // Sort alternative rooms based on current room type
  const sortAlternativeRooms = (rooms: Room[], currentRoom: Room): Room[] => {
    const tsRoomCodes = ["d126", "d132", "d226"];
    const quietRepreCodes = ["d127", "d129"];
    const d107Code = "d107";

    // Define priority order based on current room
    const getPriority = (roomCode: string): number => {
      if (tsRoomCodes.includes(currentRoom.code)) {
        // Current is TS room: prioritize other TS rooms, then quiet/repre, then D107
        if (tsRoomCodes.includes(roomCode)) return 1;
        if (quietRepreCodes.includes(roomCode)) return 2;
        if (roomCode === d107Code) return 3;
        return 4;
      } else if (quietRepreCodes.includes(currentRoom.code)) {
        // Current is Quiet or Repre: prioritize the other one, then TS, then D107
        if (quietRepreCodes.includes(roomCode)) return 1;
        if (tsRoomCodes.includes(roomCode)) return 2;
        if (roomCode === d107Code) return 3;
        return 4;
      } else if (currentRoom.code === d107Code) {
        // Current is D107: prioritize TS rooms, then quiet/repre
        if (tsRoomCodes.includes(roomCode)) return 1;
        if (quietRepreCodes.includes(roomCode)) return 2;
        return 3;
      }
      // Default order
      return 99;
    };

    return [...rooms].sort((a, b) => getPriority(a.code) - getPriority(b.code));
  };

  const alternativeRooms = sortAlternativeRooms(allAlternativeRooms, room);

  // Available days info
  const availableDaysText = room.available_days
    ? room.available_days.map((d: number) => DAY_NAMES_CS[d]).join(", ")
    : "Každý den";

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <PageBack href="/reservations" label="Zpět na rezervace" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{room.name}</h1>
            {room.can_have_ts && (
              <Badge variant="secondary" className="text-xs">TS místnost</Badge>
            )}
          </div>
          {room.description && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5 flex-shrink-0" />
              <p className="text-sm md:text-base">{room.description}</p>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="size-3.5 flex-shrink-0" />
            <p className="text-sm">{availableDaysText}</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Schedule */}
        <div className="lg:col-span-3 space-y-4">
          <RoomScheduleView
            reservations={reservations}
            scheduleBreaks={scheduleBreaks}
            currentUserId={currentUserProfile?.id}
            roomId={room.id}
            roomName={room.name}
            alternativeRooms={alternativeRooms}
            availableDays={room.available_days}
            initialDate={dateParam}
          />

          {/* Alternative rooms */}
          {alternativeRooms.length > 0 && (
            <AlternativeRooms rooms={alternativeRooms} currentRoomId={room.id} />
          )}
        </div>

      </div>
    </div>
  );
}
