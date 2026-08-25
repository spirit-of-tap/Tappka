"use client";

import { useState } from "react";
import { MessageSquarePlus, Loader2, PencilLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import type { BirthGivingEventDetail } from "@/lib/birth-giving/types";

interface BirthGivingReflectionFormProps {
  eventId: string;
  currentContribution?: string;
  currentLearning?: string;
  trigger?: React.ReactNode;
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

export function BirthGivingReflectionForm({
  eventId,
  currentContribution = "",
  currentLearning = "",
  trigger,
  onEventChange,
}: BirthGivingReflectionFormProps) {
  const [open, setOpen] = useState(false);
  const [contribution, setContribution] = useState(currentContribution);
  const [learning, setLearning] = useState(currentLearning);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasReflection = Boolean(currentContribution.trim() || currentLearning.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!contribution.trim()) {
      setError("Přínos je povinný");
      return;
    }
    if (!learning.trim()) {
      setError("Poučení je povinné");
      return;
    }
    setLoading(true);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/events/${eventId}/reflection`,
        {
          method: "PUT",
          body: { contribution: contribution.trim(), learning: learning.trim() },
        },
      );
      if (result.ok) {
        toast.success("Reflexe byla uložena");
        setOpen(false);
        onEventChange(result.body.data ?? null);
        return;
      }
      toast.error(result.body.error ?? "Reflexi se nepodařilo uložit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="xs" variant={hasReflection ? "ghost" : "outline"} className="gap-1 text-xs">
            {hasReflection ? (
              <>
                <PencilLine className="size-3.5" />
                Upravit reflexi
              </>
            ) : (
              <>
                <MessageSquarePlus className="size-3.5" />
                Napsat reflexi
              </>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{hasReflection ? "Upravit reflexi" : "Napsat reflexi"}</DialogTitle>
          <DialogDescription>
            Popište svůj osobní přínos a co jste se během práce na projektu naučili:y.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="bg-reflection-contribution">V čem spočíval váš přínos týmu?</Label>
            <Textarea
              id="bg-reflection-contribution"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              placeholder="Např. Připravil:a jsem návrh architektury a frontendové komponenty..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bg-reflection-learning">Co jste se naučili:y nebo co byste příště udělali:y jinak?</Label>
            <Textarea
              id="bg-reflection-learning"
              value={learning}
              onChange={(e) => setLearning(e.target.value)}
              placeholder="Např. Příště lépe naplánovat čas na integraci..."
              rows={3}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Zrušit
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
              Uložit reflexi
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}