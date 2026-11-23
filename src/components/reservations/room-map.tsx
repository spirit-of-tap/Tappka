"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { pluralizeCz } from "@/lib/utils/pluralize-cz";
import { groupRoomsByFloor, type RoomMapStatus } from "@/lib/reservations/room-map";
import { formatTime } from "@/lib/reservations/utils";
import type { Room } from "@/lib/reservations/types";

export const STAGGER_MS = 40;
const MAX_STAGGER_STEPS = 8;
const BASE_DELAY_MS = 120;

export const STATUS_TILE_CLASSES: Record<RoomMapStatus["kind"], string> = {
  free: "bg-success/12 text-success-strong hover:bg-success/20 hover:text-success-strong",
  busy: "bg-chart-2/15 text-chart-2-strong hover:bg-chart-2/25 hover:text-chart-2-strong",
  closed: "bg-muted text-muted-foreground hover:bg-muted hover:text-muted-foreground",
};

export function getRoomTitle(room: Pick<Room, "code" | "name">): string {
  return room.name.replace(new RegExp(`^${room.code}\\s*[–-]\\s*`, "i"), "");
}

export function getStatusLine(status: RoomMapStatus, isToday: boolean): string {
  switch (status.kind) {
    case "closed":
      return isToday ? "Dnes zavřeno" : "Tento den zavřeno";
    case "busy":
      return status.until ? `Obsazená do ${formatTime(status.until)}` : "Obsazená";
    case "free":
      if (status.until) return `Volná do ${formatTime(status.until)}`;
      if (isToday) return "Volná do konce dne";
      if (status.reservationCount === 0) return "Volná celý den";
      return `${status.reservationCount} ${pluralizeCz(status.reservationCount, ["rezervace", "rezervace", "rezervací"])}`;
  }
}

export interface MapRoom {
  room: Room;
  status: RoomMapStatus;
  mineStart: Date | null;
}

interface RoomMapProps {
  items: MapRoom[];
  selectedId: string | null;
  isToday: boolean;
  onSelect: (room: Room) => void;
}

export function RoomMap({ items, selectedId, isToday, onSelect }: RoomMapProps) {
  if (items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Žádné místnosti k zobrazení</EmptyTitle>
          <EmptyDescription>Zkus to prosím později</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const groups = groupRoomsByFloor(items.map((item) => item.room));
  const itemById = new Map(items.map((item) => [item.room.id, item]));
  let index = 0;

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
            {group.rooms.map((room) => {
              const item = itemById.get(room.id);
              if (!item) return null;
              const delay = BASE_DELAY_MS + Math.min(index++, MAX_STAGGER_STEPS) * STAGGER_MS;
              return (
                <RoomTile
                  key={room.id}
                  item={item}
                  selected={room.id === selectedId}
                  isToday={isToday}
                  delay={delay}
                  onSelect={onSelect}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

interface RoomTileProps {
  item: MapRoom;
  selected: boolean;
  isToday: boolean;
  delay: number;
  onSelect: (room: Room) => void;
}

function RoomTile({ item, selected, isToday, delay, onSelect }: RoomTileProps) {
  const { room, status, mineStart } = item;

  return (
    <div className="h-full motion-safe:animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <Button
        type="button"
        variant="ghost"
        aria-pressed={selected}
        onClick={() => onSelect(room)}
        className={cn(
          "h-full min-h-32 w-full min-w-0 flex-col overflow-hidden items-stretch justify-between gap-3 whitespace-normal rounded-2xl p-4 text-left font-normal transition motion-safe:hover:-translate-y-0.5 hover:shadow-md sm:min-h-36",
          STATUS_TILE_CLASSES[status.kind],
          selected && "ring-2 ring-chart-3 ring-offset-2 ring-offset-card",
        )}
      >
        <span className="font-heading text-3xl font-bold leading-none">
          {room.code.toUpperCase()}
        </span>
        <span className="block min-w-0 space-y-0.5">
          {mineStart && (
            <Badge className="mb-1.5 max-w-full truncate rounded-full bg-primary px-2 text-[11px] text-primary-foreground">
              Tvoje · {formatTime(mineStart)}
            </Badge>
          )}
          <span className="line-clamp-2 block text-sm font-medium">{getRoomTitle(room)}</span>
          <span className="block text-xs font-semibold">{getStatusLine(status, isToday)}</span>
        </span>
      </Button>
    </div>
  );
}
