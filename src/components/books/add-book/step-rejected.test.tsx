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

describe('StepRejected', () => {
  it('names the book and why it was refused', () => {
    render(
      <StepRejected
        candidate={CANDIDATE}
        enriched={REJECTED}
        onSearchAgain={vi.fn()}
        onAppeal={vi.fn()}
      />,
    );

    expect(screen.getByText('Harry Potter a Kámen mudrců')).toBeInTheDocument();
    expect(screen.getByText('J. K. Rowling')).toBeInTheDocument();
    expect(screen.getByText('Beletrie — rozhoduje žánr, ne téma.')).toBeInTheDocument();
  });

  it('does not repeat the flat ZAMÍTNUTO sentence', () => {
    render(
      <StepRejected
        candidate={CANDIDATE}
        enriched={REJECTED}
        onSearchAgain={vi.fn()}
        onAppeal={vi.fn()}
      />,
    );

    expect(screen.queryByText(/ZAMÍTNUTO/)).not.toBeInTheDocument();
  });

  it('offers searching for another book as the main way out', async () => {
    const onSearchAgain = vi.fn();
    render(
      <StepRejected
        candidate={CANDIDATE}
        enriched={REJECTED}
        onSearchAgain={onSearchAgain}
        onAppeal={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /zkusit jinou knihu/i }));

    expect(onSearchAgain).toHaveBeenCalledTimes(1);
  });

  it('lets the submitter appeal to the coach', async () => {
    const onAppeal = vi.fn();
    render(
      <StepRejected
        candidate={CANDIDATE}
        enriched={REJECTED}
        onSearchAgain={vi.fn()}
        onAppeal={onAppeal}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /pošli to kouči/i }));

    expect(onAppeal).toHaveBeenCalledTimes(1);
  });

  it('has no submit control of its own — the refusal holds by default', () => {
    render(
      <StepRejected
        candidate={CANDIDATE}
        enriched={REJECTED}
        onSearchAgain={vi.fn()}
        onAppeal={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /odeslat/i })).not.toBeInTheDocument();
  });
});
