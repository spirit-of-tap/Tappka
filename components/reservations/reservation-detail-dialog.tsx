"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Users,
  Share2,
  Clock,
  Calendar,
  UserPlus,
  UserMinus,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog";
import { Separator } from "@/components/ui/separator";
import { StorageAvatar } from "@/components/storage/storage-avatar";
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
 * Dialog showing reservation details including cowork participants.
 * Owners can edit the title, person count, cowork toggle, and cancel the reservation.
 */
export function ReservationDetailDialog({
  reservation,
  open,
  onOpenChange,
  currentUserId,
}: ReservationDetailDialogProps) {
  const router = useRouter();
  const [currentReservation, setCurrentReservation] =
    useState<ReservationWithDetails | null>(reservation);
  const [participants, setParticipants] = useState<CoworkParticipant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editPersonCount, setEditPersonCount] = useState(1);
  const [editIsCoworkOpen, setEditIsCoworkOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const reservationData = currentReservation ?? reservation;

  useEffect(() => {
    setCurrentReservation(reservation);
  }, [reservation]);

  // Fetch participants when dialog opens or when cowork status changes
  useEffect(() => {
    if (open && reservationData?.is_cowork_open) {
      fetchParticipants();
    }
  }, [open, reservationData?.id, reservationData?.is_cowork_open]);

  // Reset edit state when dialog closes or reservation changes
  useEffect(() => {
    if (!open) {
      setIsEditing(false);
      setEditError(null);
    }
  }, [open]);

  const startEditing = () => {
    if (!reservationData) return;
    setEditTitle(reservationData.title);
    setEditPersonCount(reservationData.person_count ?? 1);
    setEditIsCoworkOpen(reservationData.is_cowork_open);
    setEditError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const fetchParticipants = async () => {
    if (!reservationData) return;

    setIsLoadingParticipants(true);
    try {
      const response = await fetch(
        `/api/reservations/${reservationData.id}/participants`
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

  const handleSaveEdit = async () => {
    if (!reservationData) return;

    if (!editTitle.trim()) {
      setEditError("Zadej důvod / název rezervace");
      return;
    }
    if (editPersonCount < 1) {
      setEditError("Počet osob musí být alespoň 1");
      return;
    }

    setIsSaving(true);
    setEditError(null);

    try {
      const response = await fetch(`/api/reservations/${reservationData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          person_count: editPersonCount,
          is_cowork_open: editIsCoworkOpen,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setEditError(data.error || "Nepodařilo se uložit změny");
        return;
      }

      if (data.data) {
        setCurrentReservation((previousReservation) =>
          previousReservation
            ? { ...previousReservation, ...data.data }
            : previousReservation
        );
      }

      toast.success("Rezervace upravena");
      setIsEditing(false);
      // Refresh participants in case cowork toggle changed
      if (editIsCoworkOpen) {
        await fetchParticipants();
      }
      router.refresh();
    } catch {
      setEditError("Něco se pokazilo");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTitleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key !== "Enter" || !event.metaKey) {
      return;
    }

    event.preventDefault();

    if (isSaving || !editTitle.trim()) {
      return;
    }

    void handleSaveEdit();
  };

  const handleCancelReservation = async () => {
    if (!reservationData) return;
    if (!confirm("Opravdu chceš zrušit tuto rezervaci?")) return;

    setIsCancelling(true);
    try {
      const response = await fetch(`/api/reservations/${reservationData.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Rezervace zrušena");
        onOpenChange(false);
        router.refresh();
      } else {
        const data = await response.json();
        toast.error(data.error || "Nepodařilo se zrušit rezervaci");
      }
    } catch {
      toast.error("Něco se pokazilo");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleJoin = async () => {
    if (!reservationData) return;

    setIsJoining(true);
    try {
      const response = await fetch("/api/reservations/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservationData.id }),
      });

      if (response.ok) {
        toast.success("Připojeno ke coworku");
        await fetchParticipants();
        router.refresh();
      } else {
        const data = await response.json();
        toast.error(data.error || "Nepodařilo se připojit");
      }
    } catch {
      toast.error("Něco se pokazilo");
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!reservationData) return;

    setIsLeaving(true);
    try {
      const response = await fetch("/api/reservations/join", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservationData.id }),
      });

      if (response.ok) {
        toast.success("Cowork opuštěn");
        await fetchParticipants();
        router.refresh();
      } else {
        const data = await response.json();
        toast.error(data.error || "Nepodařilo se opustit");
      }
    } catch {
      toast.error("Něco se pokazilo");
    } finally {
      setIsLeaving(false);
    }
  };

  if (!reservationData) return null;

  const startDate = new Date(reservationData.start_time);
  const endDate = new Date(reservationData.end_time);
  const isActive = isReservationActive(reservationData);
  // Owner can edit/cancel as long as the reservation hasn't ended yet
  const isNotEnded = endDate > new Date();
  const isOwner = !!currentUserId && reservationData.user_id === currentUserId;
  const hasJoined = participants.some((p) => p.user_id === currentUserId);
  const canJoin =
    reservationData.is_cowork_open && !isOwner && !hasJoined && isActive;
  const canLeave = hasJoined && isActive;
  const isPersonal = reservationData.reservation_type === "personal";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? (
              <span className="text-base">Upravit rezervaci</span>
            ) : (
              <>
                {reservationData.title}
                {isActive && (
                  <Badge variant="default" className="ml-2">
                    Probíhá
                  </Badge>
                )}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {isEditing ? (
          /* ── Edit form ── */
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Název / důvod</Label>
              <Textarea
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleEditTitleKeyDown}
                rows={2}
                autoFocus
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={editPersonCount}
                  onChange={(e) => setEditPersonCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 h-9"
                />
                <span className="text-sm text-muted-foreground">osob</span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Share2 className="size-4 text-muted-foreground" />
                <span className="text-sm">Cowork</span>
                <Switch
                  checked={editIsCoworkOpen}
                  onCheckedChange={setEditIsCoworkOpen}
                />
              </div>
            </div>

            {editError && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {editError}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSaveEdit}
                disabled={isSaving || !editTitle.trim()}
                className="flex-1"
              >
                {isSaving ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                Uložit
              </Button>
              <Button variant="outline" onClick={cancelEditing} disabled={isSaving}>
                Zrušit
              </Button>
            </div>
          </div>
        ) : (
          /* ── Detail view ── */
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

            {/* Owner info (personal reservations) or type badge (non-personal) */}
            {isPersonal ? (
              reservationData.user && (
                <div className="flex items-center gap-2">
                  <StorageAvatar
                    storageKey={reservationData.user.picture ?? null}
                    name={reservationData.user.name}
                    size="sm"
                  />
                  <span className="text-sm font-medium">{reservationData.user.name}</span>
                  {isOwner && (
                    <Badge variant="secondary" className="text-xs ml-1">Ty</Badge>
                  )}
                </div>
              )
            ) : (
              <Badge variant="outline">
                {RESERVATION_TYPE_LABELS[reservationData.reservation_type]}
              </Badge>
            )}

            {/* Person count */}
            {reservationData.person_count != null && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="size-4 text-muted-foreground" />
                <span>{reservationData.person_count} osob</span>
              </div>
            )}

            {/* Owner actions */}
            {isOwner && isNotEnded && (
              <>
                <Separator />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startEditing}
                    className="flex-1"
                  >
                    <Pencil className="size-3.5 mr-1.5" />
                    Upravit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleCancelReservation}
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Trash2 className="size-3.5 mr-1.5" />
                    )}
                    Zrušit
                  </Button>
                </div>
              </>
            )}

            {/* Cowork section */}
            {reservationData.is_cowork_open && (
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
        )}
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
