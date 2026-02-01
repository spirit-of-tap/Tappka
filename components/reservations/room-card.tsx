"use client";

import Link from "next/link";
import { CalendarDays, Clock, Lock, Users, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/reservations/utils";
import type { RoomWithStatus, ReservationType } from "@/lib/reservations/types";

interface RoomCardProps {
  room: RoomWithStatus;
}

/**
 * Card component displaying a room's current status and availability
 */
export function RoomCard({ room }: RoomCardProps) {
  const isOccupied = room.currentReservation !== null;
  const hasIssue = room.hasOpenIssue;
  const isLocked = hasIssue && room.issueType === "locked";
  const filterAvailability = room.availabilityForFilter;
  const isFilteredOut = filterAvailability && !filterAvailability.isAvailable;

  // Determine status color
  const statusColor = isLocked
    ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
    : hasIssue
      ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
      : isOccupied
        ? "border-red-500 bg-red-50 dark:bg-red-950/20"
        : "border-green-500 bg-green-50 dark:bg-green-950/20";

  const statusBadge = isLocked
    ? { label: "Zamčená", variant: "secondary" as const, icon: Lock }
    : hasIssue
      ? { label: "Problém", variant: "secondary" as const, icon: AlertTriangle }
      : isOccupied
        ? { label: "Obsazeno", variant: "destructive" as const, icon: null }
        : { label: "Volná", variant: "default" as const, icon: null };

  return (
    <Link
      href={`/dashboard/reservations/${room.code}`}
      className={cn("block h-full", isFilteredOut && "opacity-70")}
    >
      <Card
        className={cn(
          "h-full transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer border-l-4 relative overflow-hidden",
          statusColor,
          isFilteredOut && "grayscale-[30%]"
        )}
      >
        {/* Diagonal stripe pattern for unavailable rooms */}
        {isFilteredOut && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0, 0, 0, 0.03) 10px, rgba(0, 0, 0, 0.03) 20px)',
            }}
          />
        )}
        <CardContent className="p-4 h-full flex flex-col relative z-10">
          {/* Locked banner */}
          {isLocked && (
            <div className="flex items-center gap-2 px-2 py-1.5 -mx-4 -mt-4 mb-3 bg-orange-200 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200">
              <Lock className="size-4" />
              <span className="text-sm font-medium">Místnost je zamčená</span>
            </div>
          )}

          {/* Filter unavailability banner */}
          {isFilteredOut && (
            <div className="flex items-center gap-2 px-2 py-1.5 -mx-4 -mt-4 mb-3 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
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

          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 flex-1 pr-2">
              <h3 className="font-heading font-bold text-lg">{room.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-1 min-h-[1.25rem]">
                {room.description || "\u00A0"}
              </p>
            </div>
            <Badge
              variant={statusBadge.variant}
              className={cn(
                "flex-shrink-0",
                isLocked && "bg-orange-500 text-white hover:bg-orange-600"
              )}
            >
              {statusBadge.icon && <statusBadge.icon className="size-3 mr-1" />}
              {statusBadge.label}
            </Badge>
          </div>

          {/* Status info */}
          <div className="space-y-2 flex-1">
            {/* Other issue warning (non-locked) */}
            {hasIssue && !isLocked && (
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="size-4 flex-shrink-0" />
                <span className="text-sm font-medium">
                  Nahlášen problém
                </span>
              </div>
            )}

            {/* Current reservation */}
            {isOccupied && room.currentReservation && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="size-4 flex-shrink-0" />
                <span className="text-sm">
                  {getReservationLabel(room.currentReservation.reservation_type, room.currentReservation.title)}
                </span>
              </div>
            )}

            {/* Next available time */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-4 flex-shrink-0" />
              <span className="text-sm">
                {isOccupied && room.nextAvailableTime
                  ? `Volná od ${formatTime(room.nextAvailableTime)}`
                  : "Volná nyní"}
              </span>
            </div>
          </div>

          {/* Room features - always at bottom */}
          <div className="flex items-center gap-2 pt-2 mt-auto min-h-[1.75rem]">
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
        </CardContent>
      </Card>
    </Link>
  );
}

function getReservationLabel(type: ReservationType, title: string): string {
  switch (type) {
    case "training_session":
      return title;
    case "houston_calling":
      return "Houston Calling";
    default:
      return title || "Rezervováno";
  }
}
