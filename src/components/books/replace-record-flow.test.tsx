import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReplaceRecordFlow } from './replace-record-flow';
import type { BookWithProfiles } from '@/lib/books/types';

const { error: toastError } = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

function book(overrides: Partial<BookWithProfiles> = {}): BookWithProfiles {
  return {
    id: 'b1', title_cs: 'Sprint', title_en: null, author: 'Jake Knapp',
    description: null, book_points: null, list_status: 'processing',
    list_status_reason: null, page_count: 288, source: 'google_books',
    external_id: 'v1', google_books_cover_url: 'https://books.google.com/old.jpg',
    is_rocket_model: false, isbn_13: '9780593076118',
    created_at: '2026-08-01T10:00:00Z', created_by: null,
    list_status_changed_by: null, essay_count: 0, tags: [],
    highlight_category: null,
    ...overrides,
  } as unknown as BookWithProfiles;
}

const CANDIDATE = {
  title: 'Sprint (CZ)', author: 'Jake Knapp', isbn_13: '9788027504376',
  description: null, cover_url: 'https://books.google.com/new.jpg', page_count: 288,
  publisher: 'Jan Melvil', published_year: 2019, preview_link: null,
  source: 'google_books', external_id: 'v2',
};

afterEach(() => {
  vi.unstubAllGlobals();
  toastError.mockReset();
});

describe('ReplaceRecordFlow', () => {
  it('searches, picks a record and PATCHes replace-record with the correct payload', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [CANDIDATE] }) }) // external-search
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { ...book(), isbn_13: CANDIDATE.isbn_13 } }) })); // PATCH

    const onReplaced = vi.fn();
    render(<ReplaceRecordFlow book={book()} onBack={vi.fn()} onReplaced={onReplaced} />);

    await userEvent.type(screen.getByPlaceholderText(/hledat podle názvu, autora nebo isbn/i), 'sprint');
    const pick = await screen.findByText('Sprint (CZ)');
    await userEvent.click(pick);
    await userEvent.click(screen.getByRole('button', { name: /potvrdit náhradu/i }));

    await waitFor(() => expect(onReplaced).toHaveBeenCalledTimes(1));

    const patchCall = vi.mocked(fetch).mock.calls.find(([url]) =>
      String(url).includes('/api/books/b1'));
    expect(patchCall?.[1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({
        action: 'replace-record',
        cover_url: 'https://books.google.com/new.jpg',
        isbn_13: '9788027504376',
        external_id: 'v2',
        source: 'google_books',
      }),
    });
  });

  it('shows a search error when the external search fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Externí hledání selhalo' }),
    }));

    render(<ReplaceRecordFlow book={book()} onBack={vi.fn()} onReplaced={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/hledat podle názvu, autora nebo isbn/i), 'sprint');

    await waitFor(() => expect(screen.getByText(/externí hledání selhalo/i)).toBeInTheDocument());
  });

  it('lets the coach go back to the search from the confirm step', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [CANDIDATE] }) }));

    const onBack = vi.fn();
    render(<ReplaceRecordFlow book={book()} onBack={onBack} onReplaced={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/hledat podle názvu, autora nebo isbn/i), 'sprint');
    await userEvent.click(await screen.findByText('Sprint (CZ)'));
    await userEvent.click(screen.getByRole('button', { name: /zpět/i }));

    expect(screen.getByPlaceholderText(/hledat podle názvu, autora nebo isbn/i)).toBeInTheDocument();
  });

  it('does not replace the record when the PATCH fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [CANDIDATE] }) }) // external-search
      .mockRejectedValueOnce(new Error('network down'))); // PATCH

    const onReplaced = vi.fn();
    render(<ReplaceRecordFlow book={book()} onBack={vi.fn()} onReplaced={onReplaced} />);

    await userEvent.type(screen.getByPlaceholderText(/hledat podle názvu, autora nebo isbn/i), 'sprint');
    await userEvent.click(await screen.findByText('Sprint (CZ)'));
    await userEvent.click(screen.getByRole('button', { name: /potvrdit náhradu/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Nepodařilo se nahradit záznam'));
    expect(onReplaced).not.toHaveBeenCalled();
  });
});
