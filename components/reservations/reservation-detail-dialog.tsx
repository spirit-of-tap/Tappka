"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Share2,
  Clock,
  Calendar,
  UserPlus,
  UserMinus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  formatTime,
  formatDateShort,
  isReservationActive,
} from "@/lib/reservations/utils";
import {
  RESERVATION_TYPE_LABELS,
  type ReservationWithDetails,
  type CoworkParticipant,
} from "@/lib/reservations/types";

interface ReservationDetailDialogProps {
  reservation: ReservationWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
}

/**
 * Dialog showing reservation details including cowork participants
 */
export function ReservationDetailDialog({
  reservation,
  open,
  onOpenChange,
  currentUserId,
}: ReservationDetailDialogProps) {
  const router = useRouter();
  const [participants, setParticipants] = useState<CoworkParticipant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Fetch participants when dialog opens
  useEffect(() => {
    if (open && reservation?.is_cowork_open) {
      fetchParticipants();
    }
  }, [open, reservation?.id]);

  const fetchParticipants = async () => {
    if (!reservation) return;

    setIsLoadingParticipants(true);
    try {
      const response = await fetch(
        `/api/reservations/${reservation.id}/participants`
      );
      if (response.ok) {
        const data = await response.json();
        setParticipants(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch participants:", error);
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const handleJoin = async () => {
    if (!reservation) return;

    setIsJoining(true);
    try {
      const response = await fetch("/api/reservations/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservation.id }),
      });

      if (response.ok) {
        await fetchParticipants();
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || "Nepodařilo se připojit");
      }
    } catch (error) {
      alert("Něco se pokazilo");
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!reservation) return;

    setIsLeaving(true);
    try {
      const response = await fetch("/api/reservations/join", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservation.id }),
      });

      if (response.ok) {
        await fetchParticipants();
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || "Nepodařilo se opustit");
      }
    } catch (error) {
      alert("Něco se pokazilo");
    } finally {
      setIsLeaving(false);
    }
  };

  if (!reservation) return null;

  const startDate = new Date(reservation.start_time);
  const endDate = new Date(reservation.end_time);
  const isActive = isReservationActive(reservation);
  const isOwner = reservation.user_id === currentUserId;
  const hasJoined = participants.some((p) => p.user_id === currentUserId);
  const canJoin =
    reservation.is_cowork_open && !isOwner && !hasJoined && isActive;
  const canLeave = hasJoined && isActive;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {reservation.title}
            {isActive && (
              <Badge variant="default" className="ml-2">
                Probíhá
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Time info */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-4" />
              {formatDateShort(startDate)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-4" />
              {formatTime(startDate)} - {formatTime(endDate)}
            </span>
          </div>

          {/* Type badge */}
          <Badge variant="outline">
            {RESERVATION_TYPE_LABELS[reservation.reservation_type]}
          </Badge>

          {/* Reason */}
          {reservation.reason && (
            <div>
              <p className="text-sm font-medium mb-1">Důvod</p>
              <p className="text-sm text-muted-foreground">
                {reservation.reason}
              </p>
            </div>
          )}

          {/* Person count */}
          {reservation.person_count && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="size-4 text-muted-foreground" />
              <span>{reservation.person_count} osob</span>
            </div>
          )}

          {/* Cowork section */}
          {reservation.is_cowork_open && (
            <>
              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Share2 className="size-4" />
                    Cowork otevřen
                  </p>
                  {canJoin && (
                    <Button
                      size="sm"
                      onClick={handleJoin}
                      disabled={isJoining}
                    >
                      {isJoining ? (
                        <Loader2 className="size-4 animate-spin mr-1" />
                      ) : (
                        <UserPlus className="size-4 mr-1" />
                      )}
                      Připojit se
                    </Button>
                  )}
                  {canLeave && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleLeave}
                      disabled={isLeaving}
                    >
                      {isLeaving ? (
                        <Loader2 className="size-4 animate-spin mr-1" />
                      ) : (
                        <UserMinus className="size-4 mr-1" />
                      )}
                      Opustit
                    </Button>
                  )}
                </div>

                {/* Participants list */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Účastníci ({participants.length})
                  </p>

                  {isLoadingParticipants ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : participants.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      Zatím se nikdo nepřipojil
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {participants.map((participant) => (
                        <div
                          key={participant.id}
                          className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                        >
                          <Avatar className="size-6">
                            <AvatarFallback className="text-xs">
                              {getInitials(participant.user?.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {participant.user?.name || "Neznámý uživatel"}
                          </span>
                          {participant.user_id === currentUserId && (
                            <Badge variant="secondary" className="text-xs ml-auto">
                              Ty
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getInitials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
