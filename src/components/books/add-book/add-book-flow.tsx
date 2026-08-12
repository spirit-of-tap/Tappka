'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import type { CreateBookInput, ExternalBookCandidate, GateExemplar } from '@/lib/books/types';
import type { EnrichedBook } from '@/lib/books/enrichment/schema';

import { FlowMap, type FlowNode } from './flow-map';
import { StepEnriching } from './step-enriching';
import { StepGate } from './step-gate';
import { StepRejected } from './step-rejected';
import { StepReview } from './step-review';
import { StepSearch } from './step-search';
import { EMPTY_DRAFT, type AddBookDraft } from './types';

const DRAFT_STORAGE_KEY = 'tappka:add-book-draft';

type Step = 'gate' | 'search' | 'enriching' | 'rejected' | 'review';

/** A refusal happens while the model is working, so the map still points there. */
const STEP_NODE: Record<Step, FlowNode> = {
  gate: 'gate',
  search: 'search',
  enriching: 'enriching',
  rejected: 'enriching',
  review: 'review',
};

interface PersistedFlow {
  step: Step;
  draft: AddBookDraft;
}

function readPersisted(): PersistedFlow | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedFlow;
    // Fill in fields a draft written by an earlier version would not have.
    return { ...parsed, draft: { ...EMPTY_DRAFT, ...parsed.draft } };
  } catch {
    return null;
  }
}

interface AddBookFlowProps {
  initialQuery: string;
  /** Books to show on the gate as examples of what belongs. May be empty. */
  exemplars: GateExemplar[];
  /** Where to go after a successful submit; the new book id is appended as `?book=`. */
  returnTo: string | null;
}

export function AddBookFlow({ initialQuery, exemplars, returnTo }: AddBookFlowProps) {
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
    // A zero is the rubric's refusal, not a low score — it never reaches the form.
    setStep(enriched.suggested_points === 0 ? 'rejected' : 'review');
  }, []);

  const handleFillManually = useCallback(() => {
    setDraft((current) => ({ ...current, enriched: null, citations: [], manual: true }));
    setStep('review');
  }, []);

  const handleSearchAgain = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setStep('search');
  }, []);

  const handleAppeal = useCallback(() => {
    setDraft((current) => ({ ...current, appealing: true }));
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
    <div className="space-y-7">
      <FlowMap
        active={STEP_NODE[step]}
        variant={step === 'gate' ? 'expanded' : 'compact'}
      />

      {step === 'gate' && (
        <StepGate exemplars={exemplars} onContinue={() => setStep('search')} />
      )}

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
          coverUrl={draft.candidate.cover_url}
          onDone={handleEnriched}
          onManual={handleFillManually}
        />
      )}

      {step === 'rejected' && draft.candidate && draft.enriched && (
        <StepRejected
          candidate={draft.candidate}
          enriched={draft.enriched}
          onSearchAgain={handleSearchAgain}
          onAppeal={handleAppeal}
        />
      )}

      {step === 'review' && (
        <StepReview draft={draft} submitting={submitting} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
