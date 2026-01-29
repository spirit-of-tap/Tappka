"use client";

import { useState } from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TimePicker } from "./time-picker";
import type { RoomWithStatus } from "@/lib/reservations/types";
import { isRoomAvailableOnDay } from "@/lib/reservations/utils";

interface RoomFilterProps {
  rooms: RoomWithStatus[];
  onFilterChange: (filteredRooms: RoomWithStatus[]) => void;
}

/**
 * Filter component to find rooms available at a specific time
 */
export function RoomFilter({ rooms, onFilterChange }: RoomFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);

  const handleApply = async () => {
    if (!date || !startTime || !endTime) {
      return;
    }

    setIsFiltering(true);

    try {
      // Build datetime range
      const [startH, startM] = startTime.split(":").map(Number);
      const [endH, endM] = endTime.split(":").map(Number);

      const startDateTime = new Date(date);
      startDateTime.setHours(startH, startM, 0, 0);

      const endDateTime = new Date(date);
      endDateTime.setHours(endH, endM, 0, 0);

      // Fetch busy rooms from API
      const response = await fetch(
        `/api/reservations?start_date=${startDateTime.toISOString()}&end_date=${endDateTime.toISOString()}`
      );
      const result = await response.json();
      const reservations = result.data || [];

      // Get list of busy room IDs
      const busyRoomIds = new Set(reservations.map((r: { room_id: string }) => r.room_id));

      // Filter rooms
      const availableRooms = rooms.filter((room) => {
        // Check if room is available on this day
        if (!isRoomAvailableOnDay(room, date)) {
          return false;
        }
        // Check if room has no conflicting reservations
        return !busyRoomIds.has(room.id);
      });

      onFilterChange(availableRooms);
      setIsOpen(false);
    } catch (error) {
      console.error("Error filtering rooms:", error);
    } finally {
      setIsFiltering(false);
    }
  };

  const handleClear = () => {
    setDate(undefined);
    setStartTime("");
    setEndTime("");
    onFilterChange(rooms);
    setIsOpen(false);
  };

  const hasFilter = date && startTime && endTime;

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant={hasFilter ? "default" : "outline"} size="sm">
            <Filter className="size-4 mr-2" />
            {hasFilter ? (
              <>
                {format(date, "d.M.", { locale: cs })} {startTime} - {endTime}
              </>
            ) : (
              "Filtrovat podle času"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Datum</label>
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Od</label>
                <TimePicker
                  value={startTime}
                  onChange={setStartTime}
                  placeholder="Začátek"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Do</label>
                <TimePicker
                  value={endTime}
                  onChange={setEndTime}
                  minTime={startTime}
                  placeholder="Konec"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleClear}
              >
                Vymazat
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleApply}
                disabled={!date || !startTime || !endTime || isFiltering}
              >
                {isFiltering ? "Hledám..." : "Najít volné"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {hasFilter && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleClear}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
