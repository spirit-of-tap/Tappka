"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { RoomMapStatus, SlotChip } from "@/lib/reservations/room-map";
import { formatTime } from "@/lib/reservations/utils";
import { DAY_NAMES_CS, type Room } from "@/lib/reservations/types";

import { getRoomTitle, getStatusLine } from "./room-map";

const BASE_DURATIONS = [30, 60, 120];

const PILL_CLASSES: Record<RoomMapStatus["kind"], { pill: string; dot: string; label: string }> = {
  free: { pill: "bg-success/12 text-success-strong", dot: "bg-success", label: "Volná" },
  busy: { pill: "bg-chart-2/15 text-chart-2-strong", dot: "bg-chart-2", label: "Obsazená" },
  closed: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground", label: "Zavřeno" },
};

const CHIP_CLASSES = {
  free: "bg-success/12 text-success-strong hover:bg-success/20 hover:text-success-strong",
  taken: "bg-muted text-muted-foreground line-through",
  chosen: "bg-chart-3 text-card hover:bg-chart-3/90 hover:text-card",
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

  return (
    <section
      aria-label="Detail místnosti"
      className="space-y-5 rounded-2xl border bg-card p-5 text-card-foreground motion-safe:animate-rise"
      style={{ animationDelay: "200ms" }}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-5xl font-bold leading-none text-chart-3-strong">
            {room.code.toUpperCase()}
          </h3>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              pill.pill,
            )}
          >
            <span aria-hidden className={cn("size-1.5 rounded-full", pill.dot)} />
            {pill.label}
          </span>
        </div>
        <p className="text-base font-medium">{getRoomTitle(room)}</p>
        {room.description && (
          <p className="text-sm text-muted-foreground">{room.description}</p>
        )}
        <p className="text-xs font-semibold text-muted-foreground">
          {getStatusLine(status, isToday)}
        </p>
        {(room.can_have_ts || hasRestrictedDays) && (
          <div className="flex flex-wrap gap-1.5">
            {room.can_have_ts && (
              <Badge variant="outline" className="text-xs">
                TS místnost
              </Badge>
            )}
            {hasRestrictedDays && (
              <Badge variant="outline" className="text-xs">
                {(room.available_days ?? []).map((day) => DAY_NAMES_CS[day]).join(", ")}
              </Badge>
            )}
          </div>
        )}
      </div>

      {status.kind === "closed" ? (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
          Místnost je v tento den zavřená
        </p>
      ) : (
        <>
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h4 className="text-sm font-bold text-chart-3-strong">Volné časy</h4>
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
            <div className="flex flex-wrap gap-1.5">
              {durations.map((minutes) => (
                <Button
                  key={minutes}
                  type="button"
                  size="sm"
                  variant={minutes === duration ? "default" : "outline"}
                  aria-pressed={minutes === duration}
                  onClick={() => onChooseDuration(minutes)}
                  className="h-8"
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
          className="w-full"
          disabled={!chosenChip}
          onClick={onBook}
        >
          {chosenChip
            ? `Rezervovat ${formatTime(chosenChip.start)}–${formatTime(chosenChip.end)}`
            : "Rezervovat"}
        </Button>
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href={`/reservations/${room.code}`}>
            <CalendarClock className="size-4" />
            Celý rozvrh místnosti
          </Link>
        </Button>
      </div>
    </section>
  );
}
