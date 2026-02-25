"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Clock, Users, Share2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "./time-picker";

interface QuickReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  roomName: string;
  roomCode?: string; // URL slug for navigation after submission
  startTime: Date | null;
  endTime: Date | null;
}

/**
 * Quick reservation dialog for drag-to-create reservations
 */
export function QuickReservationDialog({
  open,
  onOpenChange,
  roomId,
  roomName,
  roomCode,
  startTime,
  endTime,
}: QuickReservationDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state - simplified: just reason and person count
  const [reason, setReason] = useState("");
  const [personCount, setPersonCount] = useState(1);
  const [isCoworkOpen, setIsCoworkOpen] = useState(false);
  
  // Editable time state
  const [editableStartTime, setEditableStartTime] = useState("");
  const [editableEndTime, setEditableEndTime] = useState("");
  const [isEditingTime, setIsEditingTime] = useState(false);

  // Sync editable times when props change
  useEffect(() => {
    if (startTime) {
      const hours = startTime.getHours().toString().padStart(2, "0");
      const mins = startTime.getMinutes().toString().padStart(2, "0");
      setEditableStartTime(`${hours}:${mins}`);
    }
    if (endTime) {
      const hours = endTime.getHours().toString().padStart(2, "0");
      const mins = endTime.getMinutes().toString().padStart(2, "0");
      setEditableEndTime(`${hours}:${mins}`);
    }
  }, [startTime, endTime]);

  const resetForm = () => {
    setReason("");
    setPersonCount(1);
    setIsCoworkOpen(false);
    setError(null);
    setIsEditingTime(false);
  };

  const handleSubmit = async () => {
    if (!startTime || !endTime) return;

    if (!reason.trim()) {
      setError("Zadej důvod rezervace");
      return;
    }

    if (personCount < 1) {
      setError("Počet osob musí být alespoň 1");
      return;
    }

    // Build final times from editable values
    const [startHours, startMins] = editableStartTime.split(":").map(Number);
    const [endHours, endMins] = editableEndTime.split(":").map(Number);
    
    const finalStartTime = new Date(startTime);
    finalStartTime.setHours(startHours, startMins, 0, 0);
    
    const finalEndTime = new Date(startTime); // Same date
    finalEndTime.setHours(endHours, endMins, 0, 0);

    if (finalEndTime <= finalStartTime) {
      setError("Čas konce musí být po čase začátku");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          title: reason.trim(), // Use reason as title
          start_time: finalStartTime.toISOString(),
          end_time: finalEndTime.toISOString(),
          person_count: personCount,
          is_cowork_open: isCoworkOpen,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nepodařilo se vytvořit rezervaci");
      }

      toast.success("Rezervace vytvořena");
      // Success
      onOpenChange(false);
      resetForm();
      
      // Navigate to room detail page if roomCode is provided, otherwise just refresh
      if (roomCode) {
        // Include the date param so the calendar shows the reservation date
        const dateStr = format(finalStartTime, "yyyy-MM-dd");
        router.push(`/reservations/${roomCode}?date=${dateStr}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  if (!startTime || !endTime) return null;

  const dateLabel = format(startTime, "EEEE, d. MMMM", { locale: cs });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{roomName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Time selection - always visible */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                {dateLabel}
              </Label>
              {!isEditingTime && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsEditingTime(true)}
                  className="h-7 px-2 text-xs"
                >
                  <Edit2 className="size-3 mr-1" />
                  Upravit čas
                </Button>
              )}
            </div>
            
            {isEditingTime ? (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <TimePicker 
                    value={editableStartTime} 
                    onChange={setEditableStartTime}
                  />
                </div>
                <span className="text-muted-foreground shrink-0">-</span>
                <div className="flex-1">
                  <TimePicker 
                    value={editableEndTime} 
                    onChange={setEditableEndTime}
                    minTime={editableStartTime}
                  />
                </div>
              </div>
            ) : (
              <div 
                className="flex items-center gap-2 p-2 rounded-md bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => setIsEditingTime(true)}
              >
                <span className="font-medium">{editableStartTime} - {editableEndTime}</span>
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Důvod rezervace</Label>
            <Textarea
              id="reason"
              placeholder="Proč potřebuješ místnost?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              autoFocus={!isEditingTime}
            />
          </div>

          {/* Person count and Cowork - responsive layout */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground flex-shrink-0" />
              <Input
                type="number"
                min={1}
                max={50}
                value={personCount}
                onChange={(e) => setPersonCount(parseInt(e.target.value) || 1)}
                className="w-16 h-9"
              />
              <span className="text-sm text-muted-foreground">osob</span>
            </div>

            <div className="flex items-center gap-2 sm:ml-auto">
              <Share2 className="size-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm">Cowork</span>
              <Switch
                checked={isCoworkOpen}
                onCheckedChange={setIsCoworkOpen}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !reason.trim()}
            className="w-full"
          >
            {isLoading ? "Vytvářím..." : "Zarezervovat"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
