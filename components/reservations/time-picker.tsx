"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { OPERATING_HOURS, TIME_SLOT_MINUTES } from "@/lib/reservations/types";

interface TimePickerProps {
  value: string; // HH:MM format
  onChange: (value: string) => void;
  disabled?: boolean;
  minTime?: string; // HH:MM format
  date?: Date; // The date being picked - used to filter out past times when today
  placeholder?: string;
  hourOnly?: boolean; // Only show full hours (no 15-min intervals)
}

/**
 * Time picker component with 15-minute slots (or hour-only for TS)
 */
export function TimePicker({
  value,
  onChange,
  disabled,
  minTime,
  date,
  placeholder = "Vybrat čas",
  hourOnly = false,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate time slots
  const slots = useMemo(() => {
    const result: string[] = [];
    let hour: number = OPERATING_HOURS.start;
    let minute = 0;
    const increment = hourOnly ? 60 : TIME_SLOT_MINUTES;

    while (hour < OPERATING_HOURS.end || (hour === OPERATING_HOURS.end && minute === 0)) {
      const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      result.push(timeStr);

      minute += increment;
      if (minute >= 60) {
        minute = 0;
        hour++;
      }
    }

    return result;
  }, [hourOnly]);

  // Filter slots based on minTime and current time (when date is today)
  const availableSlots = useMemo(() => {
    const now = new Date();
    const isToday =
      date !== undefined
        ? date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth() &&
          date.getDate() === now.getDate()
        : false;

    // Compute effective floor: the later of minTime and the current time (when today)
    let floor = minTime ?? null;

    if (isToday) {
      // Round current time up to the next slot increment
      const increment = hourOnly ? 60 : TIME_SLOT_MINUTES;
      const totalMinutes = now.getHours() * 60 + now.getMinutes();
      const roundedMinutes = Math.ceil(totalMinutes / increment) * increment;
      const nowHour = Math.floor(roundedMinutes / 60);
      const nowMin = roundedMinutes % 60;
      const nowStr = `${nowHour.toString().padStart(2, "0")}:${nowMin.toString().padStart(2, "0")}`;
      floor = floor === null || nowStr > floor ? nowStr : floor;
    }

    if (floor === null) return slots;
    return slots.filter((slot) => slot >= floor!);
  }, [slots, minTime, date, hourOnly]);

  const handleSelect = (time: string) => {
    onChange(time);
    setOpen(false);
  };

  // Handle wheel scroll manually for better UX
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) {
      e.stopPropagation();
      scrollRef.current.scrollTop += e.deltaY;
    }
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
        >
          {value || placeholder}
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-32 p-0"
        align="start"
        sideOffset={4}
        onWheel={handleWheel}
      >
        <div
          ref={scrollRef}
          className="p-1 max-h-64 overflow-y-auto"
          onWheel={handleWheel}
        >
          {availableSlots.map((slot) => (
            <Button
              key={slot}
              variant={value === slot ? "default" : "ghost"}
              className="w-full justify-start font-mono text-sm h-8"
              onClick={() => handleSelect(slot)}
            >
              {slot}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
