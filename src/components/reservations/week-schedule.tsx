"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { addDays, format, startOfWeek, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import {
  OPERATING_HOURS,
  DAY_NAMES_CS,
  TIME_SLOT_MINUTES,
  type ReservationWithDetails,
  type ScheduleBreak,
} from "@/lib/reservations/types";
import { formatTime, isReservationActive, getReservationColorClasses, inferReservationKind } from "@/lib/reservations/utils";

interface WeekScheduleProps {
  startDate: Date;
  reservations: ReservationWithDetails[];
  scheduleBreaks?: ScheduleBreak[];
  availableDays?: number[] | null; // 0=Sunday, 1=Monday, etc.
  onSlotClick?: (date: Date, hour: number) => void;
  onReservationClick?: (reservation: ReservationWithDetails) => void;
  onDragCreate?: (startTime: Date, endTime: Date) => void;
}

/**
 * Weekly schedule view showing reservations across 7 days
 */
export function WeekSchedule({ startDate, reservations, scheduleBreaks = [], availableDays, onSlotClick, onReservationClick, onDragCreate }: WeekScheduleProps) {
  // Generate week days
  const weekStart = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Generate hour slots
  const hours = useMemo(() => {
    const result: number[] = [];
    for (let h = OPERATING_HOURS.start; h < OPERATING_HOURS.end; h++) {
      result.push(h);
    }
    return result;
  }, []);

  // Group reservations by day
  const reservationsByDay = useMemo(() => {
    const map = new Map<string, ReservationWithDetails[]>();
    weekDays.forEach((day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      const dayReservations = reservations.filter((r) => {
        const start = new Date(r.start_at);
        return isSameDay(start, day);
      });
      map.set(dayKey, dayReservations);
    });
    return map;
  }, [weekDays, reservations]);

  const hourHeight = 48; // px per hour
  const slotHeight = hourHeight / (60 / TIME_SLOT_MINUTES); // 12px per 15 min slot
  const today = new Date();

  // Current time indicator — updates every minute
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragDayIndex, setDragDayIndex] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const dayRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Check if a date falls within any schedule break
  const getBreakForDate = (date: Date): ScheduleBreak | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    return scheduleBreaks.find((b) => dateStr >= b.start_date && dateStr <= b.end_date);
  };

  // Check if a day is available for this room
  const isDayAvailable = (date: Date): boolean => {
    if (!availableDays || availableDays.length === 0) return true;
    return availableDays.includes(date.getDay());
  };

  // Convert pixel position to time
  const pixelToTime = useCallback((day: Date, pixelY: number): Date => {
    const totalHeight = (OPERATING_HOURS.end - OPERATING_HOURS.start) * hourHeight;
    
    // Clamp pixelY
    const clampedY = Math.max(0, Math.min(pixelY, totalHeight));
    
    // Snap to 15-minute slots
    const slotIndex = Math.floor(clampedY / slotHeight);
    const totalMinutes = OPERATING_HOURS.start * 60 + slotIndex * TIME_SLOT_MINUTES;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    const time = new Date(day);
    time.setHours(Math.min(hours, OPERATING_HOURS.end), minutes, 0, 0);
    return time;
  }, [slotHeight, hourHeight]);

  // Get relative Y position within a day column
  const getRelativeY = useCallback((dayIndex: number, clientY: number): number => {
    const dayEl = dayRefs.current[dayIndex];
    if (!dayEl) return 0;
    const rect = dayEl.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const maxY = (OPERATING_HOURS.end - OPERATING_HOURS.start) * hourHeight;
    return Math.max(0, Math.min(relativeY, maxY));
  }, [hourHeight]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, dayIndex: number) => {
    // Don't start drag if clicking on a reservation
    if ((e.target as HTMLElement).closest('[data-reservation]')) return;
    
    const y = getRelativeY(dayIndex, e.clientY);
    setIsDragging(true);
    setDragDayIndex(dayIndex);
    setDragStart(y);
    setDragEnd(y);
  }, [getRelativeY]);

  // Global mouse handlers
  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || dragDayIndex === null) return;
    const y = getRelativeY(dragDayIndex, e.clientY);
    setDragEnd(y);
  }, [isDragging, dragDayIndex, getRelativeY]);

  const handleGlobalMouseUp = useCallback(() => {
    if (!isDragging || dragDayIndex === null || dragStart === null || dragEnd === null) {
      setIsDragging(false);
      setDragDayIndex(null);
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    const day = weekDays[dragDayIndex];
    const startY = Math.min(dragStart, dragEnd);
    const endY = Math.max(dragStart, dragEnd);
    
    // Minimum drag distance (at least one slot)
    if (endY - startY < slotHeight / 2) {
      // Treat as click - create 1 hour slot
      const clickTime = pixelToTime(day, startY);
      onSlotClick?.(day, clickTime.getHours());
    } else {
      // Treat as drag - create reservation
      const startTime = pixelToTime(day, startY);
      const endTime = pixelToTime(day, endY + slotHeight);
      onDragCreate?.(startTime, endTime);
    }

    setIsDragging(false);
    setDragDayIndex(null);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragDayIndex, dragStart, dragEnd, weekDays, slotHeight, pixelToTime, onSlotClick, onDragCreate]);

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

  // Calculate drag selection preview
  const dragSelection = useMemo(() => {
    if (!isDragging || dragDayIndex === null || dragStart === null || dragEnd === null) return null;
    
    const day = weekDays[dragDayIndex];
    const startY = Math.min(dragStart, dragEnd);
    const endY = Math.max(dragStart, dragEnd);
    const height = endY - startY + slotHeight;
    
    const startTime = pixelToTime(day, startY);
    const endTime = pixelToTime(day, endY + slotHeight);
    
    return {
      dayIndex: dragDayIndex,
      top: startY,
      height,
      startTime,
      endTime,
    };
  }, [isDragging, dragDayIndex, dragStart, dragEnd, weekDays, slotHeight, pixelToTime]);

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header - Day names */}
      <div className="flex border-b bg-muted/30">
        <div className="w-16 flex-shrink-0 border-r" />
        {weekDays.map((day) => {
          const isToday = isSameDay(day, today);
          const breakInfo = getBreakForDate(day);
          const hasBreak = !!breakInfo;
          const isAvailable = isDayAvailable(day);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex-1 text-center py-2 border-r last:border-r-0",
                isToday && isAvailable && "bg-primary/10",
                hasBreak && isAvailable && "bg-warning/10 border-warning",
                !isAvailable && "bg-muted/60"
              )}
              title={!isAvailable ? "Místnost není v tento den dostupná" : hasBreak ? breakInfo.name : undefined}
            >
              <div className="text-xs text-muted-foreground">
                {DAY_NAMES_CS[day.getDay()]}
              </div>
              <div className={cn(
                "text-sm font-medium",
                isToday && isAvailable && "text-primary",
                !isAvailable && "text-muted-foreground"
              )}>
                {format(day, "d.M.")}
              </div>
              {hasBreak && isAvailable && (
                <div className="text-[10px] text-warning truncate px-1">
                  {breakInfo.name}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex">
        {/* Time column */}
        <div className="w-16 flex-shrink-0 border-r bg-muted/20">
          {hours.map((hour) => (
            <div
              key={hour}
              className="border-b last:border-b-0 flex items-start justify-end pr-2 pt-1"
              style={{ height: `${hourHeight}px` }}
            >
              <span className="text-xs text-muted-foreground">
                {hour.toString().padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDays.map((day, dayIndex) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const dayReservations = reservationsByDay.get(dayKey) || [];
          const isToday = isSameDay(day, today);
          const hasBreak = !!getBreakForDate(day);
          const isAvailable = isDayAvailable(day);

          return (
            <div
              key={day.toISOString()}
              ref={(el) => { dayRefs.current[dayIndex] = el; }}
              className={cn(
                "flex-1 relative border-r last:border-r-0 select-none",
                isAvailable && isToday && "bg-primary/5",
                isAvailable && hasBreak && "bg-warning/10 border-warning",
                !isAvailable && "bg-muted/40 cursor-not-allowed",
                isAvailable && isDragging && dragDayIndex === dayIndex && "cursor-grabbing"
              )}
              onMouseDown={(e) => isAvailable && handleMouseDown(e, dayIndex)}
            >
              {/* Hour grid lines - only for available days */}
              {isAvailable ? (
                hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b last:border-b-0 hover:bg-muted/30 cursor-cell transition-colors"
                    style={{ height: `${hourHeight}px` }}
                  />
                ))
              ) : (
                // Unavailable day - no grid, just solid background
                <div 
                  className="h-full"
                  style={{ height: `${hours.length * hourHeight}px` }}
                />
              )}

              {/* Drag selection preview - only for available days */}
              {isAvailable && dragSelection && dragSelection.dayIndex === dayIndex && (
                <div
                  className="absolute left-0.5 right-0.5 bg-primary/20 border-2 border-dashed border-primary rounded pointer-events-none z-10"
                  style={{
                    top: `${dragSelection.top}px`,
                    height: `${dragSelection.height}px`,
                  }}
                >
                  <div className="text-xs font-medium text-primary p-1">
                    {format(dragSelection.startTime, "HH:mm")} - {format(dragSelection.endTime, "HH:mm")}
                  </div>
                </div>
              )}

              {/* Reservations - only show on available days */}
              {isAvailable && dayReservations.map((reservation) => {
                const start = new Date(reservation.start_at);
                const end = new Date(reservation.end_at);
                const startHour = start.getHours() + start.getMinutes() / 60;
                const endHour = end.getHours() + end.getMinutes() / 60;

                const top = (startHour - OPERATING_HOURS.start) * hourHeight;
                const height = (endHour - startHour) * hourHeight;

                return (
                  <WeekReservationBlock
                    key={reservation.id}
                    reservation={reservation}
                    top={top}
                    height={height}
                    isActive={isReservationActive(reservation)}
                    onClick={() => onReservationClick?.(reservation)}
                  />
                );
              })}

              {/* Current time indicator — only in today's column */}
              {isAvailable && isToday && (() => {
                const nowHour = now.getHours() + now.getMinutes() / 60;
                if (nowHour < OPERATING_HOURS.start || nowHour > OPERATING_HOURS.end) return null;
                const top = (nowHour - OPERATING_HOURS.start) * hourHeight;
                return (
                  <div
                    className="absolute left-0 right-0 pointer-events-none z-20 flex items-center"
                    style={{ top: `${top}px` }}
                  >
                    <div className="size-1.5 rounded-full bg-primary flex-shrink-0" />
                    <div className="flex-1 h-px bg-primary" />
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface WeekReservationBlockProps {
  reservation: ReservationWithDetails;
  top: number;
  height: number;
  isActive: boolean;
  onClick?: () => void;
}

function WeekReservationBlock({ reservation, top, height, isActive, onClick }: WeekReservationBlockProps) {
  const bgColor = getReservationColorClasses(inferReservationKind(reservation));
  const isSmall = height < 40;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  };

  return (
    <div
      data-reservation
      className={cn(
        "absolute left-0.5 right-0.5 rounded px-1 py-0.5 overflow-hidden text-xs",
        "border-l-2 shadow-sm cursor-pointer hover:opacity-90 transition-opacity",
        bgColor,
        isActive && "ring-1 ring-primary"
      )}
      style={{ top: `${top}px`, height: `${Math.max(height - 1, 16)}px` }}
      title={`${reservation.title}\n${formatTime(reservation.start_at)} - ${formatTime(reservation.end_at)}`}
      onClick={handleClick}
    >
      <div className="font-medium truncate">{reservation.title}</div>
      {!isSmall && (
        <div className="text-[10px] opacity-75">
          {formatTime(reservation.start_at)} - {formatTime(reservation.end_at)}
        </div>
      )}
      {!isSmall && reservation.user?.name && (
        <div className="text-[10px] opacity-75 truncate">
          {reservation.user.name}
        </div>
      )}
    </div>
  );
}
