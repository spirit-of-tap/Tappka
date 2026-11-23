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

export const STATUS_DOT_CLASSES: Record<RoomMapStatus["kind"] | "mine", string> = {
  free: "bg-success shadow-[0_0_12px_var(--color-success)]",
  busy: "bg-chart-2 shadow-[0_0_12px_var(--color-chart-2)]",
  mine: "bg-primary shadow-[0_0_12px_var(--color-primary)]",
  closed: "bg-hero-muted",
};

const STATUS_TEXT_CLASSES: Record<RoomMapStatus["kind"], string> = {
  free: "text-hero-success",
  busy: "text-chart-2",
  closed: "text-hero-foreground/80",
};

const LEGEND: { key: keyof typeof STATUS_DOT_CLASSES; label: string }[] = [
  { key: "free", label: "volná" },
  { key: "busy", label: "obsazená" },
  { key: "mine", label: "tvoje" },
  { key: "closed", label: "zavřená" },
];

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
    <section
      aria-label="Plánek místností"
      className="relative overflow-hidden rounded-3xl bg-hero p-5 text-hero-foreground motion-safe:animate-rise sm:p-6"
      style={{ animationDelay: "100ms" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full border-[36px] border-hero-foreground/5"
      />
      <div className="relative space-y-6">
        <div className="flex justify-end">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-hero-muted">
            {LEGEND.map(({ key, label }) => (
              <li key={key} className="inline-flex items-center gap-1.5">
                <span aria-hidden className={cn("size-2 rounded-full", STATUS_DOT_CLASSES[key])} />
                {label}
              </li>
            ))}
          </ul>
        </div>
        {groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-hero-muted">
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
    </section>
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
          "relative h-full min-h-36 w-full min-w-0 flex-col items-stretch justify-between gap-3 overflow-hidden whitespace-normal rounded-2xl border border-hero-foreground/10 bg-hero-foreground/5 p-4 text-left font-normal text-hero-foreground focus-ring-hero motion-safe:transition motion-safe:duration-500 motion-safe:ease-smooth hover:bg-hero-foreground/10 hover:text-hero-foreground motion-safe:hover:-translate-y-0.5",
          status.kind === "closed" && "border-dashed",
          selected && "border-chart-3 bg-hero-foreground/10 ring-2 ring-chart-3/40",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-3.5 right-3.5 size-3 rounded-full",
            STATUS_DOT_CLASSES[mineStart ? "mine" : status.kind],
          )}
        />
        <span className="font-heading text-2xl font-bold leading-none text-hero-foreground sm:text-3xl">
          {room.code.toUpperCase()}
        </span>
        <span className="block min-w-0 space-y-0.5">
          {mineStart && (
            <Badge className="mb-1.5 max-w-full truncate rounded-full bg-primary px-2 text-[11px] text-primary-foreground">
              Tvoje · {formatTime(mineStart)}
            </Badge>
          )}
          <span className="line-clamp-2 block text-sm text-hero-foreground/80">{getRoomTitle(room)}</span>
          <span className={cn("block text-xs font-bold", STATUS_TEXT_CLASSES[status.kind])}>
            {getStatusLine(status, isToday)}
          </span>
        </span>
      </Button>
    </div>
  );
}
