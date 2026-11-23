"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Pencil, Trash2, CalendarOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog";
import { EditReservationDialog } from "./edit-reservation-dialog";
import { formatTime, isReservationActive } from "@/lib/reservations/utils";
import type { ReservationWithDetails } from "@/lib/reservations/types";
import { cn } from "@/lib/utils";

const SHOW_COUNT = 5;

interface MyReservationsProps {
  reservations: ReservationWithDetails[];
}

export function MyReservations({ reservations }: MyReservationsProps) {
  const [showAll, setShowAll] = useState(false);

  const sorted = [...reservations].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <CalendarOff className="size-10 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground text-sm">
          Nemáš žádné aktivní rezervace
        </p>
      </div>
    );
  }

  const visible = showAll ? sorted : sorted.slice(0, SHOW_COUNT);
  const remaining = sorted.length - SHOW_COUNT;

  return (
    <div className="-mx-2 flex flex-col gap-0.5">
      {visible.map((reservation) => (
        <ReservationItem key={reservation.id} reservation={reservation} />
      ))}

      {!showAll && remaining > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="focus-ring w-full rounded-lg py-2.5 text-center text-sm font-medium text-chart-3-strong transition-colors hover:bg-muted/50"
        >
          + {remaining} dalších
        </button>
      )}
    </div>
  );
}

interface ReservationItemProps {
  reservation: ReservationWithDetails;
}

function ReservationItem({ reservation }: ReservationItemProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isActive = isReservationActive(reservation);
  const startDate = new Date(reservation.start_at);
  const endDate = new Date(reservation.end_at);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/reservations/${reservation.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Nepodařilo se zrušit rezervaci");
      }

      toast.success("Rezervace zrušena");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  // Keyboard equivalent of clicking the row. Ignore keys that bubble up from the
  // nested action buttons so Enter on "Smazat" doesn't also open the edit dialog.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    setEditOpen(true);
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upravit rezervaci ${reservation.title}`}
        className="focus-ring flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
        onClick={() => setEditOpen(true)}
        onKeyDown={handleKeyDown}
      >
        <div className="flex h-11 w-14 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-chart-3/10 leading-tight text-chart-3-strong">
          <span className="text-[10px] uppercase">
            {startDate.toLocaleDateString("cs-CZ", { weekday: "short", timeZone: "Europe/Prague" })}
          </span>
          <span className="font-heading text-sm font-bold">
            {startDate.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", timeZone: "Europe/Prague" })}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm truncate">
              {reservation.title}
            </h4>
            <span className="shrink-0 rounded-md bg-chart-3/15 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-chart-3-strong">
              {reservation.room?.code?.toUpperCase() || reservation.room?.name || "Místnost"}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatTime(startDate)}–{formatTime(endDate)}
            </span>
            <div className="flex gap-1">
              {isActive && (
                <Badge variant="default" className="text-[10px] h-4 px-1.5">
                  Probíhá
                </Badge>
              )}
              {reservation.person_count && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
                  <Users className="size-2.5" />
                  {reservation.person_count}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Actions — hidden until hover */}
        <div
          className={cn(
            "flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity",
            "max-sm:opacity-100"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditOpen(true)}
            aria-label="Upravit"
          >
            <Pencil className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={isDeleting}
            aria-label="Smazat"
          >
            {isDeleting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      <EditReservationDialog
        reservation={reservation}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zrušit rezervaci?</AlertDialogTitle>
            <AlertDialogDescription>
              Opravdu chceš zrušit rezervaci &quot;{reservation.title}&quot;? Tato akce nelze vrátit zpět.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne, ponechat</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Ano, zrušit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
