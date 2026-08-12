'use client';

import { BookOpen, Send, ShieldX, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { EnrichedBook } from '@/lib/books/enrichment/schema';
import type { ExternalBookCandidate } from '@/lib/books/types';

interface StepRejectedProps {
  candidate: ExternalBookCandidate;
  enriched: EnrichedBook;
  /** Send it to the coach anyway, as an appeal against the model's refusal. */
  onAppeal: () => void;
  /** Discard the whole adding process; the flow clears the draft and navigates back. */
  onDiscard: () => void;
}

/**
 * The second layer of protection: the model read the book and said no.
 *
 * The reason shown is `points_reason`, which the rubric requires on every
 * refusal. `description` — the flat "ZAMÍTNUTO: …" sentence — is deliberately
 * not shown; it says the same thing with less information.
 */
export function StepRejected({
  candidate,
  enriched,
  onAppeal,
  onDiscard,
}: StepRejectedProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border border-destructive/25 bg-destructive/5 p-5">
        <div className="flex items-center gap-2.5">
          <ShieldX className="size-5 shrink-0 text-destructive" />
          <h2 className="font-heading text-lg font-bold">
            Tappka si nemyslí, že tahle kniha do BOBa patří
          </h2>
        </div>

        <div className="flex gap-4">
          <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-border">
            {candidate.cover_url ? (
              // Remote cover, not yet in storage — plain img is correct here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={candidate.cover_url}
                alt={candidate.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <BookOpen className="size-5 text-muted-foreground/40" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium">{candidate.title}</p>
            <p className="text-sm text-muted-foreground">{candidate.author}</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed">{enriched.points_reason}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onDiscard} size="lg" className="gap-2">
          <X className="size-4" />
          Zrušit přidávání
        </Button>
        <Button variant="outline" size="lg" className="gap-2" onClick={onAppeal}>
          <Send className="size-4" />
          Pokračovat přesto
        </Button>
      </div>
    </div>
  );
}
