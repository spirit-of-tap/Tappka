"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Share2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { roundToSlot } from "@/lib/reservations/utils";

interface QRQuickReserveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  roomName: string;
  durationMinutes: 15 | 30 | 45;
}

/**
 * Quick reserve dialog for QR code scans
 * Simpler version with pre-set duration
 */
export function QRQuickReserveDialog({
  open,
  onOpenChange,
  roomId,
  roomName,
  durationMinutes,
}: QRQuickReserveDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Rychlá rezervace");
  const [personCount, setPersonCount] = useState(1);
  const [isCoworkOpen, setIsCoworkOpen] = useState(false);

  const resetForm = () => {
    setTitle("Rychlá rezervace");
    setPersonCount(1);
    setIsCoworkOpen(false);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Zadej název rezervace");
      return;
    }

    if (personCount < 1) {
      setError("Počet osob musí být alespoň 1");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Calculate times
      const now = new Date();
      const startTime = roundToSlot(now);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + durationMinutes);

      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          title: title.trim(),
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          person_count: personCount,
          is_cowork_open: isCoworkOpen,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nepodařilo se vytvořit rezervaci");
      }

      toast.success("Rezervace vytvořena");
      // Success
      onOpenChange(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const getDurationLabel = () => {
    if (durationMinutes === 15) return "15 minut";
    if (durationMinutes === 30) return "30 minut";
    if (durationMinutes === 45) return "45 minut";
    return `${durationMinutes} minut`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading">Rychlá rezervace</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Room and duration info */}
          <div className="p-4 rounded-xl bg-muted/50 space-y-1 shadow-sm">
            <p className="font-heading font-semibold text-base">{roomName}</p>
            <p className="text-sm text-muted-foreground font-body">
              Délka: {getDurationLabel()}
            </p>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-heading font-medium">Název</Label>
            <Input
              id="title"
              placeholder="Např. Meeting, Práce..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="h-12 font-body rounded-md"
            />
          </div>

          {/* Person count and Cowork */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Users className="size-4 text-muted-foreground flex-shrink-0" />
              <Input
                type="number"
                min={1}
                max={50}
                value={personCount}
                onChange={(e) => setPersonCount(parseInt(e.target.value) || 1)}
                className="w-16 h-9 text-sm font-body"
              />
              <span className="text-sm text-muted-foreground font-body">osob</span>
            </div>

            <div className="flex items-center gap-2">
              <Share2 className="size-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-body">Cowork</span>
              <Switch
                checked={isCoworkOpen}
                onCheckedChange={setIsCoworkOpen}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md font-body">
              {error}
            </p>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !title.trim()}
            className="w-full h-12 font-heading font-semibold rounded-md"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Vytvářím...
              </>
            ) : (
              "Zarezervovat"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
