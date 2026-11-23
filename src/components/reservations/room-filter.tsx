"use client";

import { useState } from "react";
import { format } from "date-fns";
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

export interface FilterState {
  date: Date;
  startTime: string;
  duration: string | null;
}

interface RoomFilterProps {
  value: FilterState;
  onChange: (state: FilterState) => void;
}

export function getDefaultStartTime(now: Date = new Date()): string {
  const rounded = Math.floor(now.getMinutes() / 15) * 15;
  return `${now.getHours().toString().padStart(2, "0")}:${rounded.toString().padStart(2, "0")}`;
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
  { value: '300', label: '5 hod' },
  { value: '360', label: '6 hod' },
  { value: '420', label: '7 hod' },
  { value: '480', label: '8 hod' },
];

/**
 * Day, start time and window length controls for the room map
 */
export function RoomFilter({ value, onChange }: RoomFilterProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const { date: filterDate, startTime, duration } = value;

  const setDate = (date: Date) => onChange({ ...value, date });

  const handleClear = () =>
    onChange({ date: new Date(), startTime: getDefaultStartTime(), duration: null });

  const hasFilter = duration !== null;
  const now = new Date();
  const isToday = format(filterDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = format(filterDate, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd');

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card px-3 py-2 motion-safe:animate-rise"
      style={{ animationDelay: "60ms" }}>
      {/* Date Selection */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          Datum:
        </label>
        <div className="flex gap-1">
          <Button
            variant={isToday ? "default" : "outline"}
            size="sm"
            onClick={() => setDate(new Date())}
            className="h-8"
          >
            Dnes
          </Button>
          <Button
            variant={isTomorrow ? "default" : "outline"}
            size="sm"
            onClick={() => setDate(tomorrow)}
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
                    setDate(date);
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
        <div className="w-36">
          <TimePicker
            value={startTime}
            onChange={(time) => onChange({ ...value, startTime: time })}
            date={filterDate}
            placeholder="Začátek"
          />
        </div>
      </div>

      {/* Duration Dropdown */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          Délka:
        </label>
        <Select value={duration || ''} onValueChange={(val) => onChange({ ...value, duration: val || null })}>
          <SelectTrigger size="sm" className="w-32 h-8">
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
