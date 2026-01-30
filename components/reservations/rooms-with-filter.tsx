"use client";

import { useState } from "react";
import { RoomList } from "./room-list";
import { RoomFilter } from "./room-filter";
import type { RoomWithStatus } from "@/lib/reservations/types";

interface RoomsWithFilterProps {
  rooms: RoomWithStatus[];
}

/**
 * Client component wrapper that combines room list with filter functionality
 */
export function RoomsWithFilter({ rooms }: RoomsWithFilterProps) {
  const [filteredRooms, setFilteredRooms] = useState<RoomWithStatus[]>(rooms);
  const [isFiltered, setIsFiltered] = useState(false);

  const handleFilterChange = (newRooms: RoomWithStatus[]) => {
    setFilteredRooms(newRooms);
    setIsFiltered(newRooms.length !== rooms.length);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <RoomFilter rooms={rooms} onFilterChange={handleFilterChange} />
        {isFiltered && (
          <span className="text-sm text-muted-foreground">
            {filteredRooms.filter(r => !r.availabilityForFilter || r.availabilityForFilter.isAvailable).length} volné z {rooms.length} místností
          </span>
        )}
      </div>
      <RoomList rooms={filteredRooms} />
    </div>
  );
}
