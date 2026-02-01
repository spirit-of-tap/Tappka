"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CalendarView } from "./calendar-view";
import { ReservationDetailDialog } from "./reservation-detail-dialog";
import { QuickReservationDialog } from "./quick-reservation-dialog";
import { ConflictResolutionDialog } from "./conflict-resolution-dialog";
import type { Reservation, ScheduleBreak, Room } from "@/lib/reservations/types";

interface RoomScheduleViewProps {
  reservations: Reservation[];
  scheduleBreaks?: ScheduleBreak[];
  currentUserId?: string;
  roomId: string;
  roomName: string;
  alternativeRooms?: Room[];
  availableDays?: number[] | null; // 0=Sunday, 1=Monday, etc.
}

/**
 * Client-side wrapper for the room schedule calendar
 * Supports drag-to-create reservations with conflict detection
 */
export function RoomScheduleView({
  reservations,
  scheduleBreaks = [],
  currentUserId,
  roomId,
  roomName,
  alternativeRooms = [],
  availableDays,
}: RoomScheduleViewProps) {
  const router = useRouter();
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Quick reservation dialog state
  const [quickDialogOpen, setQuickDialogOpen] = useState(false);
  const [dragStartTime, setDragStartTime] = useState<Date | null>(null);
  const [dragEndTime, setDragEndTime] = useState<Date | null>(null);

  // Conflict resolution dialog state
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictingReservation, setConflictingReservation] = useState<Reservation | null>(null);

  // Auto-generate Houston Calling on mount (only once per session)
  const hcGeneratedRef = useRef(false);
  useEffect(() => {
    if (hcGeneratedRef.current) return;
    hcGeneratedRef.current = true;

    // Trigger HC generation in background (no await, fire and forget)
    fetch("/api/houston-calling/generate", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.created_count > 0) {
          // Refresh the page to show new HC reservations
          router.refresh();
        }
      })
      .catch(() => {
        // Silently ignore errors - HC generation is best-effort
      });
  }, [router]);

  // Check for conflicts with existing reservations
  const findConflict = useCallback((startTime: Date, endTime: Date): Reservation | null => {
    return reservations.find((r) => {
      if (r.status !== "active") return false;
      const resStart = new Date(r.start_time);
      const resEnd = new Date(r.end_time);
      // Check overlap
      return startTime < resEnd && endTime > resStart;
    }) || null;
  }, [reservations]);

  const handleReservationClick = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setDetailDialogOpen(true);
  };

  const handleDragCreate = (startTime: Date, endTime: Date) => {
    const conflict = findConflict(startTime, endTime);

    setDragStartTime(startTime);
    setDragEndTime(endTime);

    if (conflict) {
      // Show conflict resolution dialog
      setConflictingReservation(conflict);
      setConflictDialogOpen(true);
    } else {
      // No conflict - show quick reservation dialog
      setQuickDialogOpen(true);
    }
  };

  // Handle conflict resolution: book before the conflict
  const handleSelectBefore = (endTime: Date) => {
    if (!dragStartTime) return;
    setConflictDialogOpen(false);
    setDragEndTime(endTime);
    setQuickDialogOpen(true);
  };

  // Handle conflict resolution: book after the conflict
  const handleSelectAfter = (startTime: Date) => {
    if (!dragEndTime) return;
    setConflictDialogOpen(false);
    setDragStartTime(startTime);
    setQuickDialogOpen(true);
  };

  // Handle conflict resolution: select alternative room
  const handleSelectAlternative = (room: Room) => {
    setConflictDialogOpen(false);
    // Navigate to the alternative room's page
    router.push(`/dashboard/reservations/${room.code}`);
  };

  return (
    <>
      <CalendarView
        reservations={reservations}
        scheduleBreaks={scheduleBreaks}
        availableDays={availableDays}
        onSlotClick={(startTime) => {
          // Open quick reservation dialog with 1 hour default duration
          const endTime = new Date(startTime);
          endTime.setHours(endTime.getHours() + 1);
          setDragStartTime(startTime);
          setDragEndTime(endTime);
          setQuickDialogOpen(true);
        }}
        onReservationClick={handleReservationClick}
        onDragCreate={handleDragCreate}
      />

      <ReservationDetailDialog
        reservation={selectedReservation}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        currentUserId={currentUserId}
      />

      <QuickReservationDialog
        open={quickDialogOpen}
        onOpenChange={setQuickDialogOpen}
        roomId={roomId}
        roomName={roomName}
        startTime={dragStartTime}
        endTime={dragEndTime}
      />

      <ConflictResolutionDialog
        open={conflictDialogOpen}
        onOpenChange={setConflictDialogOpen}
        conflictingReservation={conflictingReservation}
        requestedStart={dragStartTime}
        requestedEnd={dragEndTime}
        currentRoomName={roomName}
        alternativeRooms={alternativeRooms}
        onSelectBefore={handleSelectBefore}
        onSelectAfter={handleSelectAfter}
        onSelectAlternative={handleSelectAlternative}
      />
    </>
  );
}
