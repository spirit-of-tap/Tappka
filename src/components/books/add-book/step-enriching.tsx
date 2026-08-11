'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, PencilLine, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { EnrichedBook } from '@/lib/books/enrichment/schema';

/** Named so the wait reads as progress rather than a hang. */
const PHASES = [
  'Hledám český popis a hodnocení…',
  'Porovnávám s knihami v BOBovi…',
  'Hodnotím podle kritérií…',
] as const;
const PHASE_INTERVAL_MS = 6_000;

interface EnrichProbe {
  title: string;
  author: string;
  isbn_13: string | null;
  page_count: number | null;
  publisher: string | null;
  published_year: number | null;
}

interface StepEnrichingProps {
  probe: EnrichProbe;
  onDone: (enriched: EnrichedBook, citations: string[]) => void;
  onManual: () => void;
}

export function StepEnriching({ probe, onDone, onManual }: StepEnrichingProps) {
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const run = useCallback(async () => {
    setError(null);
    setPhase(0);
    try {
      const res = await fetch('/api/books/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(probe),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Údaje se nepodařilo dohledat.');
        return;
      }
      onDone(json.data as EnrichedBook, json.citations ?? []);
    } catch {
      setError('Nepodařilo se připojit k serveru.');
    }
  }, [probe, onDone]);

  useEffect(() => {
    void run();
  }, [run, attempt]);

  useEffect(() => {
    if (error) return;
    const id = setInterval(
      () => setPhase((current) => Math.min(current + 1, PHASES.length - 1)),
      PHASE_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [error]);

  if (error) {
    return (
      <div className="space-y-4 rounded-xl border border-amber-300/50 bg-amber-50/50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-medium">{error}</p>
            <p className="text-sm text-muted-foreground">
              Můžeš to zkusit znovu, nebo údaje vyplnit sám — kniha se dá odeslat i tak.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setAttempt((n) => n + 1)}>
            <RotateCw className="size-4" />
            Zkusit znovu
          </Button>
          <Button className="gap-2" onClick={onManual}>
            <PencilLine className="size-4" />
            Vyplnit ručně
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-10 text-center">
      <Spinner className="mx-auto size-6" />
      <div className="space-y-1">
        <p className="font-medium">{PHASES[phase]}</p>
        <p className="text-sm text-muted-foreground">
          {probe.title} — může to trvat půl minuty.
        </p>
      </div>
    </div>
  );
}
