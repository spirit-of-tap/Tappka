"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Users,
  Clock,
  Calendar,
  Loader2,
  Pencil,
  Trash2,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog";
import { Separator } from "@/components/ui/separator";
import { StorageAvatar } from "@/components/storage/storage-avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { TimePicker } from "./time-picker";
import {
  formatTime,
  formatDateShort,
  isReservationActive,
  inferReservationKind,
} from "@/lib/reservations/utils";
import {
  RESERVATION_KIND_LABELS,
  type ReservationWithDetails,
} from "@/lib/reservations/types";

interface ReservationDetailDialogProps {
  reservation: ReservationWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
}

/**
 * Dialog showing reservation details.
 * Owners can edit the title, person count, and cancel the reservation.
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
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editPersonCount, setEditPersonCount] = useState("1");
  const [editableStartTime, setEditableStartTime] = useState("");
  const [editableEndTime, setEditableEndTime] = useState("");
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const reservationData = currentReservation ?? reservation;

  useEffect(() => {
    setCurrentReservation(reservation);
  }, [reservation]);

  // Reset edit state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsEditing(false);
      setEditError(null);
    }
  }, [open]);

  // On mobile, scroll focused inputs into view when keyboard opens
  useEffect(() => {
    if (!open || !isMobile) return;

    const el = contentRef.current;
    if (!el) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        setTimeout(() => target.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
      }
    };

    el.addEventListener("focusin", handleFocusIn);
    return () => el.removeEventListener("focusin", handleFocusIn);
  }, [open, isMobile]);

  const startEditing = () => {
    if (!reservationData) return;
    setEditTitle(reservationData.title);
    setEditPersonCount((reservationData.person_count ?? 1).toString());
    const start = new Date(reservationData.start_at);
    const end = new Date(reservationData.end_at);
    setEditableStartTime(
      `${start.getHours().toString().padStart(2, "0")}:${start.getMinutes().toString().padStart(2, "0")}`
    );
    setEditableEndTime(
      `${end.getHours().toString().padStart(2, "0")}:${end.getMinutes().toString().padStart(2, "0")}`
    );
    setIsEditingTime(false);
    setEditError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setIsEditingTime(false);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!reservationData) return;

    if (!editTitle.trim()) {
      setEditError("Zadej důvod / název rezervace");
      return;
    }
    if (!editPersonCount || parseInt(editPersonCount) < 1) {
      setEditError("Počet osob musí být alespoň 1");
      return;
    }

    // Build request body
    const body: Record<string, unknown> = {
      title: editTitle.trim(),
      person_count: parseInt(editPersonCount),
    };

    // Compute ISO times from editable time strings
    const startBase = new Date(reservationData.start_at);
    const [startHours, startMins] = editableStartTime.split(":").map(Number);
    const finalStart = new Date(startBase);
    finalStart.setHours(startHours, startMins, 0, 0);

    const [endHours, endMins] = editableEndTime.split(":").map(Number);
    const finalEnd = new Date(startBase);
    finalEnd.setHours(endHours, endMins, 0, 0);

    body.start_at = finalStart.toISOString();
    body.end_at = finalEnd.toISOString();

    setIsSaving(true);
    setEditError(null);

    try {
      const response = await fetch(`/api/reservations/${reservationData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  if (!reservationData) return null;

  const startDate = new Date(reservationData.start_at);
  const endDate = new Date(reservationData.end_at);
  const isActive = isReservationActive(reservationData);
  // Owner can edit/cancel as long as the reservation hasn't ended yet
  const isNotEnded = endDate > new Date();
  const kind = inferReservationKind(reservationData);
  const isOwner = !!currentUserId && reservationData.owner_profile_id === currentUserId;
  const isPersonal = kind === "personal";

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

        <div ref={contentRef}>
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

              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={editPersonCount}
                  onChange={(e) => setEditPersonCount(e.target.value)}
                  className="w-16 h-9"
                />
                <span className="text-sm text-muted-foreground">osob</span>
              </div>

              {/* Time editing */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground" />
                    Čas
                  </Label>
                  {!isEditingTime && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingTime(true)}
                      className="h-7 px-2 text-xs"
                    >
                      <Edit2 className="size-3 mr-1" />
                      Upravit čas
                    </Button>
                  )}
                </div>

                {isEditingTime ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <TimePicker
                        value={editableStartTime}
                        onChange={setEditableStartTime}
                        date={startDate}
                      />
                    </div>
                    <span className="text-muted-foreground shrink-0">-</span>
                    <div className="flex-1">
                      <TimePicker
                        value={editableEndTime}
                        onChange={setEditableEndTime}
                        minTime={editableStartTime}
                        date={startDate}
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => setIsEditingTime(true)}
                  >
                    <span className="font-medium">{editableStartTime} - {editableEndTime}</span>
                  </div>
                )}
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
                  {RESERVATION_KIND_LABELS[kind]}
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
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
