"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface BirthGivingReflectionValues {
  contribution: string;
  learning: string;
}

interface BirthGivingReflectionFormProps {
  initial?: BirthGivingReflectionValues;
  onSubmit: (values: BirthGivingReflectionValues) => void | Promise<void>;
  onCancel: () => void;
}

export function BirthGivingReflectionForm({
  initial,
  onSubmit,
  onCancel,
}: BirthGivingReflectionFormProps) {
  const [contribution, setContribution] = useState(initial?.contribution ?? "");
  const [learning, setLearning] = useState(initial?.learning ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
      await onSubmit({ contribution: contribution.trim(), learning: learning.trim() });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="space-y-2">
        <Label htmlFor="bg-reflection-contribution">Přínos</Label>
        <Textarea
          id="bg-reflection-contribution"
          value={contribution}
          onChange={(event) => setContribution(event.target.value)}
          placeholder="Co jsi do týmu přidal:a"
          rows={4}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bg-reflection-learning">Poučení</Label>
        <Textarea
          id="bg-reflection-learning"
          value={learning}
          onChange={(event) => setLearning(event.target.value)}
          placeholder="Co ses naučil:a"
          rows={4}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Zrušit
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
          Uložit reflexi
        </Button>
      </div>
    </form>
  );
}