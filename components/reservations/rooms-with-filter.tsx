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

  const handleFilterChange = (newRooms: RoomWithStatus[]) => {
    setFilteredRooms(newRooms);
  };

  // Check if filter is active (any room has availabilityForFilter set)
  const hasActiveFilter = filteredRooms.some(r => r.availabilityForFilter !== undefined);
  
  // Count available rooms when filter is active
  const availableCount = filteredRooms.filter(
    r => !r.availabilityForFilter || r.availabilityForFilter.isAvailable
  ).length;

  return (
    <div className="space-y-4">
      <RoomFilter rooms={rooms} onFilterChange={handleFilterChange} />
      
      {/* Results Counter */}
      {hasActiveFilter && (
        <div className="text-sm text-muted-foreground px-1">
          {availableCount} volné z {rooms.length} místností
        </div>
      )}
      
      <RoomList rooms={filteredRooms} />
    </div>
  );
}
