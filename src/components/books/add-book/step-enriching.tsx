'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, Check, PencilLine, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { EnrichedBook } from '@/lib/books/enrichment/schema';

/**
 * The work, in the order it happens. Item 0 is already done on arrival — the
 * candidate came from Krok 2 — which makes the list start with a win rather
 * than four hollow rings.
 */
const ENRICH_PHASES = [
  'Mám knihu',
  'Hledám český popis',
  'Porovnávám s BOBem',
  'Hodnotím body',
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
  /** Remote Google Books cover, when the candidate came with one. */
  coverUrl?: string | null;
  onDone: (enriched: EnrichedBook, citations: string[]) => void;
  onManual: () => void;
}

export function StepEnriching({ probe, coverUrl, onDone, onManual }: StepEnrichingProps) {
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/books/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(probe),
    })
      .then(async (res) => {
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? 'Údaje se nepodařilo dohledat.');
          return;
        }
        onDone(json.data as EnrichedBook, json.citations ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Nepodařilo se připojit k serveru.');
      });
    return () => {
      cancelled = true;
    };
  }, [probe, attempt, onDone]);

  // The phase only moves on while a request is in flight; the counter resets
  // it after a retry so the list reads as "trying again".
  const handleRetry = () => {
    setError(null);
    setPhase(0);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    if (error) return;
    const id = setInterval(
      () => setPhase((current) => Math.min(current + 1, ENRICH_PHASES.length - 2)),
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
              Zkus to znovu, nebo údaje vyplň ručně.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={handleRetry}>
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
    <div className="space-y-5 rounded-xl border bg-card p-5">
      <div className="flex gap-5">
        <div className="flex h-32 w-22 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-border">
          {coverUrl ? (
            // Remote cover, not yet in storage — plain img is correct here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt={probe.title} className="h-full w-full object-cover" />
          ) : (
            <BookOpen className="size-6 text-muted-foreground/40" />
          )}
        </div>

        <ol className="flex-1 space-y-2.5">
          {ENRICH_PHASES.map((label, index) => {
            const done = index <= phase;
            const running = index === phase + 1;

            return (
              <li
                key={label}
                aria-current={running ? 'step' : undefined}
                data-state={done ? 'done' : running ? 'running' : 'upcoming'}
                className="flex items-center gap-2.5 text-sm"
              >
                <span className="flex size-5 shrink-0 items-center justify-center">
                  {done ? (
                    <Check className="size-4 text-success-strong" />
                  ) : running ? (
                    <Spinner className="size-4 text-primary" />
                  ) : (
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full ring-1 ring-border ring-inset"
                    />
                  )}
                </span>
                <span
                  className={cn(
                    running && 'font-medium',
                    !done && !running && 'text-muted-foreground/60',
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="text-sm text-muted-foreground">
        {probe.title} · {probe.author} — chvilku to trvá, asi půl minuty.
      </p>
    </div>
  );
}
