"use client";

import { useState, useCallback } from "react";
import { addMinutes } from "date-fns";
import { RoomList } from "./room-list";
import { RoomFilter, type FilterState } from "./room-filter";
import { QuickReservationDialog } from "./quick-reservation-dialog";
import { Spinner } from "@/components/ui/spinner";
import type { RoomWithStatus } from "@/lib/reservations/types";

interface RoomsWithFilterProps {
  rooms: RoomWithStatus[];
}

/**
 * Client component wrapper that combines room list with filter functionality
 */
export function RoomsWithFilter({ rooms }: RoomsWithFilterProps) {
  const [filteredRooms, setFilteredRooms] = useState<RoomWithStatus[]>(rooms);
  const [filterState, setFilterState] = useState<FilterState | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Dialog state for quick reservation
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomWithStatus | null>(null);
  const [reservationStartTime, setReservationStartTime] = useState<Date | null>(null);
  const [reservationEndTime, setReservationEndTime] = useState<Date | null>(null);

  const handleFilterChange = (newRooms: RoomWithStatus[]) => {
    setFilteredRooms(newRooms);
  };

  const handleFilterStateChange = useCallback((state: FilterState) => {
    setFilterState(state);
  }, []);

  const handleCheckingChange = useCallback((checking: boolean) => {
    setIsChecking(checking);
  }, []);

  // Handle room click - open dialog with prefilled times if filter is active
  const handleRoomClick = useCallback((room: RoomWithStatus) => {
    if (filterState?.duration) {
      // Filter is active - open dialog with prefilled times
      const [hours, minutes] = filterState.startTime.split(":").map(Number);
      const startTime = new Date(filterState.date);
      startTime.setHours(hours, minutes, 0, 0);
      
      const durationMinutes = parseInt(filterState.duration, 10);
      const endTime = addMinutes(startTime, durationMinutes);

      setSelectedRoom(room);
      setReservationStartTime(startTime);
      setReservationEndTime(endTime);
      setDialogOpen(true);
    }
    // If no filter active, the room card will navigate normally via Link
  }, [filterState]);

  // Check if filter is active (duration is selected)
  const hasActiveFilter = filterState?.duration !== null && filterState?.duration !== undefined;
  
  // Count available rooms when filter is active
  const availableCount = filteredRooms.filter(
    r => !r.availabilityForFilter || r.availabilityForFilter.isAvailable
  ).length;

  return (
    <div className="space-y-4">
      <RoomFilter
        rooms={rooms}
        onFilterChange={handleFilterChange}
        onFilterStateChange={handleFilterStateChange}
        onCheckingChange={handleCheckingChange}
      />

      {/* Results Counter */}
      {hasActiveFilter && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
          <span>{availableCount} volné z {rooms.length} místností</span>
          {isChecking && <Spinner className="size-3.5" />}
        </div>
      )}
      
      <RoomList 
        rooms={filteredRooms} 
        filterState={hasActiveFilter ? filterState : null}
        onRoomClick={hasActiveFilter ? handleRoomClick : undefined}
      />

      {/* Quick Reservation Dialog */}
      {selectedRoom && (
        <QuickReservationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          roomId={selectedRoom.id}
          roomName={selectedRoom.name}
          roomCode={selectedRoom.code}
          startTime={reservationStartTime}
          endTime={reservationEndTime}
        />
      )}
    </div>
  );
}
