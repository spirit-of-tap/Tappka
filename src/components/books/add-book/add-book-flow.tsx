'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import type { CreateBookInput, ExternalBookCandidate } from '@/lib/books/types';
import type { EnrichedBook } from '@/lib/books/enrichment/schema';

import { StepEnriching } from './step-enriching';
import { StepGate } from './step-gate';
import { StepReview } from './step-review';
import { StepSearch } from './step-search';
import { EMPTY_DRAFT, type AddBookDraft } from './types';

const DRAFT_STORAGE_KEY = 'tappka:add-book-draft';

type Step = 'gate' | 'search' | 'enriching' | 'review';

const STEP_LABELS: Record<Step, string> = {
  gate: 'Patří do BOBa?',
  search: 'Najdi knihu',
  enriching: 'Doplňujeme údaje',
  review: 'Zkontroluj a odešli',
};

const STEP_ORDER: Step[] = ['gate', 'search', 'enriching', 'review'];

interface PersistedFlow {
  step: Step;
  draft: AddBookDraft;
}

function readPersisted(): PersistedFlow | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedFlow;
  } catch {
    return null;
  }
}

interface AddBookFlowProps {
  initialQuery: string;
  /** Where to go after a successful submit; the new book id is appended as `?book=`. */
  returnTo: string | null;
}

export function AddBookFlow({ initialQuery, returnTo }: AddBookFlowProps) {
  const router = useRouter();
  const persisted = readPersisted();

  const [step, setStep] = useState<Step>(persisted?.step ?? 'gate');
  const [draft, setDraft] = useState<AddBookDraft>(persisted?.draft ?? EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);

  // Survive a refresh so an enrichment already paid for is not thrown away.
  useEffect(() => {
    if (step === 'gate') {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ step, draft }));
  }, [step, draft]);

  const handleSelect = useCallback((candidate: ExternalBookCandidate) => {
    setDraft({ ...EMPTY_DRAFT, candidate });
    setStep('enriching');
  }, []);

  const handleManualCandidate = useCallback((title: string, author: string) => {
    setDraft({
      ...EMPTY_DRAFT,
      candidate: {
        title,
        author,
        isbn_13: null,
        description: null,
        cover_url: null,
        page_count: null,
        publisher: null,
        published_year: null,
        preview_link: null,
        source: 'manual',
        external_id: '',
      },
    });
    setStep('enriching');
  }, []);

  const handleEnriched = useCallback((enriched: EnrichedBook, citations: string[]) => {
    setDraft((current) => ({ ...current, enriched, citations, manual: false }));
    setStep('review');
  }, []);

  const handleFillManually = useCallback(() => {
    setDraft((current) => ({ ...current, enriched: null, citations: [], manual: true }));
    setStep('review');
  }, []);

  const handleSubmit = useCallback(
    async (input: CreateBookInput) => {
      setSubmitting(true);
      try {
        const res = await fetch('/api/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const json = await res.json();

        if (res.status === 409 && json.existingId) {
          toast.info('Tuhle knihu už v BOBovi máme.');
          window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
          router.push(`/cteni/knihy/${json.existingId}`);
          return;
        }

        if (!res.ok || !json.data?.id) {
          // Never report a save the database refused.
          toast.error(json.error ?? 'Knihu se nepodařilo uložit.');
          return;
        }

        window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        toast.success('Kniha odeslána ke schválení.');
        router.push(
          returnTo ? `${returnTo}?book=${json.data.id}` : `/cteni/knihy/${json.data.id}`,
        );
      } catch {
        toast.error('Nepodařilo se připojit k serveru.');
      } finally {
        setSubmitting(false);
      }
    },
    [returnTo, router],
  );

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {STEP_ORDER.map((candidateStep, index) => (
          <li
            key={candidateStep}
            aria-current={candidateStep === step ? 'step' : undefined}
            className={cn(
              'flex items-center gap-1.5',
              candidateStep === step ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            <span className="tabular-nums">{index + 1}.</span>
            {STEP_LABELS[candidateStep]}
          </li>
        ))}
      </ol>

      {step === 'gate' && <StepGate onContinue={() => setStep('search')} />}

      {step === 'search' && (
        <StepSearch
          initialQuery={initialQuery}
          onSelect={handleSelect}
          onManual={handleManualCandidate}
        />
      )}

      {step === 'enriching' && draft.candidate && (
        <StepEnriching
          probe={{
            title: draft.candidate.title,
            author: draft.candidate.author,
            isbn_13: draft.candidate.isbn_13,
            page_count: draft.candidate.page_count,
            publisher: draft.candidate.publisher,
            published_year: draft.candidate.published_year,
          }}
          onDone={handleEnriched}
          onManual={handleFillManually}
        />
      )}

      {step === 'review' && (
        <StepReview draft={draft} submitting={submitting} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
