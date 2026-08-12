"use client";

import { useState } from "react";
import { addDays, addWeeks, subWeeks, startOfWeek, format, isSameDay } from "date-fns";
import { cs } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DaySchedule } from "./day-schedule";
import { WeekSchedule } from "./week-schedule";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ReservationWithDetails, ScheduleBreak } from "@/lib/reservations/types";
import { DAY_NAMES_CS } from "@/lib/reservations/types";

interface CalendarViewProps {
  reservations: ReservationWithDetails[];
  scheduleBreaks?: ScheduleBreak[];
  availableDays?: number[] | null; // 0=Sunday, 1=Monday, etc.
  initialDate?: Date; // Date to start the calendar on
  onSlotClick?: (startTime: Date) => void;
  onReservationClick?: (reservation: ReservationWithDetails) => void;
  onDragCreate?: (startTime: Date, endTime: Date) => void;
}

type ViewMode = "day" | "week";

/**
 * Calendar component with day/week toggle
 */
export function CalendarView({ reservations, scheduleBreaks = [], availableDays, initialDate, onSlotClick, onReservationClick, onDragCreate }: CalendarViewProps) {
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Use a lazy initializer to pick the right default on first render,
    // avoiding the redundant mount-time flip caused by the useEffect below.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
      return "day";
    }
    return "week";
  });
  const [currentDate, setCurrentDate] = useState(() => {
    // Use initialDate if provided (from URL param)
    if (initialDate) {
      return initialDate;
    }
    // If room has limited available days, start on the nearest available day
    if (availableDays && availableDays.length > 0) {
      const today = new Date();
      const todayDay = today.getDay();
      if (!availableDays.includes(todayDay)) {
        // Find next available day
        for (let i = 1; i <= 7; i++) {
          const nextDate = addDays(today, i);
          if (availableDays.includes(nextDate.getDay())) {
            return nextDate;
          }
        }
      }
    }
    return new Date();
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [syncedInitialDate, setSyncedInitialDate] = useState(initialDate);

  // Sync when parent navigates to a different date (e.g. URL param change)
  if (
    initialDate &&
    initialDate.getTime() !== syncedInitialDate?.getTime()
  ) {
    setSyncedInitialDate(initialDate);
    setCurrentDate(initialDate);
  }

  const effectiveViewMode: ViewMode = isMobile ? "day" : viewMode;

  const today = new Date();
  const isToday = isSameDay(currentDate, today);

  // Find next/prev available day when room has limited days
  const findNextAvailableDay = (from: Date, direction: 1 | -1): Date => {
    if (!availableDays || availableDays.length === 0) {
      return addDays(from, direction);
    }
    
    let nextDate = addDays(from, direction);
    // Search up to 7 days
    for (let i = 0; i < 7; i++) {
      if (availableDays.includes(nextDate.getDay())) {
        return nextDate;
      }
      nextDate = addDays(nextDate, direction);
    }
    return nextDate; // Fallback
  };

  const handlePrev = () => {
    if (effectiveViewMode === "day") {
      setCurrentDate((d) => findNextAvailableDay(d, -1));
    } else {
      setCurrentDate((d) => subWeeks(d, 1));
    }
  };

  const handleNext = () => {
    if (effectiveViewMode === "day") {
      setCurrentDate((d) => findNextAvailableDay(d, 1));
    } else {
      setCurrentDate((d) => addWeeks(d, 1));
    }
  };

  const handleToday = () => {
    // Find nearest available day from today
    if (availableDays && availableDays.length > 0) {
      const todayDate = new Date();
      if (availableDays.includes(todayDate.getDay())) {
        setCurrentDate(todayDate);
      } else {
        setCurrentDate(findNextAvailableDay(todayDate, 1));
      }
    } else {
      setCurrentDate(new Date());
    }
  };

  const handleSlotClick = (date: Date, hour?: number) => {
    if (hour !== undefined) {
      const clickedTime = new Date(date);
      clickedTime.setHours(hour, 0, 0, 0);
      onSlotClick?.(clickedTime);
    } else {
      onSlotClick?.(date);
    }
  };

  // Format the current date for the picker button
  const datePickerLabel = effectiveViewMode === "day"
    ? format(currentDate, "d. MMMM yyyy", { locale: cs })
    : (() => {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);
        return `${format(weekStart, "d.M.")} - ${format(weekEnd, "d.M. yyyy")}`;
      })();

  // Day name for display above the picker (only in day view)
  const dayName = effectiveViewMode === "day" 
    ? format(currentDate, "EEEE", { locale: cs })
    : null;

  // "Go to today" button logic - changes for rooms with limited days
  const hasLimitedDays = availableDays && availableDays.length > 0;
  const todayIsAvailable = !hasLimitedDays || availableDays.includes(today.getDay());
  
  // Calculate the nearest available day for the button
  const nearestAvailableDay = (() => {
    if (!hasLimitedDays) return today;
    if (todayIsAvailable) return today;
    // Find next available day
    for (let i = 1; i <= 7; i++) {
      const nextDate = addDays(today, i);
      if (availableDays.includes(nextDate.getDay())) {
        return nextDate;
      }
    }
    return today;
  })();

  const isOnNearestAvailable = isSameDay(currentDate, nearestAvailableDay);
  
  // Button text: "Přesunout na dnes" or "Nejbližší [day name]"
  const goToButtonText = hasLimitedDays && !todayIsAvailable
    ? `Nejbližší ${DAY_NAMES_CS[nearestAvailableDay.getDay()].toLowerCase()}`
    : "Přesunout na dnes";

  // Handle date selection from calendar picker
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentDate(date);
      setCalendarOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* View mode toggle - hide week tab on mobile */}
        {!isMobile && (
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            {/* A true either/or over the same content, so it stays a segmented
                toggle rather than becoming section navigation. */}
            <TabsList variant="segmented">
              <TabsTrigger value="day">Den</TabsTrigger>
              <TabsTrigger value="week">Týden</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Date navigation with calendar picker */}
        <div className="flex flex-col items-center gap-1 flex-1 md:flex-initial">
          {/* Day name above (only in day view) */}
          {dayName && (
            <span className="text-sm font-medium text-muted-foreground capitalize">
              {dayName}
            </span>
          )}
          
          <div className="flex items-center gap-1 w-full md:w-auto">
            <Button variant="outline" size="icon" onClick={handlePrev}>
              <ChevronLeft className="size-4" />
            </Button>
            
            {/* Calendar picker */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn(
                    "flex-1 md:min-w-[180px] justify-center font-normal",
                    !isToday && "text-foreground"
                  )}
                >
                  <CalendarDays className="size-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{datePickerLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={currentDate}
                  onSelect={handleDateSelect}
                  defaultMonth={currentDate}
                  locale={cs}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <Button variant="outline" size="icon" onClick={handleNext}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Go to today/nearest available button */}
        <Button 
          variant={isOnNearestAvailable ? "ghost" : "outline"} 
          size="sm" 
          onClick={handleToday}
          disabled={isOnNearestAvailable}
          className="gap-2 w-full md:w-auto"
        >
          <RotateCcw className="size-4" />
          {goToButtonText}
        </Button>
      </div>

      {/* Calendar view */}
      {effectiveViewMode === "day" ? (
        <DaySchedule
          date={currentDate}
          reservations={reservations.filter((r) => {
            const start = new Date(r.start_at);
            return (
              start.getFullYear() === currentDate.getFullYear() &&
              start.getMonth() === currentDate.getMonth() &&
              start.getDate() === currentDate.getDate()
            );
          })}
          scheduleBreak={scheduleBreaks.find((b) => {
            const dateStr = format(currentDate, "yyyy-MM-dd");
            return dateStr >= b.start_date && dateStr <= b.end_date;
          })}
          onSlotClick={(time) => onSlotClick?.(time)}
          onReservationClick={onReservationClick}
          onDragCreate={onDragCreate}
        />
      ) : (
        <WeekSchedule
          startDate={currentDate}
          reservations={reservations}
          scheduleBreaks={scheduleBreaks}
          availableDays={availableDays}
          onSlotClick={handleSlotClick}
          onReservationClick={onReservationClick}
          onDragCreate={onDragCreate}
        />
      )}
    </div>
  );
}
