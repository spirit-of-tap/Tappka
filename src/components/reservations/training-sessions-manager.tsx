"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Calendar, Clock, Users, Copy, Pencil, GripVertical } from "lucide-react";
import { format } from "date-fns";
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
} from "@/components/ui/responsive-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TimePicker } from "./time-picker";
import { cn } from "@/lib/utils";
import { DAY_NAMES_CS, type Room, type RecurringSchedule } from "@/lib/reservations/types";

interface TrainingSessionsManagerProps {
  rooms: Room[];
  schedules: (RecurringSchedule & { room: Room; team: { id: string; name: string } })[];
  teams: { id: string; name: string; onboardingYear: number | null }[];
}

type ScheduleWithRelations = RecurringSchedule & { room: Room; team: { id: string; name: string } };

/**
 * Manager component for Training Sessions
 */
export function TrainingSessionsManager({
  rooms,
  schedules,
  teams,
}: TrainingSessionsManagerProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Edit mode
  const [editingSchedule, setEditingSchedule] = useState<ScheduleWithRelations | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ScheduleWithRelations | null>(null);

  // Drag state
  const [draggedSchedule, setDraggedSchedule] = useState<ScheduleWithRelations | null>(null);
  const [dragOverRoomId, setDragOverRoomId] = useState<string | null>(null);
  
  // Click vs drag detection
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  // Form state
  const [roomId, setRoomId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");
  const [validFrom, setValidFrom] = useState<Date | undefined>(undefined);
  const [validUntil, setValidUntil] = useState<Date | undefined>(undefined);

  const resetForm = () => {
    setRoomId("");
    setTeamId("");
    setDayOfWeek("");
    setStartTime("09:00");
    setEndTime("13:00");
    setValidFrom(undefined);
    setValidUntil(undefined);
    setError(null);
    setEditingSchedule(null);
    setIsDuplicating(false);
  };

  const openEditDialog = (schedule: ScheduleWithRelations, duplicate = false) => {
    setEditingSchedule(duplicate ? null : schedule);
    setIsDuplicating(duplicate);
    setRoomId(schedule.room_id);
    setTeamId(schedule.team_id ?? "");
    setDayOfWeek(schedule.day_of_week.toString());
    setStartTime(schedule.start_time.slice(0, 5));
    setEndTime(schedule.end_time.slice(0, 5));
    setValidFrom(new Date(schedule.valid_from));
    setValidUntil(schedule.valid_until ? new Date(schedule.valid_until) : undefined);
    setError(null);
    setIsDialogOpen(true);
  };

  // Auto-set end time to +4 hours when start time changes (TS are always 4 hours)
  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);
    
    // Calculate end time (+4 hours)
    const [hours, minutes] = newStartTime.split(":").map(Number);
    const endHours = hours + 4;
    
    // Cap at operating hours end (22:00)
    if (endHours <= 22) {
      const endTimeStr = `${endHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      setEndTime(endTimeStr);
    } else {
      setEndTime("22:00");
    }
  };

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!roomId || !teamId || !dayOfWeek || !startTime || !endTime || !validFrom || !validUntil) {
      setError("Vyplň všechna pole");
      return;
    }

    if (validFrom > validUntil) {
      setError("Datum konce musí být po datu začátku");
      return;
    }

    if (startTime >= endTime) {
      setError("Čas konce musí být po čase začátku");
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        room_id: roomId,
        team_id: teamId,
        schedule_type: "training_session" as const,
        day_of_week: parseInt(dayOfWeek),
        start_time: startTime,
        end_time: endTime,
        valid_from: format(validFrom, "yyyy-MM-dd"),
        valid_until: format(validUntil, "yyyy-MM-dd"),
      };

      let response;
      if (editingSchedule && !isDuplicating) {
        // Update existing
        response = await fetch(`/api/recurring-schedules/${editingSchedule.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new (or duplicate)
        response = await fetch("/api/recurring-schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nepodařilo se uložit TS");
      }

      toast.success("Training Session uložen");
      setIsDialogOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      const response = await fetch(`/api/recurring-schedules/${scheduleId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Nepodařilo se smazat TS");
      }

      toast.success("Training Session smazán");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setDeleteTarget(null);
    }
  };

  // Move schedule to different room
  const handleMoveToRoom = useCallback(async (schedule: ScheduleWithRelations, newRoomId: string) => {
    if (schedule.room_id === newRoomId) return;

    try {
      const response = await fetch(`/api/recurring-schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: newRoomId }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Nepodařilo se přesunout TS");
      }

      toast.success("Training Session přesunut");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Něco se pokazilo");
    }
  }, [router]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, schedule: ScheduleWithRelations) => {
    setDraggedSchedule(schedule);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", schedule.id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedSchedule(null);
    setDragOverRoomId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, roomId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverRoomId(roomId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverRoomId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetRoomId: string) => {
    e.preventDefault();
    if (draggedSchedule) {
      handleMoveToRoom(draggedSchedule, targetRoomId);
    }
    setDraggedSchedule(null);
    setDragOverRoomId(null);
  }, [draggedSchedule, handleMoveToRoom]);

  // Click vs drag detection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
  }, []);

  const handleMouseMove = useCallback(() => {
    if (mouseDownPos.current) {
      isDragging.current = true;
    }
  }, []);

  const handleClick = useCallback((e: React.MouseEvent, schedule: ScheduleWithRelations) => {
    // Only open edit if it wasn't a drag
    if (!isDragging.current && mouseDownPos.current) {
      const dx = Math.abs(e.clientX - mouseDownPos.current.x);
      const dy = Math.abs(e.clientY - mouseDownPos.current.y);
      // If mouse moved less than 5px, consider it a click
      if (dx < 5 && dy < 5) {
        openEditDialog(schedule);
      }
    }
    mouseDownPos.current = null;
    isDragging.current = false;
  }, []);

  // Group schedules by room (only TS-capable rooms)
  const tsRooms = rooms.filter(r => r.can_have_ts);
  const schedulesByRoom = tsRooms.map((room) => ({
    room,
    schedules: schedules.filter((s) => s.room_id === room.id),
  }));

  const dialogTitle = editingSchedule 
    ? "Upravit Training Session" 
    : isDuplicating 
      ? "Duplikovat Training Session"
      : "Nový Training Session";

  const dialogDescription = editingSchedule
    ? "Uprav rozvrh pro tým"
    : isDuplicating
      ? "Vytvoř kopii rozvrhu"
      : "Vytvoř opakovaný rozvrh pro tým";

  const submitLabel = editingSchedule
    ? "Uložit změny"
    : "Vytvořit a vygenerovat rezervace";

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
                  {tsRooms.map((room) => (
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
                      {team.name} ({team.onboardingYear}. ročník)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Day of week */}
            <div className="space-y-2">
              <Label>Den v týdnu</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyber den" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {DAY_NAMES_CS[day]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time - stack on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Od</Label>
                <TimePicker value={startTime} onChange={handleStartTimeChange} hourOnly />
              </div>
              <div className="space-y-2">
                <Label>Do (automaticky +4h)</Label>
                <TimePicker value={endTime} onChange={setEndTime} minTime={startTime} hourOnly />
              </div>
            </div>

            {/* Valid from */}
            <div className="space-y-2">
              <Label>Platnost od</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !validFrom && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {validFrom ? format(validFrom, "PPP", { locale: cs }) : "Vyber datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={validFrom}
                    onSelect={setValidFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Valid until */}
            <div className="space-y-2">
              <Label>Platnost do</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !validUntil && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {validUntil ? format(validUntil, "PPP", { locale: cs }) : "Vyber datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={validUntil}
                    onSelect={setValidUntil}
                    disabled={(date) => validFrom ? date < validFrom : false}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            {/* Submit */}
            <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
              {isLoading ? "Ukládám..." : submitLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hint for drag & drop */}
      <p className="text-xs text-muted-foreground">
        Tip: Přetáhni TS na jinou místnost pro přesun. Klikni pro úpravu.
      </p>

      {/* List of existing schedules by room */}
      {schedulesByRoom.map(({ room, schedules: roomSchedules }) => (
        <div 
          key={room.id} 
          className={cn(
            "space-y-3 p-3 rounded-lg border-2 border-dashed transition-colors",
            dragOverRoomId === room.id && draggedSchedule?.room_id !== room.id
              ? "border-primary bg-primary/5"
              : "border-transparent"
          )}
          onDragOver={(e) => handleDragOver(e, room.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, room.id)}
        >
          <h4 className="font-medium text-sm text-muted-foreground">{room.name}</h4>
          {roomSchedules.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">
              {draggedSchedule ? "Přetáhni sem pro přesun" : "Žádné TS"}
            </p>
          ) : (
            <div className="space-y-2">
              {roomSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, schedule)}
                  onDragEnd={handleDragEnd}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onClick={(e) => handleClick(e, schedule)}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card cursor-pointer hover:bg-accent/50 transition-colors gap-3",
                    draggedSchedule?.id === schedule.id && "opacity-50"
                  )}
                >
                  <div className="flex items-start sm:items-center gap-3 flex-wrap">
                    <GripVertical className="size-4 text-muted-foreground cursor-grab flex-shrink-0 hidden sm:block" />
                    <Badge variant="secondary" className="text-xs">
                      {DAY_NAMES_CS[schedule.day_of_week]}
                    </Badge>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="size-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs sm:text-sm">{schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="size-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs sm:text-sm">{schedule.team?.name}</span>
                    </div>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                      {format(new Date(schedule.valid_from), "d.M.yyyy")}
                      {schedule.valid_until
                        ? ` - ${format(new Date(schedule.valid_until), "d.M.yyyy")}`
                        : " –"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 self-end sm:self-auto">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => { e.stopPropagation(); openEditDialog(schedule); }}
                      title="Upravit"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => { e.stopPropagation(); openEditDialog(schedule, true); }}
                      title="Duplikovat"
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(schedule); }}
                      className="text-destructive hover:text-destructive"
                      title="Smazat"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat Training Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Opravdu chceš smazat Training Session pro tým &quot;
              {deleteTarget?.team?.name}&quot;? Tato akce nelze vrátit zpět.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne, ponechat</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
            >
              Ano, smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
