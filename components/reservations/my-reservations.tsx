"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, MapPin, Users, Edit, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}

/**
 * List of user's own reservations
 */
export function MyReservations({ reservations }: MyReservationsProps) {
  if (reservations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Moje rezervace</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Nemáš žádné aktivní rezervace
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Moje rezervace</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {reservations.map((reservation) => (
          <ReservationItem
            key={reservation.id}
            reservation={reservation}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface ReservationItemProps {
  reservation: ReservationWithDetails;
}

function ReservationItem({ reservation }: ReservationItemProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const isActive = isReservationActive(reservation);
  const startDate = new Date(reservation.start_time);
  const endDate = new Date(reservation.end_time);

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

      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div 
        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
        onClick={() => setEditOpen(true)}
      >
        {/* Date badge */}
        <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">
            {startDate.toLocaleDateString("cs-CZ", { weekday: "short" })}
          </span>
          <span className="text-lg font-bold text-primary">
            {startDate.getDate()}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-medium truncate">{reservation.title}</h4>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {reservation.room?.name || "Místnost"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {formatTime(startDate)} - {formatTime(endDate)}
                </span>
                {reservation.person_count && (
                  <span className="flex items-center gap-1">
                    <Users className="size-3" />
                    {reservation.person_count}
                  </span>
                )}
              </div>
            </div>

            {/* Status badge */}
            {isActive && (
              <Badge variant="default" className="flex-shrink-0">
                Probíhá
              </Badge>
            )}
          </div>

          {/* Cowork badge */}
          {reservation.is_cowork_open && (
            <Badge variant="outline" className="mt-2 text-xs">
              Otevřeno pro cowork
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button 
            variant="ghost" 
            size="icon-sm"
            onClick={() => setEditOpen(true)}
          >
            <Edit className="size-4" />
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon-sm" disabled={isDeleting}>
                {isDeleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4 text-destructive" />
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
        </div>
      </div>

      {/* Edit dialog - controlled */}
      <EditReservationDialog
        reservation={reservation}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
