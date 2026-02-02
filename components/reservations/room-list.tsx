"use client";

import { useMemo } from "react";
import { RoomCard } from "./room-card";
import type { RoomWithStatus } from "@/lib/reservations/types";

interface RoomListProps {
  rooms: RoomWithStatus[];
}

// Custom order: TS rooms first (D126, D132, D226), then quiet/repre (D127, D129), then D107
const ROOM_ORDER: Record<string, number> = {
  d126: 1,
  d132: 2,
  d226: 3,
  d127: 4,
  d129: 5,
  d107: 6,
};

/**
 * Grid of room cards showing all available rooms
 * Grouped into 3 columns: TS rooms | Quiet/Repre | D107
 */
export function RoomList({ rooms }: RoomListProps) {
  // Sort rooms by custom order
  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const orderA = ROOM_ORDER[a.code] ?? 99;
      const orderB = ROOM_ORDER[b.code] ?? 99;
      return orderA - orderB;
    });
  }, [rooms]);

  // Group rooms into columns
  const groupedRooms = useMemo(() => {
    const tsRooms = sortedRooms.filter((r) => ["d126", "d132", "d226"].includes(r.code));
    const quietRepre = sortedRooms.filter((r) => ["d127", "d129"].includes(r.code));
    const d107 = sortedRooms.filter((r) => r.code === "d107");
    const other = sortedRooms.filter((r) => 
      !["d126", "d132", "d226", "d127", "d129", "d107"].includes(r.code)
    );
    return { tsRooms, quietRepre, d107, other };
  }, [sortedRooms]);

  if (rooms.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Žádné místnosti k zobrazení</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Column 1: TS rooms (D126, D132, D226) */}
      <div className="flex flex-col gap-4">
        {groupedRooms.tsRooms.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>
      
      {/* Column 2: Quiet & Representational (D127, D129) */}
      <div className="flex flex-col gap-4">
        {groupedRooms.quietRepre.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>
      
      {/* Column 3: D107 */}
      <div className="flex flex-col gap-4">
        {groupedRooms.d107.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
        {/* Any other rooms */}
        {groupedRooms.other.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>
    </div>
  );
}
