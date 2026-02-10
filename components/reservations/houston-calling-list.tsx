"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Clock, Edit } from "lucide-react";
import { format, parseISO } from "date-fns";
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
import { cn } from "@/lib/utils";
import type { Room, HoustonCallingEventWithDetails } from "@/lib/reservations/types";

interface HoustonCallingListProps {
  rooms: Room[];
  events: HoustonCallingEventWithDetails[];
  teams: { id: string; name: string; year: number }[];
}

/**
 * Component for managing Houston Calling events
 * Only coaches and admins can create/edit HC events
 */
export function HoustonCallingList({
  rooms,
  events,
  teams,
}: HoustonCallingListProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<HoustonCallingEventWithDetails | null>(null);

  // Form state
  const [roomId, setRoomId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [topic, setTopic] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("09:00");

  const resetForm = () => {
    setRoomId("");
    setTeamId("");
    setTopic("");
    setStartDate(undefined);
    setStartTime("09:00");
    setError(null);
    setEditingEvent(null);
  };

  const openEditDialog = (event: HoustonCallingEventWithDetails) => {
    setEditingEvent(event);
    setRoomId(event.reservation?.room_id || "");
    setTeamId(event.team_id);
    setTopic(event.topic);
    if (event.reservation?.start_time) {
      const start = parseISO(event.reservation.start_time);
      setStartDate(start);
      setStartTime(format(start, "HH:mm"));
    }
    setError(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!roomId || !teamId || !topic || !startDate || !startTime) {
      setError("Vyplň všechna pole");
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
        team_id: teamId,
        topic,
        start_time: startDateTime.toISOString(),
      };

      let response;
      if (editingEvent) {
        // Update existing
        response = await fetch(`/api/houston-calling/${editingEvent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new
        response = await fetch("/api/houston-calling", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nepodařilo se uložit Houston Calling");
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

  const handleDelete = async (eventId: string) => {
    if (!confirm("Opravdu chceš smazat tento Houston Calling?")) return;

    try {
      const response = await fetch(`/api/houston-calling/${eventId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Nepodařilo se smazat Houston Calling");
      }

      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Něco se pokazilo");
    }
  };

  // Sort events by start time (newest first)
  const sortedEvents = [...events].sort((a, b) => {
    const aTime = a.reservation?.start_time ? new Date(a.reservation.start_time).getTime() : 0;
    const bTime = b.reservation?.start_time ? new Date(b.reservation.start_time).getTime() : 0;
    return bTime - aTime;
  });

  const dialogTitle = editingEvent ? "Upravit Houston Calling" : "Nový Houston Calling";
  const dialogDescription = editingEvent
    ? "Uprav detaily Houston Calling události"
    : "Vytvoř nový Houston Calling pro tým (trvá 4 hodiny)";

  return (
    <div className="space-y-6">
      {/* Add button */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="size-4 mr-2" />
            Přidat Houston Calling
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
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

            {/* Team */}
            <div className="space-y-2">
              <Label>Tým</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyber tým" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name} ({team.year}. ročník)
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
                placeholder="Např. Monthly Check-in"
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

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            {/* Submit */}
            <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
              {isLoading ? "Ukládám..." : editingEvent ? "Uložit změny" : "Vytvořit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* List of events */}
      <div className="space-y-3">
        {sortedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-8 text-center">
            Žádné Houston Calling události
          </p>
        ) : (
          sortedEvents.map((event) => (
            <div
              key={event.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card gap-3"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{event.topic}</Badge>
                  <Badge variant="outline">{event.team?.name}</Badge>
                  {event.reservation && (
                    <span className="text-sm text-muted-foreground">
                      {format(parseISO(event.reservation.start_time), "PPP", { locale: cs })} • {format(parseISO(event.reservation.start_time), "HH:mm")} - {format(parseISO(event.reservation.end_time), "HH:mm")}
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  📍 {rooms.find(r => r.id === event.reservation?.room_id)?.name}
                </div>
              </div>
              <div className="flex items-center gap-1 self-end sm:self-auto">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEditDialog(event)}
                  title="Upravit"
                >
                  <Edit className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(event.id)}
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
    </div>
  );
}
