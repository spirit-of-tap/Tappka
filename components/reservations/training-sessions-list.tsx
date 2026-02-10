"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Clock, Users, UserPlus, Edit } from "lucide-react";
import { format, addHours, parseISO } from "date-fns";
import { cs } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { TimePicker } from "./time-picker";
import { UserTagPicker } from "./user-tag-picker";
import { cn } from "@/lib/utils";
import type { Room, TrainingSessionWithDetails } from "@/lib/reservations/types";

interface TrainingSessionsListProps {
  rooms: Room[];
  sessions: TrainingSessionWithDetails[];
  teams: { id: string; name: string; year: number }[];
  users: { id: string; name: string }[]; // All users for facilitator selection
  currentUserTeamId: string | null;
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
}: TrainingSessionsListProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<TrainingSessionWithDetails | null>(null);

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
    setFacilitatorIds(session.facilitators?.map(f => f.user_id) || []);
    setError(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    setError(null);

    // Validation
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
      // Combine date and time
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
        // Update existing
        response = await fetch(`/api/training-sessions/${editingSession.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new
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

  // Filter sessions for current user's team
  const myTeamSessions = sessions.filter(s => s.team_id === currentUserTeamId);
  // Sort by start time (newest first)
  const sortedSessions = [...myTeamSessions].sort((a, b) => {
    const aTime = a.reservation?.start_time ? new Date(a.reservation.start_time).getTime() : 0;
    const bTime = b.reservation?.start_time ? new Date(b.reservation.start_time).getTime() : 0;
    return bTime - aTime;
  });

  // Cross sessions: other teams with available cross slots
  const crossSessions = sessions
    .filter(s => s.team_id !== currentUserTeamId && s.cross_slots_available > 0)
    .sort((a, b) => {
      const aTime = a.reservation?.start_time ? new Date(a.reservation.start_time).getTime() : 0;
      const bTime = b.reservation?.start_time ? new Date(b.reservation.start_time).getTime() : 0;
      return aTime - bTime; // Upcoming first
    });

  const dialogTitle = editingSession ? "Upravit Training Session" : "Nový Training Session";
  const dialogDescription = editingSession
    ? "Uprav detaily Training Session pro tvůj tým"
    : "Vytvoř nový Training Session pro tvůj tým (trvá 4 hodiny)";

  return (
    <div className="space-y-6">
      {/* Add button */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="size-4 mr-2" />
            Přidat Training Session
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
                      {startDate ? format(startDate, "PPP", { locale: cs }) : "Vyber datum"}
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
              <Select value={crossSlotsAvailable.toString()} onValueChange={(v) => setCrossSlotsAvailable(parseInt(v))}>
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
              {isLoading ? "Ukládám..." : editingSession ? "Uložit změny" : "Vytvořit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* List of sessions */}
      <div className="space-y-3">
        {sortedSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-8 text-center">
            Žádné Training Sessions pro tvůj tým
          </p>
        ) : (
          sortedSessions.map((session) => (
            <div
              key={session.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card gap-3"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{session.topic}</Badge>
                  {session.team && (
                    <Badge variant="outline">{session.team.name}</Badge>
                  )}
                  {session.reservation && (
                    <span className="text-sm text-muted-foreground">
                      {format(parseISO(session.reservation.start_time), "PPP", { locale: cs })} • {format(parseISO(session.reservation.start_time), "HH:mm")} - {format(parseISO(session.reservation.end_time), "HH:mm")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>📍 {rooms.find(r => r.id === session.reservation?.room_id)?.name}</span>
                  <span>
                    <UserPlus className="inline size-3 mr-1" />
                    {session.cross_participants?.length || 0}/{session.cross_slots_available} cross
                  </span>
                </div>
                {session.facilitators && session.facilitators.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="size-3" />
                    {session.facilitators.map(f => f.user?.name).filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 self-end sm:self-auto">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEditDialog(session)}
                  title="Upravit"
                >
                  <Edit className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(session.id)}
                  className="text-destructive hover:text-destructive"
                  title="Smazat"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cross sessions from other teams */}
      {crossSessions.length > 0 && (
        <div className="space-y-3 mt-8">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <UserPlus className="size-5" />
            Cross příležitosti
          </h3>
          <p className="text-sm text-muted-foreground">
            Training Sessions jiných týmů s volnými cross místy
          </p>
          <div className="space-y-3">
            {crossSessions.map((session) => {
              const currentCrossCount = session.cross_participants?.length || 0;
              const availableSlots = session.cross_slots_available - currentCrossCount;

              return (
                <div
                  key={session.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{session.topic}</Badge>
                      {session.team && (
                        <Badge variant="outline">{session.team.name}</Badge>
                      )}
                      {session.reservation && (
                        <span className="text-sm text-muted-foreground">
                          {format(parseISO(session.reservation.start_time), "PPP", { locale: cs })} • {format(parseISO(session.reservation.start_time), "HH:mm")} - {format(parseISO(session.reservation.end_time), "HH:mm")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>📍 {rooms.find(r => r.id === session.reservation?.room_id)?.name}</span>
                      <span className={availableSlots > 0 ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}>
                        <UserPlus className="inline size-3 mr-1" />
                        {availableSlots > 0 ? `${availableSlots} volná místa` : "Plně obsazeno"}
                      </span>
                    </div>
                    {session.facilitators && session.facilitators.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="size-3" />
                        {session.facilitators.map(f => f.user?.name).filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 self-end sm:self-auto">
                    {availableSlots > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {/* TODO: join as cross */ }}
                      >
                        <UserPlus className="size-4 mr-1" />
                        Přihlásit se
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
