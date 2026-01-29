"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { AlertTriangle, ChevronRight, Clock, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatTime } from "@/lib/reservations/utils";
import type { Reservation, Room } from "@/lib/reservations/types";

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflictingReservation: Reservation | null;
  requestedStart: Date | null;
  requestedEnd: Date | null;
  currentRoomName: string;
  alternativeRooms?: Room[];
  onSelectBefore: (endTime: Date) => void;
  onSelectAfter: (startTime: Date) => void;
  onSelectAlternative: (room: Room) => void;
}

/**
 * Dialog for resolving reservation conflicts
 * Offers options: before, after, or alternative rooms
 */
export function ConflictResolutionDialog({
  open,
  onOpenChange,
  conflictingReservation,
  requestedStart,
  requestedEnd,
  currentRoomName,
  alternativeRooms = [],
  onSelectBefore,
  onSelectAfter,
  onSelectAlternative,
}: ConflictResolutionDialogProps) {
  // Calculate available slots before and after the conflict
  const options = useMemo(() => {
    if (!conflictingReservation || !requestedStart || !requestedEnd) {
      return { canBefore: false, canAfter: false, beforeEnd: null, afterStart: null };
    }

    const conflictStart = new Date(conflictingReservation.start_time);
    const conflictEnd = new Date(conflictingReservation.end_time);

    // Can book before? (if requested start is before conflict start)
    const canBefore = requestedStart < conflictStart;
    const beforeEnd = canBefore ? conflictStart : null;

    // Can book after? (if requested end is after conflict end)
    const canAfter = requestedEnd > conflictEnd;
    const afterStart = canAfter ? conflictEnd : null;

    return { canBefore, canAfter, beforeEnd, afterStart };
  }, [conflictingReservation, requestedStart, requestedEnd]);

  if (!conflictingReservation || !requestedStart) return null;

  const conflictStart = new Date(conflictingReservation.start_time);
  const conflictEnd = new Date(conflictingReservation.end_time);
  const dateLabel = format(requestedStart, "EEEE, d. MMMM", { locale: cs });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="size-5" />
            Kolize rezervací
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Conflict info */}
          <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              V čase <strong>{formatTime(requestedStart.toISOString())} - {formatTime(requestedEnd?.toISOString() || "")}</strong> už existuje rezervace:
            </p>
            <div className="mt-2 p-2 rounded bg-white dark:bg-background border">
              <p className="font-medium">{conflictingReservation.title}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" />
                {formatTime(conflictStart)} - {formatTime(conflictEnd)}
              </p>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Možnosti:</p>

            {/* Before option */}
            {options.canBefore && options.beforeEnd && (
              <Button
                variant="outline"
                className="w-full justify-between h-auto py-3"
                onClick={() => onSelectBefore(options.beforeEnd!)}
              >
                <div className="text-left">
                  <p className="font-medium">Rezervovat před</p>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(requestedStart.toISOString())} - {formatTime(options.beforeEnd.toISOString())}
                  </p>
                </div>
                <ChevronRight className="size-4" />
              </Button>
            )}

            {/* After option */}
            {options.canAfter && options.afterStart && (
              <Button
                variant="outline"
                className="w-full justify-between h-auto py-3"
                onClick={() => onSelectAfter(options.afterStart!)}
              >
                <div className="text-left">
                  <p className="font-medium">Rezervovat po</p>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(options.afterStart.toISOString())} - {formatTime(requestedEnd?.toISOString() || "")}
                  </p>
                </div>
                <ChevronRight className="size-4" />
              </Button>
            )}

            {/* Alternative rooms */}
            {alternativeRooms.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Alternativní místnosti:
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {alternativeRooms.slice(0, 4).map((room) => (
                    <Button
                      key={room.id}
                      variant="ghost"
                      className="w-full justify-between h-auto py-2"
                      onClick={() => onSelectAlternative(room)}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 text-muted-foreground" />
                        <span>{room.name}</span>
                      </div>
                      <ChevronRight className="size-4" />
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* No options available */}
            {!options.canBefore && !options.canAfter && alternativeRooms.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Žádné alternativy nejsou k dispozici. Zkus jiný čas.
              </p>
            )}
          </div>

          {/* Close button */}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Zrušit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
