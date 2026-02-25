"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Lock, Trash2, Wrench, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { IssueType } from "@/lib/reservations/types";

interface IssueReportButtonProps {
  roomId: string;
}

const ISSUE_TYPES: { type: IssueType; label: string; icon: React.ElementType; description: string }[] = [
  {
    type: "locked",
    label: "Zamčená místnost",
    icon: Lock,
    description: "Nedá se dostat dovnitř",
  },
  {
    type: "mess",
    label: "Nepořádek",
    icon: Trash2,
    description: "Někdo nechal nepořádek",
  },
  {
    type: "technical",
    label: "Technický problém",
    icon: Wrench,
    description: "Něco nefunguje",
  },
  {
    type: "other",
    label: "Jiné",
    icon: HelpCircle,
    description: "Jiný problém",
  },
];

/**
 * Button and dialog for reporting room issues
 */
export function IssueReportButton({ roomId }: IssueReportButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<IssueType | null>(null);
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedType) {
      setError("Vyber typ problému");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/room-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          issue_type: selectedType,
          description: description.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nepodařilo se nahlásit problém");
      }

      toast.success("Problém nahlášen");
      // Success
      setOpen(false);
      setSelectedType(null);
      setDescription("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Něco se pokazilo");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <AlertTriangle className="size-4 mr-2" />
          Nahlásit problém
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nahlásit problém s místností</DialogTitle>
          <DialogDescription>
            Vyber typ problému a případně přidej popis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Issue type selection */}
          <div className="grid grid-cols-2 gap-2">
            {ISSUE_TYPES.map(({ type, label, icon: Icon, description }) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all text-left",
                  selectedType === type
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "hover:border-muted-foreground/50"
                )}
              >
                <Icon className="size-6" />
                <div className="text-center">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Popis (volitelné)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detaily problému..."
              rows={3}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !selectedType}
            className="w-full"
          >
            {isLoading ? "Odesílám..." : "Nahlásit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
