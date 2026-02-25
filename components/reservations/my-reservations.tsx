"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Loader2, CalendarOff } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EditReservationDialog } from "./edit-reservation-dialog";
import { formatTime, isReservationActive } from "@/lib/reservations/utils";
import type { ReservationWithDetails } from "@/lib/reservations/types";

interface MyReservationsProps {
  reservations: ReservationWithDetails[];
  joinedCoworks: ReservationWithDetails[];
}

/**
 * List of user's own reservations and joined coworks (content only, no card wrapper)
 */
export function MyReservations({ reservations, joinedCoworks }: MyReservationsProps) {
  // Merge and sort by start_time
  const allReservations = [
    ...reservations.map(r => ({ ...r, isJoined: false })),
    ...joinedCoworks.map(r => ({ ...r, isJoined: true }))
  ].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  if (allReservations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CalendarOff className="size-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground text-sm">
          Nemáš žádné aktivní rezervace
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allReservations.map((reservation) => (
        <ReservationItem
          key={reservation.id}
          reservation={reservation}
          isJoined={reservation.isJoined}
        />
      ))}
    </div>
  );
}

interface ReservationItemProps {
  reservation: ReservationWithDetails;
  isJoined: boolean;
}

function ReservationItem({ reservation, isJoined }: ReservationItemProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  
  const isActive = isReservationActive(reservation);
  const startDate = new Date(reservation.start_time);
  const endDate = new Date(reservation.end_time);
  
  // Owner name for joined coworks
  const ownerName = isJoined 
    ? (reservation.user?.name || reservation.team?.name || "Neznámý")
    : null;

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
    }
  };

  const handleLeave = async () => {
    setIsLeaving(true);
    try {
      const response = await fetch(`/api/reservations/join?reservation_id=${reservation.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nepodařilo se opustit cowork");
      }

      toast.success("Cowork opuštěn");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <>
      <div 
        className="flex flex-col p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
        onClick={() => !isJoined && setEditOpen(true)}
      >
        {/* Top row: Date badge + Content */}
        <div className="flex gap-3 mb-3">
          {/* Date badge - always on left with month */}
          <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
            <span className="text-xs text-muted-foreground uppercase">
              {startDate.toLocaleDateString("cs-CZ", { weekday: "short" })}
            </span>
            <span className="text-lg font-bold text-primary">
              {startDate.getDate()}.{startDate.getMonth() + 1}.
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h4 className="font-semibold text-base truncate mb-1">
              {reservation.title}
            </h4>
            
            {/* Room + Time in one line */}
            <p className="text-sm text-muted-foreground mb-2">
              {reservation.room?.code?.toUpperCase() || reservation.room?.name || "Místnost"} od {formatTime(startDate)} do {formatTime(endDate)}
            </p>
            
            {/* Owner name for joined coworks */}
            {isJoined && ownerName && (
              <p className="text-xs text-muted-foreground mb-2">
                Vytvořil/a: {ownerName}
              </p>
            )}
            
            {/* Badges row */}
            <div className="flex flex-wrap gap-1.5">
              {isJoined && (
                <Badge variant="secondary" className="text-xs">
                  Připojeno
                </Badge>
              )}
              {isActive && (
                <Badge variant="default" className="text-xs">
                  Probíhá
                </Badge>
              )}
              {reservation.is_cowork_open && (
                <Badge variant="outline" className="text-xs">
                  Cowork
                </Badge>
              )}
              {reservation.person_count && (
                <Badge variant="outline" className="text-xs">
                  <Users className="size-3 mr-1" />
                  {reservation.person_count}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Bottom row: Action buttons spanning full width */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {isJoined ? (
            // Joined cowork: Only "Opustit" button
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={isLeaving}
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {isLeaving ? (
                    <>
                      <Loader2 className="size-4 mr-1 animate-spin" />
                      Opustit
                    </>
                  ) : (
                    "Opustit"
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Opustit cowork?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Opravdu chceš opustit cowork &quot;{reservation.title}&quot;?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Ne, zůstat</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLeave}>
                    Ano, opustit
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            // Own reservation: "Upravit" and "Smazat" buttons
            <>
              <Button 
                variant="outline" 
                size="sm"
                className="flex-[2]"
                onClick={() => setEditOpen(true)}
              >
                Upravit
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={isDeleting}
                    className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="size-4 mr-1 animate-spin" />
                        Smazat
                      </>
                    ) : (
                      "Smazat"
                    )}
                  </Button>
                </AlertDialogTrigger>
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
          )}
        </div>
      </div>

      {/* Edit dialog - controlled (only for owned reservations) */}
      {!isJoined && (
        <EditReservationDialog
          reservation={reservation}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </>
  );
}
