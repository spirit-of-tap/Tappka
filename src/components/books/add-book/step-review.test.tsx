import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StepReview } from './step-review';
import type { AddBookDraft } from './types';

const CANDIDATE = {
  title: 'Sprint',
  author: 'Jake Knapp',
  isbn_13: '9781501121746',
  description: null,
  cover_url: null,
  page_count: 288,
  publisher: 'Simon & Schuster',
  published_year: 2016,
  preview_link: 'https://books.google.com/x',
  source: 'google_books' as const,
  external_id: 'vol-1',
};

const ENRICHED_DRAFT: AddBookDraft = {
  candidate: CANDIDATE,
  enriched: {
    title_cs: 'Sprint',
    title_en: 'Sprint',
    author: 'Jake Knapp',
    isbn_13: '9781501121746',
    page_count: 288,
    description: 'Naučíš se otestovat nápad za pět dní. Je to hutné.',
    tag: 'Inovace & kreativita',
    suggested_points: 2,
    points_reason: 'Kategorie 2 — procesní manuál, 288 stran.',
    confidence: 'high',
    low_confidence_fields: [],
  },
  citations: ['https://goodreads.com/sprint'],
  manual: false,
};

const MANUAL_DRAFT: AddBookDraft = {
  candidate: CANDIDATE,
  enriched: null,
  citations: [],
  manual: true,
};

describe('StepReview', () => {
  it('shows the whole record including the points rationale and the sources', () => {
    render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/český název/i)).toHaveValue('Sprint');
    expect(screen.getByText(/procesní manuál/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /goodreads/i })).toBeInTheDocument();
  });

  it('states that a coach reviews it and gets an email', () => {
    render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={vi.fn()} />);

    expect(screen.getByText(/schválení kouči/i)).toBeInTheDocument();
    expect(screen.getByText(/e-mail/i)).toBeInTheDocument();
  });

  it('submits the edited record with points and rationale', async () => {
    const onSubmit = vi.fn();
    render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: /odeslat/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sprint',
        title_en: 'Sprint',
        author: 'Jake Knapp',
        page_count: 288,
        book_points: 2,
        points_reason: 'Kategorie 2 — procesní manuál, 288 stran.',
        tags: ['Inovace & kreativita'],
        source: 'google_books',
        preview_link: 'https://books.google.com/x',
      }),
    );
  });

  it('forwards the remote cover URL unchanged rather than downloading it', async () => {
    const onSubmit = vi.fn();
    const withCover: AddBookDraft = {
      ...ENRICHED_DRAFT,
      candidate: { ...CANDIDATE, cover_url: 'https://books.google.com/cover.jpg' },
    };
    render(<StepReview draft={withCover} submitting={false} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: /odeslat/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ google_books_cover_url: 'https://books.google.com/cover.jpg' }),
    );
  });

  it('blocks submission until description and tag are filled in manual mode', async () => {
    render(<StepReview draft={MANUAL_DRAFT} submitting={false} onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: /odeslat/i })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/popis/i), 'Proč to číst: naučíš se…');
    await userEvent.selectOptions(screen.getByLabelText(/oblast/i), 'Leadership');
    await userEvent.click(screen.getByRole('button', { name: /1 b\./i }));

    expect(screen.getByRole('button', { name: /odeslat/i })).toBeEnabled();
  });

  it('blocks submission when the title is cleared', async () => {
    render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={vi.fn()} />);

    await userEvent.clear(screen.getByLabelText(/český název/i));

    expect(screen.getByRole('button', { name: /odeslat/i })).toBeDisabled();
  });

  it('offers a 0-point rejection option and submits it', async () => {
    const onSubmit = vi.fn();
    render(<StepReview draft={ENRICHED_DRAFT} submitting={false} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: /0 b\./i }));
    await userEvent.click(screen.getByRole('button', { name: /odeslat/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ book_points: 0 }));
  });

  it('warns about unverified fields when confidence is low', () => {
    render(
      <StepReview
        draft={{ ...ENRICHED_DRAFT, enriched: { ...ENRICHED_DRAFT.enriched!, confidence: 'low' } }}
        submitting={false}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/nejsme jist/i)).toBeInTheDocument();
  });

  it('names the uncertain fields in the banner and highlights their inputs', () => {
    render(
      <StepReview
        draft={{
          ...ENRICHED_DRAFT,
          enriched: {
            ...ENRICHED_DRAFT.enriched!,
            confidence: 'low',
            low_confidence_fields: ['author', 'page_count', 'isbn_13'],
          },
        }}
        submitting={false}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/nejsme si jistí těmito údaji:/i)).toBeInTheDocument();
    expect(screen.getByText(/autor, isbn, počet stran/i)).toBeInTheDocument();

    expect(screen.getByLabelText(/autor/i)).toHaveAttribute('data-uncertain', 'true');
    expect(screen.getByLabelText(/počet stran/i)).toHaveAttribute('data-uncertain', 'true');
    expect(screen.getByLabelText(/český název/i)).not.toHaveAttribute('data-uncertain');
  });

  it('does not highlight inputs the model is certain about', () => {
    render(
      <StepReview
        draft={{
          ...ENRICHED_DRAFT,
          enriched: {
            ...ENRICHED_DRAFT.enriched!,
            confidence: 'low',
            low_confidence_fields: ['title_cs'],
          },
        }}
        submitting={false}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/český název/i)).toHaveAttribute('data-uncertain', 'true');
    expect(screen.getByLabelText(/autor/i)).not.toHaveAttribute('data-uncertain');
  });
});
