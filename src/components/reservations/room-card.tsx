"use client";

import Link from "next/link";
import { addMinutes } from "date-fns";
import { ArrowRight, Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatTime, inferReservationKind } from "@/lib/reservations/utils";
import type { RoomWithStatus } from "@/lib/reservations/types";
import type { FilterState } from "./room-filter";

interface RoomCardProps {
  room: RoomWithStatus;
  filterState?: FilterState | null;
  onRoomClick?: (room: RoomWithStatus) => void;
  animationDelay?: number;
}

/**
 * Card component displaying a room's current status and availability
 */
export function RoomCard({ room, filterState, onRoomClick, animationDelay = 0 }: RoomCardProps) {
  const filterAvailability = room.availabilityForFilter;
  const isFilterActive = filterState?.duration != null;
  const isOccupiedNow = room.currentReservation !== null;
  const isFilteredOut = isFilterActive && filterAvailability !== undefined;
  // With a filter active the card must describe the filtered window, not the
  // snapshot of "now" taken when the page was rendered on the server.
  const isOccupied = isFilterActive ? isFilteredOut : isOccupiedNow;
  const isDayRestricted =
    isFilterActive && filterAvailability?.reason === "day_restricted";

  const statusBadge = isOccupied
    ? {
        label: isDayRestricted ? "Nedostupná" : "Obsazeno",
        pill: "bg-destructive/10 text-destructive",
        dot: "bg-destructive",
      }
    : { label: "Volná", pill: "bg-success/12 text-success-strong", dot: "bg-success" };

  const roomCode = room.code.toUpperCase();
  const roomTitle = room.name.replace(new RegExp(`^${room.code}\\s*[–-]\\s*`, "i"), "");

  const filterWindowLabel =
    filterState?.duration != null ? getFilterWindowLabel(filterState) : null;

  const statusDetail = isFilterActive
    ? isFilteredOut
      ? null
      : filterWindowLabel && `Volná ${filterWindowLabel}`
    : isOccupiedNow && room.nextAvailableTime
      ? `Volná od ${formatTime(room.nextAvailableTime)}`
      : "Volná nyní";

  const handleClick = (e: React.MouseEvent) => {
    // If onRoomClick is provided (filter active), intercept the click
    if (onRoomClick) {
      e.preventDefault();
      onRoomClick(room);
    }
    // Otherwise, let the Link handle navigation normally
  };

  const cardContent = (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-4 text-card-foreground shadow-sm transition motion-safe:hover:-translate-y-0.5 hover:shadow-md",
        isFilteredOut && "bg-muted/40"
      )}
    >
      {isFilteredOut && (
        <div className="-mx-4 -mt-4 flex items-center gap-2 bg-muted px-4 py-1.5 text-muted-foreground">
          <Clock className="size-4 flex-shrink-0" />
          <span className="text-sm font-medium line-clamp-2">
            {filterAvailability.reason === 'day_restricted'
              ? 'Nedostupná v tento den'
              : filterAvailability.conflictTime && filterAvailability.conflictTitle
                ? `Obsazeno ${filterAvailability.conflictTime} – ${filterAvailability.conflictTitle}`
                : `Obsazeno ${filterAvailability.conflictTime || 'v tento čas'}`
            }
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-2xl font-bold leading-none text-chart-3-strong">
            {roomCode}
          </h3>
          <p className="mt-1.5 truncate text-sm font-medium">{roomTitle}</p>
          <p className="truncate text-xs text-muted-foreground min-h-4">
            {room.description || "\u00A0"}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            statusBadge.pill
          )}
        >
          <span aria-hidden className={cn("size-1.5 rounded-full", statusBadge.dot)} />
          {statusBadge.label}
        </span>
      </div>

      <div className="flex-1 space-y-1.5">
        {!isFilterActive && isOccupiedNow && room.currentReservation && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4 flex-shrink-0" />
            <span className="truncate text-sm">
              {getReservationLabel(room.currentReservation)}
            </span>
          </div>
        )}

        {statusDetail && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4 flex-shrink-0" />
            <span className="text-sm">{statusDetail}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t pt-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {room.can_have_ts && (
            <Badge variant="outline" className="text-xs">
              TS místnost
            </Badge>
          )}
          {room.available_days && room.available_days.length > 0 && (
            <Badge variant="outline" className="text-xs">
              Omezená dostupnost
            </Badge>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-chart-3-strong">
          Rezervovat
          <ArrowRight className="size-3.5 transition-transform motion-safe:group-hover:translate-x-0.5" />
        </span>
      </div>
    </div>
  );

  return (
    <Link
      href={`/reservations/${room.code}`}
      onClick={handleClick}
      className={cn(
        "focus-ring block h-full rounded-2xl motion-safe:animate-rise",
        isFilteredOut && "opacity-70"
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {cardContent}
    </Link>
  );
}

function getFilterWindowLabel(filterState: FilterState): string {
  const [hours, minutes] = filterState.startTime.split(":").map(Number);
  const start = new Date(filterState.date);
  start.setHours(hours, minutes, 0, 0);
  const end = addMinutes(start, Number(filterState.duration ?? 0));

  return `${formatTime(start)}–${formatTime(end)}`;
}

function getReservationLabel(reservation: RoomWithStatus["currentReservation"]): string {
  if (!reservation) return "Rezervováno";

  const kind = inferReservationKind(reservation);
  switch (kind) {
    case "training_session":
      return reservation.title;
    case "houston_calling":
      return "Houston Calling";
    default:
      return reservation.title || "Rezervováno";
  }
}
