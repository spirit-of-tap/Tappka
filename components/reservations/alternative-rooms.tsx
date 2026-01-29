"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Room } from "@/lib/reservations/types";

interface AlternativeRoomsProps {
  rooms: Room[];
  currentRoomId: string;
}

/**
 * Shows alternative available rooms when the current one is busy
 */
export function AlternativeRooms({ rooms, currentRoomId }: AlternativeRoomsProps) {
  const alternatives = rooms.filter((r) => r.id !== currentRoomId);

  if (alternatives.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <h4 className="text-sm font-medium mb-3">Alternativní místnosti</h4>
      <div className="space-y-2">
        {alternatives.map((room) => (
          <Link
            key={room.id}
            href={`/dashboard/reservations/${room.code}`}
            className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
          >
            <span className="font-medium">{room.name}</span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
