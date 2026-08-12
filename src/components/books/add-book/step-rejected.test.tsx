import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { EnrichedBook } from '@/lib/books/enrichment/schema';
import type { ExternalBookCandidate } from '@/lib/books/types';

import { StepRejected } from './step-rejected';

const CANDIDATE: ExternalBookCandidate = {
  title: 'Harry Potter a Kámen mudrců',
  author: 'J. K. Rowling',
  isbn_13: '9788085787153',
  description: null,
  cover_url: 'https://books.google.com/hp.jpg',
  page_count: 320,
  publisher: 'Albatros',
  published_year: 1997,
  preview_link: null,
  source: 'google_books',
  external_id: 'vol-hp',
};

const REJECTED: EnrichedBook = {
  title_cs: 'Harry Potter a Kámen mudrců',
  title_en: "Harry Potter and the Philosopher's Stone",
  author: 'J. K. Rowling',
  isbn_13: '9788085787153',
  page_count: 320,
  description: 'ZAMÍTNUTO: Kniha nesouvisí se zaměřením programu TAP.',
  tag: 'Leadership',
  suggested_points: 0,
  points_reason: 'Beletrie — rozhoduje žánr, ne téma.',
  confidence: 'high',
  low_confidence_fields: [],
};

function renderStep(onAppeal = vi.fn(), onDiscard = vi.fn()) {
  render(
    <StepRejected
      candidate={CANDIDATE}
      enriched={REJECTED}
      onAppeal={onAppeal}
      onDiscard={onDiscard}
    />,
  );
}

describe('StepRejected', () => {
  it('names the book and why it was refused', () => {
    renderStep();

    expect(screen.getByText('Harry Potter a Kámen mudrců')).toBeInTheDocument();
    expect(screen.getByText('J. K. Rowling')).toBeInTheDocument();
    expect(screen.getByText('Beletrie — rozhoduje žánr, ne téma.')).toBeInTheDocument();
  });

  it('does not repeat the flat ZAMÍTNUTO sentence', () => {
    renderStep();

    expect(screen.queryByText(/ZAMÍTNUTO/)).not.toBeInTheDocument();
  });

  it('frames the refusal as Tappka doubting, not as a ban', () => {
    renderStep();

    expect(
      screen.getByRole('heading', { name: /nemyslí, že tahle kniha do boba patří/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/nezapíšeme/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /zkusit jinou knihu/i })).not.toBeInTheDocument();
  });

  it('makes discarding the main action', async () => {
    const onDiscard = vi.fn();
    renderStep(vi.fn(), onDiscard);

    const discard = screen.getByRole('button', { name: /zrušit přidávání/i });
    expect(discard).toHaveClass('bg-primary');

    await userEvent.click(discard);

    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('lets the submitter appeal to the coach', async () => {
    const onAppeal = vi.fn();
    renderStep(onAppeal);

    await userEvent.click(screen.getByRole('button', { name: /pokračovat přesto/i }));

    expect(onAppeal).toHaveBeenCalledTimes(1);
  });

  it('has no submit control of its own — the refusal holds by default', () => {
    renderStep();

    expect(screen.queryByRole('button', { name: /odeslat/i })).not.toBeInTheDocument();
  });
});
