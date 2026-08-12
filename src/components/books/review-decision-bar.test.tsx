import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReviewDecisionBar } from './review-decision-bar';
import type { BookWithProfiles } from '@/lib/books/types';

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

function renderBar(book: Partial<BookWithProfiles> = {}, props: Record<string, unknown> = {}) {
  const onApprove = vi.fn().mockResolvedValue(true);
  const onReject = vi.fn().mockResolvedValue(true);
  const onEnriched = vi.fn();
  const onDeleted = vi.fn();

  render(
    <ReviewDecisionBar
      book={{ ...PROCESSING_BOOK, ...book }}
      onApprove={onApprove}
      onReject={onReject}
      onEnriched={onEnriched}
      onDeleted={onDeleted}
      {...props}
    />,
  );

  return { onApprove, onReject, onEnriched, onDeleted };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ReviewDecisionBar points', () => {
  it("opens on the AI's suggestion rather than a hardcoded 1", () => {
    renderBar({ book_points: 3 });

    expect(screen.getByRole('radio', { name: '3 body' })).toHaveAttribute('data-state', 'on');
    expect(screen.getByText('shodné s návrhem AI')).toBeInTheDocument();
  });

  it('falls back to 1 when the AI never scored the book', () => {
    renderBar({ book_points: null });

    expect(screen.getByRole('radio', { name: '1 bod' })).toHaveAttribute('data-state', 'on');
    expect(screen.queryByText('shodné s návrhem AI')).not.toBeInTheDocument();
  });


  it('flags an override once the coach moves off the suggestion', async () => {
    renderBar({ book_points: 3 });

    await userEvent.click(screen.getByRole('radio', { name: '1 bod' }));

    expect(screen.getByText('návrh AI: 3')).toBeInTheDocument();
  });

  it('submits the points the coach picked', async () => {
    const { onApprove } = renderBar({ book_points: 1 });

    await userEvent.type(screen.getByLabelText(/důvod rozhodnutí/i), 'Sedí do longlistu.');
    await userEvent.click(screen.getByRole('radio', { name: '2 body' }));
    await userEvent.click(screen.getByRole('button', { name: /schválit do longlistu/i }));

    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1' }), 2, 'Sedí do longlistu.');
  });
});

describe('ReviewDecisionBar reason', () => {
  it("prefills from the AI's stored rationale and says so", () => {
    renderBar({ list_status_reason: 'Kategorie 2 — 288 stran.' });

    expect(screen.getByLabelText(/důvod rozhodnutí/i)).toHaveValue('Kategorie 2 — 288 stran.');
    expect(screen.getByText(/odešle se studentovi/i)).toHaveTextContent(/předvyplněn návrhem AI/);
  });

  it('drops the AI-prefill claim for a book the AI never wrote about', () => {
    renderBar({ list_status_reason: null });

    expect(screen.getByLabelText(/důvod rozhodnutí/i)).toHaveValue('');
    expect(screen.getByText(/odešle se studentovi/i)).not.toHaveTextContent(/předvyplněn/);
  });

  it('blocks both decisions until a reason is written', async () => {
    renderBar();

    expect(screen.getByRole('button', { name: /schválit do longlistu/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /odmítnout/i })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/důvod rozhodnutí/i), 'Mimo záběr BOBa.');

    expect(screen.getByRole('button', { name: /schválit do longlistu/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /odmítnout/i })).toBeEnabled();
  });

  it('blocks decisions while the facts form is open', () => {
    renderBar({ list_status_reason: 'Hotový důvod.' }, { blocked: true });

    expect(screen.getByRole('button', { name: /schválit do longlistu/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /odmítnout/i })).toBeDisabled();
  });
});

describe('ReviewDecisionBar re-enrichment', () => {
  it('writes the fresh description back and hands the saved book to its parent', async () => {
    const enriched = {
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
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: enriched, citations: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { ...PROCESSING_BOOK, description: enriched.description } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { onEnriched } = renderBar();

    await userEvent.click(screen.getByRole('button', { name: /další akce/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /dohledat údaje/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/books/b1');
    expect(JSON.parse(init.body as string)).toMatchObject({
      action: 'edit',
      description: 'Naučíš se otestovat nápad.',
    });

    await waitFor(() =>
      expect(onEnriched).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Naučíš se otestovat nápad.' }),
      ),
    );
  });

  it('surfaces the API error instead of the generic one', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Zkusil jsi to příliš mnohokrát.' }) });
    vi.stubGlobal('fetch', fetchMock);

    const { onEnriched } = renderBar();

    await userEvent.click(screen.getByRole('button', { name: /další akce/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /dohledat údaje/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(onEnriched).not.toHaveBeenCalled();
  });
});
