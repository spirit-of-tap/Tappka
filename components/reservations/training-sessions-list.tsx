"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTrainingSessionsListRealtime } from "@/lib/hooks/use-training-sessions-list-realtime";
import { Plus, Trash2, Clock, Users, UserPlus, Edit, MapPin, Sun, Moon, FileText, Search, X, RotateCcw } from "lucide-react";
import { format, parseISO, isPast } from "date-fns";
import { cs } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TimePicker } from "./time-picker";
import { UserTagPicker } from "./user-tag-picker";
import { cn } from "@/lib/utils";
import type { Room, TrainingSessionWithDetails } from "@/lib/reservations/types";

interface TrainingSessionsListProps {
  rooms: Room[];
  initialSessions: TrainingSessionWithDetails[];
  teams: { id: string; name: string; year: number; color: string | null }[];
  users: { id: string; name: string; picture: string | null }[];
  currentUserTeamId: string | null;
  currentUserId: string;
}

// Helper to get initials from name
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Helper to get storage URL for picture
function getPictureUrl(picture: string | null | undefined): string | undefined {
  if (!picture) return undefined;
  if (picture.startsWith("http")) return picture;
  return `${process.env.NEXT_PUBLIC_B2_PUBLIC_URL}/profile-pictures/${picture}`;
}

interface UserAvatarProps {
  user: { id: string; name: string; picture?: string | null };
  size?: "sm" | "default";
  showTooltip?: boolean;
}

