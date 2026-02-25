"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Edit, Trash2, Users, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatTime, formatDateShort } from "@/lib/reservations/utils";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import type { ReservationWithDetails } from "@/lib/reservations/types";

interface EditReservationDialogProps {
  reservation: ReservationWithDetails;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  // Controlled mode
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Dialog for editing an existing reservation
 * Supports both controlled and uncontrolled modes
 */
export function EditReservationDialog({
  reservation,
  trigger,
  onSuccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: EditReservationDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(value);
    } else {
      setInternalOpen(value);
    }
  };
  const [error, setError] = useState<string | null>(null);

  // Form state - simplified: title serves as reason
  const [reason, setReason] = useState(reservation.title || "");
  const [personCount, setPersonCount] = useState(reservation.person_count?.toString() || "1");
  const [isCoworkOpen, setIsCoworkOpen] = useState(reservation.is_cowork_open);

  const startDate = new Date(reservation.start_time);
  const endDate = new Date(reservation.end_time);

  const handleSubmit = async () => {
    setError(null);

    if (!reason.trim()) {
      setError("Zadej důvod rezervace");
      return;
    }

    if (!personCount || parseInt(personCount) < 1) {
      setError("Zadej počet osob");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/reservations/${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reason.trim(), // Use reason as title
          person_count: parseInt(personCount),
          is_cowork_open: isCoworkOpen,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nepodařilo se upravit rezervaci");
      }

      toast.success("Rezervace upravena");
      setOpen(false);
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/reservations/${reservation.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nepodařilo se zrušit rezervaci");
      }

      toast.success("Rezervace zrušena");
      setOpen(false);
      router.refresh();
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Only render trigger in uncontrolled mode */}
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="ghost" size="icon-sm">
              <Edit className="size-4" />
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upravit rezervaci</DialogTitle>
          <DialogDescription>
            {reservation.room?.name} • {formatDateShort(startDate)} • {formatTime(startDate)} - {formatTime(endDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="edit-reason">Důvod rezervace</Label>
            <Textarea
              id="edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Proč potřebuješ místnost?"
              rows={2}
            />
          </div>

          {/* Person count and Cowork */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <Input
                type="number"
                min={1}
                max={50}
                value={personCount}
                onChange={(e) => setPersonCount(e.target.value)}
                className="w-16 h-9"
              />
              <span className="text-sm text-muted-foreground">osob</span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Share2 className="size-4 text-muted-foreground" />
              <span className="text-sm">Cowork</span>
              <Switch
                checked={isCoworkOpen}
                onCheckedChange={setIsCoworkOpen}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Cancel reservation button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto">
                <Trash2 className="size-4 mr-2" />
                Zrušit rezervaci
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Zrušit rezervaci?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tato akce nelze vrátit zpět. Rezervace bude trvale zrušena.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Ne, ponechat</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancel}>
                  Ano, zrušit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Save button */}
          <Button onClick={handleSubmit} disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? "Ukládám..." : "Uložit změny"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
