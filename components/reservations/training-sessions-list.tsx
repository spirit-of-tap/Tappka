"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Clock, Users, UserPlus, Edit, MapPin, Calendar } from "lucide-react";
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
  sessions: TrainingSessionWithDetails[];
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

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card p-5 transition-all hover:shadow-md",
        isPastSession && "opacity-60 bg-muted/30"
      )}
    >
      {/* Top row: Topic + Team badge + Date */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-base">{session.topic}</h3>
          {session.team && (
            <Badge
              variant="secondary"
              className="font-medium"
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
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="size-4" />
            <span className="font-medium">
              {format(startTime, "d. MMMM yyyy", { locale: cs })}
            </span>
          </div>
        )}
      </div>

      {/* Middle row: Room, Time, Cross slots */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground mb-4">
        {room && (
          <div className="flex items-center gap-1.5">
            <MapPin className="size-4 text-primary/70" />
            <span>{room.name}</span>
          </div>
        )}
        {startTime && endTime && (
          <div className="flex items-center gap-1.5">
            <Clock className="size-4 text-primary/70" />
            <span>
              {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
            </span>
          </div>
        )}
        {session.cross_slots_available > 0 && (
          <div
            className={cn(
              "flex items-center gap-1.5",
              availableSlots > 0
                ? "text-green-600 dark:text-green-400"
                : "text-orange-600 dark:text-orange-400"
            )}
          >
            <UserPlus className="size-4" />
            <span>
              {crossCount}/{session.cross_slots_available} cross
            </span>
          </div>
        )}
      </div>

      {/* Bottom row: Facilitators + Cross participants + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          {/* Facilitators */}
          {session.facilitators && session.facilitators.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Facilitátoři
              </span>
              <TooltipProvider delayDuration={200}>
                <AvatarGroup>
                  {session.facilitators.slice(0, 4).map((f) =>
                    f.user ? (
                      <UserAvatar key={f.id} user={f.user} size="sm" />
                    ) : null
                  )}
                </AvatarGroup>
              </TooltipProvider>
              {session.facilitators.length > 4 && (
                <span className="text-xs text-muted-foreground">
                  +{session.facilitators.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Cross participants */}
          {session.cross_participants && session.cross_participants.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Cross
              </span>
              <TooltipProvider delayDuration={200}>
                <AvatarGroup>
                  {session.cross_participants.slice(0, 4).map((p) =>
                    p.user ? (
                      <UserAvatar key={p.id} user={p.user} size="sm" />
                    ) : null
                  )}
                </AvatarGroup>
              </TooltipProvider>
              {session.cross_participants.length > 4 && (
                <span className="text-xs text-muted-foreground">
                  +{session.cross_participants.length - 4}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Join/Leave cross button */}
          {!isMyTeam && !isPastSession && session.cross_slots_available > 0 && (
            <>
              {isJoined ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onLeave?.(session.id)}
                  className="text-orange-600 border-orange-200 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-900 dark:hover:bg-orange-950"
                >
                  Odhlásit se
                </Button>
              ) : availableSlots > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onJoin?.(session.id)}
                  className="text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-900 dark:hover:bg-green-950"
                >
                  <UserPlus className="size-4 mr-1" />
                  Přihlásit se
                </Button>
              ) : null}
            </>
          )}

          {/* Edit/Delete for my team */}
          {isMyTeam && !isPastSession && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onEdit?.(session)}
                title="Upravit"
              >
                <Edit className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDelete?.(session.id)}
                className="text-destructive hover:text-destructive"
                title="Smazat"
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Component for managing Training Sessions
 * Any team member can create TS for their team
 */
export function TrainingSessionsList({
  rooms,
  sessions,
  teams,
  users,
  currentUserTeamId,
  currentUserId,
}: TrainingSessionsListProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSession, setEditingSession] =
    useState<TrainingSessionWithDetails | null>(null);

  // Form state
  const [roomId, setRoomId] = useState("");
  const [topic, setTopic] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("09:00");
  const [crossSlotsAvailable, setCrossSlotsAvailable] = useState(0);
  const [facilitatorIds, setFacilitatorIds] = useState<string[]>([]);

  const resetForm = () => {
    setRoomId("");
    setTopic("");
    setStartDate(undefined);
    setStartTime("09:00");
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
      setStartTime(format(start, "HH:mm"));
    }
    setCrossSlotsAvailable(session.cross_slots_available);
    setFacilitatorIds(session.facilitators?.map((f) => f.user_id) || []);
    setError(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!roomId || !topic || !startDate || !startTime) {
      setError("Vyplň všechna pole");
      return;
    }

    if (!currentUserTeamId) {
      setError("Nemáš přiřazený tým");
      return;
    }

    setIsLoading(true);

    try {
      const [hours, minutes] = startTime.split(":").map(Number);
      const startDateTime = new Date(startDate);
      startDateTime.setHours(hours, minutes, 0, 0);

      const payload = {
        room_id: roomId,
        team_id: currentUserTeamId,
        topic,
        start_time: startDateTime.toISOString(),
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
    () => splitSessions([...myTeamSessions, ...myCrossSessions].sort((a, b) => {
      const aTime = a.reservation?.start_time ? new Date(a.reservation.start_time).getTime() : 0;
      const bTime = b.reservation?.start_time ? new Date(b.reservation.start_time).getTime() : 0;
      return aTime - bTime;
    })),
    [myTeamSessions, myCrossSessions]
  );

  const allSessionsSplit = useMemo(
    () => splitSessions(allSessions),
    [allSessions]
  );

  const dialogTitle = editingSession
    ? "Upravit Training Session"
    : "Nový Training Session";
  const dialogDescription = editingSession
    ? "Uprav detaily Training Session pro tvůj tým"
    : "Vytvoř nový Training Session pro tvůj tým (trvá 4 hodiny)";

  const renderSessionsList = (
    upcoming: TrainingSessionWithDetails[],
    past: TrainingSessionWithDetails[],
    showActions: boolean = true
  ) => (
    <div className="space-y-4">
      {upcoming.length === 0 && past.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Žádné Training Sessions</p>
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
      {/* Add button */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogTrigger asChild>
          <Button>
            <Plus className="size-4 mr-2" />
            Nový Training Session
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Room */}
            <div className="space-y-2">
              <Label>Místnost</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger>
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

            {/* Topic */}
            <div className="space-y-2">
              <Label>Téma</Label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Např. Marketing Strategy"
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Datum</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {startDate
                        ? format(startDate, "PPP", { locale: cs })
                        : "Vyber datum"}
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
              </div>
              <div className="space-y-2">
                <Label>Čas (automaticky +4h)</Label>
                <TimePicker value={startTime} onChange={setStartTime} hourOnly />
              </div>
            </div>

            {/* Cross slots */}
            <div className="space-y-2">
              <Label>Cross místa (0-3)</Label>
              <Select
                value={crossSlotsAvailable.toString()}
                onValueChange={(v) => setCrossSlotsAvailable(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} {num === 0 ? "(žádná)" : num === 1 ? "místo" : "místa"}
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
