import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Lock, Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RoomScheduleView } from "@/components/reservations/room-schedule-view";
import { AlternativeRooms } from "@/components/reservations/alternative-rooms";
import { IssueReportButton } from "@/components/reservations/issue-report-button";
import { DAY_NAMES_CS, ISSUE_TYPE_LABELS } from "@/lib/reservations/types";
import type { Room, ReservationWithDetails, RoomIssue, ScheduleBreak } from "@/lib/reservations/types";
import { getCurrentUserProfile } from "@/lib/auth-helpers";

interface RoomDetailPageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ date?: string }>;
}

export async function generateMetadata({ params }: RoomDetailPageProps) {
  const { code } = await params;
  return {
    title: `${code.toUpperCase()} | Rezervace | Tappka`,
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
    .single();

  if (roomError || !room) {
    notFound();
  }

  // Fetch data in parallel
  // Include past 7 days for navigation + future 14 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const twoWeeksLater = new Date(today);
  twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

  const oneWeekAgoStr = oneWeekAgo.toISOString().split("T")[0];
  const twoWeeksLaterStr = twoWeeksLater.toISOString().split("T")[0];

  const [reservationsResult, issuesResult, alternativeRoomsResult, breaksResult] = await Promise.all([
    // Reservations for this room (past 7 days + next 14 days for calendar navigation)
    supabase
      .from("reservations")
      .select(`
        *,
        user:profiles(id, name, picture),
        team:teams(id, name)
      `)
      .eq("room_id", room.id)
      .gte("start_time", oneWeekAgo.toISOString())
      .lte("start_time", twoWeeksLater.toISOString())
      .order("start_time"),

    // Open issues for this room
    supabase
      .from("room_issues")
      .select("*")
      .eq("room_id", room.id)
      .eq("status", "open")
      .order("created_at", { ascending: false }),

    // Alternative rooms for suggestions
    supabase
      .from("rooms")
      .select("*")
      .neq("id", room.id)
      .order("code"),

    // Schedule breaks for the date range (past 7 + future 14 days)
    supabase
      .from("schedule_breaks")
      .select("*")
      .lte("start_date", twoWeeksLaterStr)
      .gte("end_date", oneWeekAgoStr)
      .order("start_date"),
  ]);

  const reservations = (reservationsResult.data ?? []) as ReservationWithDetails[];
  const issues = (issuesResult.data || []) as RoomIssue[];
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

  // Check for locked issue
  const lockedIssue = issues.find((i) => i.issue_type === "locked");
  const otherIssues = issues.filter((i) => i.issue_type !== "locked");

  // Available days info
  const availableDaysText = room.available_days
    ? room.available_days.map((d: number) => DAY_NAMES_CS[d]).join(", ")
    : "Každý den";

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/reservations">
          <ArrowLeft className="size-4 mr-2" />
          Zpět na místnosti
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-heading font-bold tracking-tight">{room.name}</h2>
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
        <IssueReportButton roomId={room.id} />
      </div>

      <Separator />

      {/* Issue warnings */}
      {lockedIssue && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-orange-100 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-800">
          <Lock className="size-5 text-orange-600 dark:text-orange-400" />
          <div>
            <p className="font-medium text-orange-800 dark:text-orange-200">
              Místnost je nahlášena jako zamčená
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-300">
              Někdo nahlásil, že se do místnosti nedá dostat
            </p>
          </div>
        </div>
      )}

      {otherIssues.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-100 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-800">
          <AlertTriangle className="size-5 text-yellow-600 dark:text-yellow-400" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              Nahlášené problémy
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {otherIssues.map((i) => ISSUE_TYPE_LABELS[i.issue_type]).join(", ")}
            </p>
          </div>
        </div>
      )}

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