function UserAvatar({ user, size = "default", showTooltip = true }: UserAvatarProps) {
  const avatar = (
    <Avatar size={size}>
      <AvatarImage src={getPictureUrl(user.picture)} alt={user.name} />
      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
    </Avatar>
  );

  if (!showTooltip) return avatar;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{avatar}</TooltipTrigger>
      <TooltipContent>
        <p>{user.name}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface SessionCardProps {
  session: TrainingSessionWithDetails;
  rooms: Room[];
  isMyTeam: boolean;
  isPastSession: boolean;
  currentUserId: string;
  onEdit?: (session: TrainingSessionWithDetails) => void;
  onDelete?: (sessionId: string) => void;
  onJoin?: (sessionId: string) => void;
  onLeave?: (sessionId: string) => void;
}

function SessionCard({
  session,
  rooms,
  isMyTeam,
  isPastSession,
  currentUserId,
  onEdit,
  onDelete,
  onJoin,
  onLeave,
}: SessionCardProps) {
  const room = rooms.find((r) => r.id === session.reservation?.room_id);
  const startTime = session.reservation?.start_time
    ? parseISO(session.reservation.start_time)
    : null;
  const endTime = session.reservation?.end_time
    ? parseISO(session.reservation.end_time)
    : null;

  const crossCount = session.cross_participants?.length || 0;
  const availableSlots = session.cross_slots_available - crossCount;
  const isJoined = session.cross_participants?.some(
    (p) => p.user_id === currentUserId
  );

  const showJoinButton = !isMyTeam && !isPastSession && session.cross_slots_available > 0;
  const showEditButtons = isMyTeam && !isPastSession;

  return (
    <Link
      href={`/training-sessions/${session.id}`}
      className={cn(
        "group relative block rounded-lg border bg-card px-4 py-3 transition-all hover:shadow-md border-l-4 cursor-pointer",
        isPastSession && "opacity-50 bg-muted/30"
      )}
      style={{
        borderLeftColor: session.team?.color || undefined,
      }}
    >
      {/* Row 1: Topic + Team badge + Date */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold text-sm truncate">{session.topic}</h3>
          {session.team && !isMyTeam && (
            <Badge
              variant="secondary"
              className="text-xs shrink-0"
              style={
                session.team.color
                  ? {
                      backgroundColor: session.team.color,
                      borderColor: session.team.color,
                      color: "white",
                    }
                  : undefined
              }
            >
              {session.team.name}
            </Badge>
          )}
        </div>
        {startTime && (
          <span className="text-xs text-muted-foreground shrink-0">
            {format(startTime, "d. MMM yyyy", { locale: cs })}
          </span>
        )}
      </div>

      {/* Row 2: Room, Time, Cross slots - all inline */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
        {room && (
          <span className="flex items-center gap-1">
            <MapPin className="size-3" />
            {room.code?.toUpperCase() || room.name}
          </span>
        )}
        {startTime && endTime && (
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
          </span>
        )}
        {session.cross_slots_available > 0 && (
          <span className="flex items-center gap-1">
            <UserPlus className="size-3" />
            {crossCount}/{session.cross_slots_available} cross
          </span>
        )}
        {session.prep_file_key && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-primary">
                  <FileText className="size-3" />
                  <span>Příprava</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Příprava k dispozici</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Row 3: Facilitators + Cross + Actions - fixed height */}
      <div className="flex items-center justify-between gap-3 min-h-[28px]">
        <div className="flex items-center gap-4 text-xs">
          {/* Facilitators */}
          {session.facilitators && session.facilitators.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground uppercase tracking-wide font-medium">
                Facilitátoři
              </span>
              <TooltipProvider delayDuration={200}>
                <AvatarGroup>
                  {session.facilitators.slice(0, 3).map((f) =>
                    f.user ? (
                      <UserAvatar key={f.id} user={f.user} size="sm" />
                    ) : null
                  )}
                </AvatarGroup>
              </TooltipProvider>
              {session.facilitators.length > 3 && (
                <span className="text-muted-foreground">
                  +{session.facilitators.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Cross participants */}
          {session.cross_participants && session.cross_participants.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground uppercase tracking-wide font-medium">
                Cross
              </span>
              <TooltipProvider delayDuration={200}>
                <AvatarGroup>
                  {session.cross_participants.slice(0, 3).map((p) =>
                    p.user ? (
                      <UserAvatar key={p.id} user={p.user} size="sm" />
                    ) : null
                  )}
                </AvatarGroup>
              </TooltipProvider>
              {session.cross_participants.length > 3 && (
                <span className="text-muted-foreground">
                  +{session.cross_participants.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions - fixed width area */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.preventDefault()}>
          {showJoinButton && (
            <>
              {isJoined ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    onLeave?.(session.id);
                  }}
                >
                  Odhlásit se
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    onJoin?.(session.id);
                  }}
                  disabled={availableSlots <= 0}
                >
                  <UserPlus className="size-4" />
                  {availableSlots > 0 ? "Crossnout" : "Obsazeno"}
                </Button>
              )}
            </>
          )}

          {showEditButtons && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.preventDefault();
                  onEdit?.(session);
                }}
                title="Upravit"
              >
                <Edit className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.preventDefault();
                  onDelete?.(session.id);
                }}
                className="text-destructive hover:text-destructive"
                title="Smazat"
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * Component for managing Training Sessions
 * Any team member can create TS for their team
 */
export function TrainingSessionsList({
  rooms,
  initialSessions,
  teams,
  users,
  currentUserTeamId,
  currentUserId,
}: TrainingSessionsListProps) {
  const router = useRouter();
  
  // Subscribe to realtime updates for all sessions
  const { sessions } = useTrainingSessionsListRealtime({ initialSessions });
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSession, setEditingSession] =
    useState<TrainingSessionWithDetails | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");

  // Form state
  const [roomId, setRoomId] = useState("");
  const [topic, setTopic] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [timeSlot, setTimeSlot] = useState<"morning" | "afternoon">("morning");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");
  const [crossSlotsAvailable, setCrossSlotsAvailable] = useState(0);
  const [facilitatorIds, setFacilitatorIds] = useState<string[]>([]);

  // Update time when slot changes
  const handleTimeSlotChange = (slot: "morning" | "afternoon") => {
    setTimeSlot(slot);
    if (slot === "morning") {
      setStartTime("08:00");
      setEndTime("12:00");
    } else {
      setStartTime("13:00");
      setEndTime("17:00");
    }
  };

  const resetForm = () => {
    setRoomId("");
    setTopic("");
    setStartDate(undefined);
    setTimeSlot("morning");
    setStartTime("08:00");
    setEndTime("12:00");
    setCrossSlotsAvailable(0);
    setFacilitatorIds([]);
    setError(null);
    setEditingSession(null);
  };

  const openEditDialog = (session: TrainingSessionWithDetails) => {
    setEditingSession(session);
    setRoomId(session.reservation?.room_id || "");
    setTopic(session.topic);
    if (session.reservation?.start_time) {
      const start = parseISO(session.reservation.start_time);
      setStartDate(start);
      const hours = start.getHours();
      setTimeSlot(hours < 12 ? "morning" : "afternoon");
      setStartTime(format(start, "HH:mm"));
    }
    if (session.reservation?.end_time) {
      const end = parseISO(session.reservation.end_time);
      setEndTime(format(end, "HH:mm"));
    }
    setCrossSlotsAvailable(session.cross_slots_available);
    setFacilitatorIds(session.facilitators?.map((f) => f.user_id) || []);
    setError(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!roomId || !topic || !startDate || !startTime || !endTime) {
      setError("Vyplň všechna pole");
      return;
    }

    if (!currentUserTeamId) {
      setError("Nemáš přiřazený tým");
      return;
    }

    setIsLoading(true);

    try {
      const [startHours, startMinutes] = startTime.split(":").map(Number);
      const startDateTime = new Date(startDate);
      startDateTime.setHours(startHours, startMinutes, 0, 0);

      const [endHours, endMinutes] = endTime.split(":").map(Number);
      const endDateTime = new Date(startDate);
      endDateTime.setHours(endHours, endMinutes, 0, 0);

      const payload = {
        room_id: roomId,
        team_id: currentUserTeamId,
        topic,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        cross_slots_available: crossSlotsAvailable,
        facilitator_ids: facilitatorIds,
      };

      let response;
      if (editingSession) {
        response = await fetch(`/api/training-sessions/${editingSession.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch("/api/training-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nepodařilo se uložit Training Session");
      }

      setIsDialogOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm("Opravdu chceš smazat tento Training Session?")) return;

    try {
      const response = await fetch(`/api/training-sessions/${sessionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Nepodařilo se smazat Training Session");
      }

      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Něco se pokazilo");
    }
  };

  const handleJoinCross = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/training-sessions/${sessionId}/cross-participants`, {
        method: "POST",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Nepodařilo se přihlásit");
      }

      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Něco se pokazilo");
    }
  };

  const handleLeaveCross = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/training-sessions/${sessionId}/cross-participants`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Nepodařilo se odhlásit");
      }

      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Něco se pokazilo");
    }
  };

  // Filter sessions based on search query and team filter
  const filterSessions = (sessionsList: TrainingSessionWithDetails[]) => {
    return sessionsList.filter((session) => {
      // Team filter
      if (teamFilter !== "all" && session.team_id !== teamFilter) {
        return false;
      }

      // Search filter (search in topic and team name)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const topicMatch = session.topic.toLowerCase().includes(query);
        const teamNameMatch = session.team?.name?.toLowerCase().includes(query);
        if (!topicMatch && !teamNameMatch) {
          return false;
        }
      }

      return true;
    });
  };

  // Prepare sessions data
  const { myTeamSessions, myCrossSessions, allSessions } = useMemo(() => {
    const now = new Date();

    // My team sessions (where I'm in the team)
    const myTeam = sessions.filter((s) => s.team_id === currentUserTeamId);

    // Sessions I've joined as cross
    const myCross = sessions.filter(
      (s) =>
        s.team_id !== currentUserTeamId &&
        s.cross_participants?.some((p) => p.user_id === currentUserId)
    );

    // Combined for "Mé crossy" tab
    const myAll = [...myTeam, ...myCross];

    // All sessions sorted chronologically for "Komunita" tab
    const all = [...sessions];

    // Sort all by start time
    const sortByTime = (a: TrainingSessionWithDetails, b: TrainingSessionWithDetails) => {
      const aTime = a.reservation?.start_time
        ? new Date(a.reservation.start_time).getTime()
        : 0;
      const bTime = b.reservation?.start_time
        ? new Date(b.reservation.start_time).getTime()
        : 0;
      return aTime - bTime;
    };

    myAll.sort(sortByTime);
    all.sort(sortByTime);

    return {
      myTeamSessions: myTeam,
      myCrossSessions: myCross,
      allSessions: all,
    };
  }, [sessions, currentUserTeamId, currentUserId]);

  // Split sessions into upcoming and past
  const splitSessions = (sessionsList: TrainingSessionWithDetails[]) => {
    const now = new Date();
    const upcoming: TrainingSessionWithDetails[] = [];
    const past: TrainingSessionWithDetails[] = [];

    sessionsList.forEach((s) => {
      const endTime = s.reservation?.end_time
        ? parseISO(s.reservation.end_time)
        : null;
      if (endTime && isPast(endTime)) {
        past.push(s);
      } else {
        upcoming.push(s);
      }
    });

    return { upcoming, past };
  };

  const mySessionsSplit = useMemo(
    () => splitSessions(filterSessions([...myTeamSessions, ...myCrossSessions]).sort((a, b) => {
      const aTime = a.reservation?.start_time ? new Date(a.reservation.start_time).getTime() : 0;
      const bTime = b.reservation?.start_time ? new Date(b.reservation.start_time).getTime() : 0;
      return aTime - bTime;
    })),
    [myTeamSessions, myCrossSessions, searchQuery, teamFilter]
  );

  const allSessionsSplit = useMemo(
    () => splitSessions(filterSessions(allSessions)),
    [allSessions, searchQuery, teamFilter]
  );

  const dialogTitle = editingSession
    ? "Upravit Training Session"
    : "Nový Training Session";
  const dialogDescription = editingSession
    ? "Uprav detaily Training Session pro tvůj tým"
    : "Vytvoř nový Training Session pro tvůj tým (trvá 4 hodiny)";

  const hasActiveFilter = searchQuery || teamFilter !== "all";

  const renderSessionsList = (
    upcoming: TrainingSessionWithDetails[],
    past: TrainingSessionWithDetails[],
    showActions: boolean = true
  ) => (
    <div className="space-y-4">
      {upcoming.length === 0 && past.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            {hasActiveFilter 
              ? "Žádné Training Sessions neodpovídají filtru" 
              : "Žádné Training Sessions"}
          </p>
          {hasActiveFilter && (
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setTeamFilter("all");
              }}
              className="mt-2"
            >
              Zrušit filtr
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Upcoming sessions */}
          {upcoming.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              rooms={rooms}
              isMyTeam={session.team_id === currentUserTeamId}
              isPastSession={false}
              currentUserId={currentUserId}
              onEdit={showActions ? openEditDialog : undefined}
              onDelete={showActions ? handleDelete : undefined}
              onJoin={handleJoinCross}
              onLeave={handleLeaveCross}
            />
          ))}

          {/* Past sessions divider */}
          {past.length > 0 && (
            <>
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-muted-foreground/20" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-3 text-xs text-muted-foreground uppercase tracking-wider">
                    Proběhlé
                  </span>
                </div>
              </div>

              {past.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  rooms={rooms}
                  isMyTeam={session.team_id === currentUserTeamId}
                  isPastSession={true}
                  currentUserId={currentUserId}
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold">Training Sessions</h2>
          <p className="text-muted-foreground mt-1">
            Vytvoř a spravuj Training Sessions pro svůj tým. Každý TS trvá 4 hodiny.
          </p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <Plus className="size-4 mr-2" />
              Nový Training Session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              {/* Topic - most important, first */}
              <div className="space-y-2">
                <Label>Téma</Label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Např. Marketing Strategy"
                />
              </div>

              {/* When: Date + Time slot on one row */}
              <div className="space-y-2">
                <Label>Kdy</Label>
                <div className="flex gap-2">
                  {/* Date picker */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        {startDate
                          ? format(startDate, "d. MMM yyyy", { locale: cs })
                          : "Datum"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Time slot toggle */}
                  <div className="flex border rounded-md">
                    <Button
                      type="button"
                      variant={timeSlot === "morning" ? "default" : "ghost"}
                      size="sm"
                      className="rounded-r-none border-0"
                      onClick={() => handleTimeSlotChange("morning")}
                    >
                      <Sun className="size-4 mr-1" />
                      Dopo
                    </Button>
                    <Button
                      type="button"
                      variant={timeSlot === "afternoon" ? "default" : "ghost"}
                      size="sm"
                      className="rounded-l-none border-0"
                      onClick={() => handleTimeSlotChange("afternoon")}
                    >
                      <Moon className="size-4 mr-1" />
                      Odpo
                    </Button>
                  </div>
                </div>
                {/* Exact times - small, right-aligned */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Přesný čas:</span>
                  <div className="w-20">
                    <TimePicker value={startTime} onChange={setStartTime} hourOnly />
                  </div>
                  <span>–</span>
                  <div className="w-20">
                    <TimePicker value={endTime} onChange={setEndTime} hourOnly />
                  </div>
                </div>
              </div>

              {/* Where: Room */}
              <div className="space-y-2">
                <Label>Kde</Label>
                <Select value={roomId} onValueChange={setRoomId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Vyber místnost" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cross slots */}
              <div className="space-y-2">
                <Label>Cross místa</Label>
                <Select
                  value={crossSlotsAvailable.toString()}
                  onValueChange={(v) => setCrossSlotsAvailable(parseInt(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num === 0 ? "Žádná" : `${num} ${num === 1 ? "místo" : "místa"}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Facilitators */}
              <div className="space-y-2">
                <Label>Facilitátoři</Label>
                <UserTagPicker
                  users={users}
                  selectedIds={facilitatorIds}
                  onChange={setFacilitatorIds}
                  placeholder="Vyhledat facilitátora..."
                  emptyMessage="Žádný uživatel nenalezen"
                />
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}

              {/* Submit */}
              <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
                {isLoading
                  ? "Ukládám..."
                  : editingSession
                  ? "Uložit změny"
                  : "Vytvořit"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="my" className="w-full">
        <TabsList>
          <TabsTrigger value="my">
            <Users className="size-4 mr-2" />
            Mé crossy
          </TabsTrigger>
          <TabsTrigger value="community">
            <UserPlus className="size-4 mr-2" />
            Komunita
          </TabsTrigger>
        </TabsList>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4 p-4 bg-muted/30 rounded-lg border">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Hledat podle tématu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 size-7 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="size-3.5" />
                <span className="sr-only">Vymazat hledání</span>
              </Button>
            )}
          </div>

          {/* Team Filter */}
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Všechny týmy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny týmy</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  <div className="flex items-center gap-2">
                    {team.color && (
                      <div
                        className="size-2 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                    )}
                    {team.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Reset Button */}
          {(searchQuery || teamFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setTeamFilter("all");
              }}
              className="shrink-0"
            >
              <RotateCcw className="size-4 mr-1" />
              Reset
            </Button>
          )}
        </div>

        <TabsContent value="my" className="mt-6">
          {renderSessionsList(mySessionsSplit.upcoming, mySessionsSplit.past, true)}
        </TabsContent>

        <TabsContent value="community" className="mt-6">
          {renderSessionsList(allSessionsSplit.upcoming, allSessionsSplit.past, true)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
