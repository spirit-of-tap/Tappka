"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import type { BirthGivingEventDetail } from "@/lib/birth-giving/types";

interface BirthGivingTeamFormProps {
  eventId: string;
  onSuccess: (event: BirthGivingEventDetail | null) => void;
  onCancel: () => void;
}

export function BirthGivingTeamForm({ eventId, onSuccess, onCancel }: BirthGivingTeamFormProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Název týmu je povinný");
      return;
    }
    setLoading(true);
    try {
      const result = await birthGivingMutationRequest(`/api/birth-giving/events/${eventId}/teams`, {
        body: { name: trimmed },
      });
      if (result.ok && result.body.data) {
        toast.success("Tým byl vytvořen");
        onSuccess(result.body.data);
      } else {
        toast.error(result.body.error ?? "Tým se nepodařilo vytvořit");
        if (!result.body.data) onSuccess(null);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="space-y-2">
        <Label htmlFor="bg-team-name">Název týmu</Label>
        <Input
          id="bg-team-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Např. Tým Alfa"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Zrušit
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
          Vytvořit tým
        </Button>
      </div>
    </form>
  );
}