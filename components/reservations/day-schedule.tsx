"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Users, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  OPERATING_HOURS, 
  RESERVATION_TYPE_LABELS,
  TIME_SLOT_MINUTES,
  type Reservation,
  type ScheduleBreak,
} from "@/lib/reservations/types";
import { formatTime, isReservationActive, getReservationColorClasses } from "@/lib/reservations/utils";

interface DayScheduleProps {
  date: Date;
  reservations: Reservation[];
  scheduleBreak?: ScheduleBreak | null;
  onSlotClick?: (startTime: Date) => void;
  onReservationClick?: (reservation: Reservation) => void;
  onDragCreate?: (startTime: Date, endTime: Date) => void;
}

/**
 * Visual schedule showing reservations for a single day
 * Supports drag-to-create for quick reservation creation
 */
export function DaySchedule({ date, reservations, scheduleBreak, onSlotClick, onReservationClick, onDragCreate }: DayScheduleProps) {
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null); // Start position in pixels
  const [dragEnd, setDragEnd] = useState<number | null>(null); // End position in pixels
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);
  const scheduleRef = useRef<HTMLDivElement>(null);

  // Generate hour slots
  const hours = useMemo(() => {
    const result: number[] = [];
    for (let h = OPERATING_HOURS.start; h < OPERATING_HOURS.end; h++) {
      result.push(h);
    }
    return result;
  }, []);

  // Calculate pixel height per hour (60px per hour)
  const hourHeight = 60;
  const slotHeight = hourHeight / (60 / TIME_SLOT_MINUTES); // 15px per 15min slot

  // Position reservations
  const positionedReservations = useMemo(() => {
    return reservations
      .filter((r) => r.status === "active")
      .map((reservation) => {
        const start = new Date(reservation.start_time);
        const end = new Date(reservation.end_time);

        // Calculate position from operating hours start
        const startHour = start.getHours() + start.getMinutes() / 60;
        const endHour = end.getHours() + end.getMinutes() / 60;

        const top = (startHour - OPERATING_HOURS.start) * hourHeight;
        const height = (endHour - startHour) * hourHeight;

        return {
          reservation,
          top,
          height,
          isActive: isReservationActive(reservation),
        };
      });
  }, [reservations]);

  // Convert pixel position to time
  const pixelToTime = useCallback((pixelY: number): Date => {
    // Snap to 15-minute slots
    const slotIndex = Math.floor(pixelY / slotHeight);
    const totalMinutes = OPERATING_HOURS.start * 60 + slotIndex * TIME_SLOT_MINUTES;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    const time = new Date(date);
    time.setHours(Math.min(hours, OPERATING_HOURS.end), minutes, 0, 0);
    return time;
  }, [date, slotHeight]);

  // Get relative Y position within the schedule area
  const getRelativeY = useCallback((clientY: number): number => {
    if (!scheduleRef.current) return 0;
    const rect = scheduleRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    // Clamp to valid range
    const maxY = (OPERATING_HOURS.end - OPERATING_HOURS.start) * hourHeight;
    return Math.max(0, Math.min(relativeY, maxY));
  }, [hourHeight]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag if clicking on a reservation
    if ((e.target as HTMLElement).closest('[data-reservation]')) return;
    
    const y = getRelativeY(e.clientY);
    setIsDragging(true);
    setDragStart(y);
    setDragEnd(y);
  }, [getRelativeY]);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't start drag if touching on a reservation
    if ((e.target as HTMLElement).closest('[data-reservation]')) return;
    
    const touch = e.touches[0];
    const y = getRelativeY(touch.clientY);
    
    // Store initial position
    setDragStart(y);
    
    // Start long press timer (400ms)
    const timer = setTimeout(() => {
      setIsLongPress(true);
      setIsDragging(true);
      setDragEnd(y);
      // Haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, 400);
    
    setLongPressTimer(timer);
  }, [getRelativeY]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // If long press timer is still pending, cancel it on any movement
    if (longPressTimer && !isLongPress) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
      setDragStart(null);
      // Allow normal scrolling
      return;
    }
    
    // Only handle drag if we're actively in long-press drag mode
    if (isLongPress && isDragging) {
      e.preventDefault(); // Prevent scrolling while dragging
      const touch = e.touches[0];
      const y = getRelativeY(touch.clientY);
      setDragEnd(y);
    }
  }, [getRelativeY, longPressTimer, isLongPress, isDragging]);

  const handleTouchEnd = useCallback(() => {
    // Clear long press timer if it's still pending
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    // If we were actively dragging after long press, finalize the drag
    if (isLongPress && isDragging && dragStart !== null && dragEnd !== null) {
      const startY = Math.min(dragStart, dragEnd);
      const endY = Math.max(dragStart, dragEnd);
      
      const startTime = pixelToTime(startY);
      const endTime = pixelToTime(endY + slotHeight);
      onDragCreate?.(startTime, endTime);
    }
    // Note: We don't trigger click on short tap in touch mode
    // Users can tap the hour slots directly for single clicks
    
    // Reset all state
    setIsDragging(false);
    setIsLongPress(false);
    setDragStart(null);
    setDragEnd(null);
  }, [longPressTimer, isLongPress, isDragging, dragStart, dragEnd, slotHeight, pixelToTime, onDragCreate]);

  // Global mouse handlers for drag that continues outside the component
  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const y = getRelativeY(e.clientY);
    setDragEnd(y);
  }, [isDragging, getRelativeY]);

  const handleGlobalMouseUp = useCallback(() => {
    if (!isDragging || dragStart === null || dragEnd === null) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    const startY = Math.min(dragStart, dragEnd);
    const endY = Math.max(dragStart, dragEnd);
    
    // Minimum drag distance (at least one slot)
    if (endY - startY < slotHeight / 2) {
      // Treat as click
      const clickTime = pixelToTime(startY);
      onSlotClick?.(clickTime);
    } else {
      // Treat as drag - create reservation
      const startTime = pixelToTime(startY);
      const endTime = pixelToTime(endY + slotHeight);
      onDragCreate?.(startTime, endTime);
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, slotHeight, pixelToTime, onSlotClick, onDragCreate]);

  // Add global event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, handleGlobalMouseMove, handleGlobalMouseUp]);

  // Clean up long press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  // Calculate drag selection preview
  const dragSelection = useMemo(() => {
    if (!isDragging || dragStart === null || dragEnd === null) return null;
    
    const startY = Math.min(dragStart, dragEnd);
    const endY = Math.max(dragStart, dragEnd);
    const height = endY - startY + slotHeight;
    
    const startTime = pixelToTime(startY);
    const endTime = pixelToTime(endY + slotHeight);
    
    return {
      top: startY,
      height,
      startTime,
      endTime,
    };
  }, [isDragging, dragStart, dragEnd, slotHeight, pixelToTime]);

  const handleSlotClick = (hour: number) => {
    if (!onSlotClick || isDragging) return;
    const clickedTime = new Date(date);
    clickedTime.setHours(hour, 0, 0, 0);
    onSlotClick(clickedTime);
  };

  return (
    <div className="relative border rounded-lg overflow-hidden bg-card">
      {/* Schedule break banner */}
      {scheduleBreak && (
        <div className="bg-emerald-100 dark:bg-emerald-900/50 px-3 py-2 border-b">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            {scheduleBreak.break_type === "days_of_joy" ? "🎉 Days of Joy" : 
             scheduleBreak.break_type === "holiday" ? "📅 Volno" : "📋 Výjimka"}: {scheduleBreak.name}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Místnosti jsou volné pro běžné rezervace
          </p>
        </div>
      )}

      {/* Time labels and grid */}
      <div className="flex">
        {/* Time column - responsive width */}
        <div className="flex-shrink-0 w-12 md:w-16 border-r bg-muted/30">
          {hours.map((hour) => (
            <div
              key={hour}
              className="h-[60px] border-b last:border-b-0 flex items-start justify-end pr-1 md:pr-2 pt-1"
            >
              <span className="text-[10px] md:text-xs text-muted-foreground">
                {hour.toString().padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        {/* Schedule area */}
        <div 
          ref={scheduleRef}
          className={cn(
            "flex-1 relative select-none",
            isDragging && "cursor-grabbing"
          )}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Hour grid lines */}
          {hours.map((hour) => (
            <div
              key={hour}
              className={cn(
                "h-[60px] border-b last:border-b-0 transition-colors",
                !isDragging && "hover:bg-muted/30 cursor-pointer"
              )}
              onClick={() => handleSlotClick(hour)}
            />
          ))}

          {/* Drag selection preview */}
          {dragSelection && (
            <div
              className={cn(
                "absolute left-0 right-2 mx-2 rounded-md border-2 border-primary border-dashed pointer-events-none z-10",
                isLongPress ? "bg-primary/30 animate-pulse" : "bg-primary/20"
              )}
              style={{ 
                top: `${dragSelection.top}px`, 
                height: `${Math.max(dragSelection.height, 20)}px` 
              }}
            >
              <div className="px-2 py-1 text-sm font-medium text-primary">
                {formatTime(dragSelection.startTime.toISOString())} - {formatTime(dragSelection.endTime.toISOString())}
              </div>
            </div>
          )}

          {/* Reservations */}
          {positionedReservations.map(({ reservation, top, height, isActive }) => (
            <ReservationBlock
              key={reservation.id}
              reservation={reservation}
              top={top}
              height={height}
              isActive={isActive}
              onClick={() => onReservationClick?.(reservation)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ReservationBlockProps {
  reservation: Reservation;
  top: number;
  height: number;
  isActive: boolean;
  onClick?: () => void;
}

function ReservationBlock({ reservation, top, height, isActive, onClick }: ReservationBlockProps) {
  const bgColor = getReservationColorClasses(reservation.reservation_type);

  return (
    <div
      data-reservation
      className={cn(
        "absolute left-0 right-2 mx-2 rounded-md px-2 py-1 overflow-hidden",
        "border-l-4 shadow-sm cursor-pointer hover:opacity-90 transition-opacity",
        bgColor,
        isActive && "ring-2 ring-primary ring-offset-1"
      )}
      style={{ top: `${top}px`, height: `${Math.max(height - 2, 20)}px` }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{reservation.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatTime(reservation.start_time)} - {formatTime(reservation.end_time)}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {reservation.is_cowork_open && (
            <Share2 className="size-3 text-muted-foreground" />
          )}
          {reservation.person_count && height > 40 && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Users className="size-3" />
              {reservation.person_count}
            </span>
          )}
        </div>
      </div>
      {height > 50 && (
        <Badge variant="outline" className="mt-1 text-xs">
          {RESERVATION_TYPE_LABELS[reservation.reservation_type]}
        </Badge>
      )}
    </div>
  );
}
