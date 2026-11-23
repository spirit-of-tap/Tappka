"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  getRoomFloor,
  OTHER_FLOOR_LABEL,
  type RoomMapStatus,
  type SlotChip,
} from "@/lib/reservations/room-map";
import { formatTime } from "@/lib/reservations/utils";
import { DAY_NAMES_CS, type Reservation, type Room } from "@/lib/reservations/types";

import { RoomDayTimeline } from "./room-day-timeline";
import { getRoomTitle, getStatusLine, STATUS_DOT_CLASSES } from "./room-map";

const BASE_DURATIONS = [30, 60, 120];

const PILL_CLASSES: Record<RoomMapStatus["kind"], { dot: string; label: string }> = {
  free: { dot: STATUS_DOT_CLASSES.free, label: "Volná" },
  busy: { dot: STATUS_DOT_CLASSES.busy, label: "Obsazená" },
  closed: { dot: STATUS_DOT_CLASSES.closed, label: "Zavřená" },
};

const HERO_CHIP_CLASSES = "rounded-lg bg-hero-foreground/10 px-2 py-0.5 text-xs text-hero-foreground/80";

const CHIP_CLASSES = {
  free: "bg-success/12 text-success-strong hover:bg-success/20 hover:text-success-strong",
  taken: "bg-muted text-muted-foreground line-through",
  chosen: "bg-chart-3-strong text-card hover:bg-chart-3-strong/90 hover:text-card",
} as const;

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : String(hours).replace(".", ",")} h`;
}

interface RoomDetailPanelProps {
  room: Room;
  status: RoomMapStatus;
  isToday: boolean;
  isLoading: boolean;
  chips: SlotChip[];
  day: Date;
  reservations: Reservation[];
  mineIds?: ReadonlySet<string>;
  duration: number;
  chosenStart: Date | null;
  onChooseStart: (start: Date) => void;
  onChooseDuration: (minutes: number) => void;
  onBook: () => void;
}

export function RoomDetailPanel({
  room,
  status,
  isToday,
  isLoading,
  chips,
  day,
  reservations,
  mineIds,
  duration,
  chosenStart,
  onChooseStart,
  onChooseDuration,
  onBook,
}: RoomDetailPanelProps) {
  const pill = PILL_CLASSES[status.kind];
  const durations = [...new Set([...BASE_DURATIONS, duration])].sort((a, b) => a - b);
  const chosenChip = chips.find((chip) => chip.start.getTime() === chosenStart?.getTime());
  const hasRestrictedDays = (room.available_days?.length ?? 0) > 0;
  const floor = getRoomFloor(room.code);
  const floorLabel = floor === null ? OTHER_FLOOR_LABEL : `${floor}. patro`;

  return (
    <section
      aria-label="Detail místnosti"
      className="overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-sm motion-safe:animate-rise"
      style={{ animationDelay: "200ms" }}
    >
      <div className="relative space-y-3 overflow-hidden bg-hero p-5 text-hero-foreground">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full border-[18px] border-hero-foreground/5"
        />
        <div className="relative flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-hero-muted">
            {floorLabel}
          </p>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-hero-foreground/10 px-2.5 py-1 text-xs font-semibold">
            <span aria-hidden className={cn("size-2 rounded-full", pill.dot)} />
            {pill.label}
          </span>
        </div>
        <div className="relative space-y-1">
          <h3 className="font-heading text-4xl font-bold leading-none">
            {room.code.toUpperCase()}
          </h3>
          <p className="text-base font-medium">{getRoomTitle(room)}</p>
          {room.description && <p className="text-sm text-hero-muted">{room.description}</p>}
          <p className="text-xs font-semibold text-hero-muted">
            {getStatusLine(status, isToday)}
          </p>
        </div>
        {(room.can_have_ts || hasRestrictedDays) && (
          <div className="relative flex flex-wrap gap-1.5">
            {room.can_have_ts && <span className={HERO_CHIP_CLASSES}>TS místnost</span>}
            {hasRestrictedDays && (
              <span className={HERO_CHIP_CLASSES}>
                {(room.available_days ?? []).map((d) => DAY_NAMES_CS[d]).join(", ")}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-5 p-5">
        {status.kind === "closed" ? (
          <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
            Místnost je v tento den zavřená
          </p>
        ) : (
          <>
            <RoomDayTimeline
              roomId={room.id}
              day={day}
              reservations={reservations}
              mineIds={mineIds}
              isToday={isToday}
              chosen={chosenChip ? { start: chosenChip.start, end: chosenChip.end } : null}
            />
            <div>
              <div className="mb-2 flex items-center gap-2">
                <h4 className="text-sm font-bold text-chart-3-strong">Začátek</h4>
                {isLoading && <Spinner className="size-3.5" />}
              </div>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-4">
                {chips.filter((chip) => chip.state !== "past").map((chip) => {
                  const isChosen = chip.start.getTime() === chosenStart?.getTime();
                  const isFree = chip.state === "free";
                  return (
                    <Button
                      key={chip.start.getTime()}
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!isFree}
                      aria-pressed={isChosen}
                      onClick={() => onChooseStart(chip.start)}
                      className={cn(
                        "h-8 px-0 text-xs tabular-nums",
                        isChosen ? CHIP_CLASSES.chosen : isFree ? CHIP_CLASSES.free : CHIP_CLASSES.taken,
                      )}
                    >
                      {formatTime(chip.start)}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-bold text-chart-3-strong">Délka</h4>
              <div className="flex rounded-xl bg-muted p-1">
                {durations.map((minutes) => (
                  <Button
                    key={minutes}
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-pressed={minutes === duration}
                    onClick={() => onChooseDuration(minutes)}
                    className={cn(
                      "h-8 flex-1 rounded-lg",
                      minutes === duration
                        ? "bg-card text-foreground shadow-sm hover:bg-card hover:text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatDuration(minutes)}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="space-y-2">
          <Button
            type="button"
            size="lg"
            className="h-12 w-full rounded-xl"
            disabled={!chosenChip}
            onClick={onBook}
          >
            {chosenChip
              ? `Rezervovat ${formatTime(chosenChip.start)}–${formatTime(chosenChip.end)}`
              : "Rezervovat"}
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
          >
            <Link href={`/reservations/${room.code}`}>
              <CalendarClock className="size-4" />
              Celý rozvrh místnosti
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
