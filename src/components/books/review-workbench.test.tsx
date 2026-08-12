import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReviewWorkbench } from './review-workbench';
import type { BookWithProfiles } from '@/lib/books/types';

function book(overrides: Partial<BookWithProfiles>): BookWithProfiles {
  return {
    id: 'b1',
    title_cs: 'Sprint',
    title_en: null,
    author: 'Jake Knapp',
    description: null,
    book_points: null,
    list_status: 'processing',
    list_status_reason: null,
    page_count: 288,
    source: 'manual',
    external_id: null,
    google_books_cover_url: null,
    is_rocket_model: false,
    isbn_13: null,
    created_at: '2026-08-01T10:00:00Z',
    created_by: null,
    list_status_changed_by: null,
    essay_count: 0,
    tags: [],
    highlight_category: null,
    ...overrides,
  } as unknown as BookWithProfiles;
}

// Both carry a complete AI suggestion, so the bar opens in confirm mode and a
// decision is a single click — the queue's normal case.
const BOOKS = [
  book({ id: 'b1', title_cs: 'Sprint', book_points: 2, list_status_reason: 'Kategorie 2.' }),
  book({ id: 'b2', title_cs: 'Ikigai', book_points: 1, list_status_reason: 'Kategorie 1.' }),
];

function renderWorkbench(books: BookWithProfiles[], onDecide = vi.fn().mockResolvedValue(true)) {
  const onEdited = vi.fn();
  const onDeleted = vi.fn();

  render(
    <ReviewWorkbench
      books={books}
      onDecide={onDecide}
      onEdited={onEdited}
      onDeleted={onDeleted}
    />,
  );

  return { onDecide, onEdited, onDeleted };
}

/** The detail panel renders the title as a link; the queue rail renders plain text. */
const detailTitle = (name: string) => screen.getByRole('link', { name });

describe('ReviewWorkbench', () => {
  it('opens on the head of the queue without an explicit pick', () => {
    renderWorkbench(BOOKS);

    expect(detailTitle('Sprint')).toBeInTheDocument();
  });

  it('shows the book the coach picks from the rail', async () => {
    renderWorkbench(BOOKS);

    await userEvent.click(screen.getByText('Ikigai'));

    expect(detailTitle('Ikigai')).toBeInTheDocument();
  });

  it('advances to the next book once one is decided', async () => {
    const { onDecide } = renderWorkbench(BOOKS);

    await userEvent.click(screen.getByRole('button', { name: /schválit do longlistu/i }));

    await waitFor(() => expect(onDecide).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1' }),
      2,
      'Kategorie 2.',
    ));
    await waitFor(() => expect(detailTitle('Ikigai')).toBeInTheDocument());
  });

  it('stays put when the decision fails, so nothing is silently skipped', async () => {
    const { onDecide } = renderWorkbench(BOOKS, vi.fn().mockResolvedValue(false));

    await userEvent.click(screen.getByRole('button', { name: /schválit do longlistu/i }));

    await waitFor(() => expect(onDecide).toHaveBeenCalled());
    expect(detailTitle('Sprint')).toBeInTheDocument();
  });

  it('renders the empty state when nothing is waiting', () => {
    renderWorkbench([]);

    expect(screen.getByText('Fronta je prázdná')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /schválit do longlistu/i })).not.toBeInTheDocument();
  });
});
