"use client";

import { useState, useEffect } from "react";
import { format, addMinutes } from "date-fns";
import { cs } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TimePicker } from "./time-picker";
import type { RoomWithStatus } from "@/lib/reservations/types";
import { isRoomAvailableOnDay } from "@/lib/reservations/utils";

export interface FilterState {
  date: Date;
  startTime: string;
  duration: string | null;
}

interface RoomFilterProps {
  rooms: RoomWithStatus[];
  onFilterChange: (filteredRooms: RoomWithStatus[]) => void;
  onFilterStateChange?: (state: FilterState) => void;
}

// Duration options in minutes
const DURATION_OPTIONS = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '1 hod' },
  { value: '90', label: '1,5 hod' },
  { value: '120', label: '2 hod' },
  { value: '180', label: '3 hod' },
  { value: '240', label: '4 hod' },
];

/**
 * Inline filter component with instant feedback
 */
export function RoomFilter({ rooms, onFilterChange, onFilterStateChange }: RoomFilterProps) {
  const [filterDate, setFilterDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState<string>(() => {
    // Default to current time rounded to next 15min slot
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    now.setMinutes(roundedMinutes, 0, 0);
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });
  const [duration, setDuration] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  // Auto-update when filter changes
  useEffect(() => {
    const checkAvailability = async () => {
      // If no duration selected, show all rooms (no filter)
      if (duration === null) {
        onFilterChange(rooms.map(room => ({ ...room, availabilityForFilter: undefined })));
        return;
      }

      try {
        // Parse start time
        const [hours, minutes] = startTime.split(':').map(Number);
        const startDateTime = new Date(filterDate);
        startDateTime.setHours(hours, minutes, 0, 0);

        // Calculate end time
        const durationMinutes = parseInt(duration);
        const endDateTime = addMinutes(startDateTime, durationMinutes);

        // Fetch busy rooms from API
        const response = await fetch(
          `/api/reservations?start_date=${startDateTime.toISOString()}&end_date=${endDateTime.toISOString()}`
        );
        const result = await response.json();
        const reservations = result.data || [];

        // Annotate rooms with availability
        const annotatedRooms = rooms.map((room) => {
          const isDayAvailable = isRoomAvailableOnDay(room, startDateTime);
          const conflictingReservation = reservations.find(
            (r: { room_id: string; start_time: string; end_time: string; title: string }) => 
              r.room_id === room.id
          );

          // Room is available if it's open on this day AND no conflicts
          const isAvailable = isDayAvailable && !conflictingReservation;

          if (isAvailable) {
            return { ...room, availabilityForFilter: undefined };
          }

          // Room is unavailable - add metadata explaining why
          const reason = !isDayAvailable ? 'day_restricted' : 'occupied';
          
          let conflictTime: string | undefined;
          let conflictTitle: string | undefined;
          
          if (conflictingReservation) {
            const formatTime = (timeStr: string) => {
              const d = new Date(timeStr);
              return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            };
            
            conflictTime = `${formatTime(conflictingReservation.start_time)}-${formatTime(conflictingReservation.end_time)}`;
            conflictTitle = conflictingReservation.title;
          }

          return {
            ...room,
            availabilityForFilter: {
              isAvailable: false,
              reason: reason as 'occupied' | 'day_restricted',
              conflictTime,
              conflictTitle,
            },
          };
        });

        onFilterChange(annotatedRooms);
      } catch (error) {
        console.error("Error filtering rooms:", error);
      }
    };

    // Debounce API calls
    const debounced = setTimeout(checkAvailability, 300);
    return () => clearTimeout(debounced);
  }, [filterDate, startTime, duration, rooms, onFilterChange]);

  // Notify parent of filter state changes
  useEffect(() => {
    onFilterStateChange?.({ date: filterDate, startTime, duration });
  }, [filterDate, startTime, duration, onFilterStateChange]);

  const handleClear = () => {
    setFilterDate(new Date());
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    now.setMinutes(roundedMinutes, 0, 0);
    setStartTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    setDuration(null);
  };

  const hasFilter = duration !== null;
  const now = new Date();
  const isToday = format(filterDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = format(filterDate, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd');

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border">
      {/* Date Selection */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          Datum:
        </label>
        <div className="flex gap-1">
          <Button
            variant={isToday ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterDate(new Date())}
            className="h-8"
          >
            Dnes
          </Button>
          <Button
            variant={isTomorrow ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterDate(tomorrow)}
            className="h-8"
          >
            Zítra
          </Button>
          <Popover open={showCalendar} onOpenChange={setShowCalendar}>
            <PopoverTrigger asChild>
              <Button
                variant={!isToday && !isTomorrow ? "default" : "outline"}
                size="sm"
                className="h-8"
              >
                <CalendarIcon className="size-4 mr-1" />
                {!isToday && !isTomorrow && format(filterDate, "d.M.", { locale: cs })}
                {(isToday || isTomorrow) && "Jiný"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filterDate}
                onSelect={(date) => {
                  if (date) {
                    setFilterDate(date);
                    setShowCalendar(false);
                  }
                }}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Time Picker */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          Čas:
        </label>
        <div className="w-[140px]">
          <TimePicker
            value={startTime}
            onChange={setStartTime}
            placeholder="Začátek"
          />
        </div>
      </div>

      {/* Duration Dropdown */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          Délka:
        </label>
        <Select value={duration || ''} onValueChange={(val) => setDuration(val || null)}>
          <SelectTrigger size="sm" className="w-[120px] h-8">
            <SelectValue placeholder="Vybrat..." />
          </SelectTrigger>
          <SelectContent>
            {DURATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Spacer to push buttons to the right */}
      <div className="flex-1 min-w-[20px]" />

      {/* Clear Filter */}
      {hasFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-8"
        >
          <X className="size-4 mr-1" />
          Zrušit filtr
        </Button>
      )}
    </div>
  );
}
