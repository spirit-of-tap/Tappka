import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CoachProcessingRow } from './coach-book-row';
import type { BookWithProfiles } from '@/lib/books/types';

const noop = vi.fn();
const PROCESSING_BOOK = {
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
  created_by: null,
  list_status_changed_by: null,
  essay_count: 0,
  tags: [],
  highlight_category: null,
} as unknown as BookWithProfiles;

afterEach(() => {
  vi.unstubAllGlobals();
  noop.mockClear();
});

describe('CoachProcessingRow re-enrichment', () => {
  it('offers re-running enrichment on a processing book', () => {
    render(
      <CoachProcessingRow
        book={PROCESSING_BOOK}
        onApprove={noop}
        onReject={noop}
        onDeleted={noop}
      />,
    );

    expect(screen.getByRole('button', { name: /dohledat údaje/i })).toBeInTheDocument();
  });

  it('writes the fresh description back to the book', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            title_cs: 'Sprint',
            title_en: 'Sprint',
            author: 'Jake Knapp',
            isbn_13: null,
            page_count: 288,
            description: 'Naučíš se otestovat nápad.',
            tag: 'Inovace & kreativita',
            suggested_points: 2,
            points_reason: 'Kategorie 2 — 288 stran.',
            confidence: 'high',
          },
          citations: [],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CoachProcessingRow
        book={PROCESSING_BOOK}
        onApprove={noop}
        onReject={noop}
        onDeleted={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /dohledat údaje/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/books/b1');
    expect(JSON.parse(init.body as string)).toMatchObject({
      action: 'edit',
      description: 'Naučíš se otestovat nápad.',
    });
  });
});
