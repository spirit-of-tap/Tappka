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

/** A book carrying a complete AI suggestion — score plus rationale. */
const SUGGESTED = { book_points: 2, list_status_reason: 'Kategorie 2 — 288 stran.' };

function renderBar(book: Partial<BookWithProfiles> = {}, props: Record<string, unknown> = {}) {
  const onDecide = vi.fn().mockResolvedValue(true);
  const onEnriched = vi.fn();
  const onDeleted = vi.fn();

  render(
    <ReviewDecisionBar
      book={{ ...PROCESSING_BOOK, ...book }}
      onDecide={onDecide}
      onEnriched={onEnriched}
      onDeleted={onDeleted}
      {...props}
    />,
  );

  return { onDecide, onEnriched, onDeleted };
}

const cta = () => screen.getByRole('button', { name: /schválit do longlistu|zamítnout knihu/i });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ReviewDecisionBar confirm mode', () => {
  it("opens on the AI's suggestion, read-only, with no duplicate input", () => {
    renderBar(SUGGESTED);

    expect(screen.getByText('Návrh AI')).toBeInTheDocument();
    expect(screen.getByText('Kategorie 2 — 288 stran.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/důvod rozhodnutí/i)).not.toBeInTheDocument();
  });

  it("confirms the AI's score and rationale in one click", async () => {
    const { onDecide } = renderBar(SUGGESTED);

    await userEvent.click(cta());

    expect(onDecide).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1' }),
      2,
      'Kategorie 2 — 288 stran.',
    );
  });

  it('goes straight to editing when there is nothing to confirm', () => {
    renderBar({ book_points: null, list_status_reason: null });

    expect(screen.getByLabelText(/důvod rozhodnutí/i)).toBeInTheDocument();
    expect(screen.queryByText('Návrh AI')).not.toBeInTheDocument();
  });

  it('refuses to call a score with no rationale a confirmable suggestion', () => {
    renderBar({ book_points: 2, list_status_reason: null });

    expect(screen.getByLabelText(/důvod rozhodnutí/i)).toBeInTheDocument();
  });
});

describe('ReviewDecisionBar zero points', () => {
  it("keeps the AI's 0 as a rejection rather than rounding it up to 1", () => {
    renderBar({ book_points: 0, list_status_reason: 'ZAMÍTNUTO: mimo záběr BOBa.' });

    expect(screen.getByRole('button', { name: /zamítnout knihu/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /schválit do longlistu/i })).not.toBeInTheDocument();
  });

  it('submits 0 so the dashboard archives the book', async () => {
    const { onDecide } = renderBar({
      book_points: 0,
      list_status_reason: 'ZAMÍTNUTO: mimo záběr BOBa.',
    });

    await userEvent.click(screen.getByRole('button', { name: /zamítnout knihu/i }));

    expect(onDecide).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1' }),
      0,
      'ZAMÍTNUTO: mimo záběr BOBa.',
    );
  });

  it('flips the call to action as soon as the coach picks 0', async () => {
    renderBar(SUGGESTED);

    await userEvent.click(screen.getByRole('button', { name: /upravit rozhodnutí/i }));
    expect(screen.getByRole('button', { name: /schválit do longlistu/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /0 — zamítnout/i }));

    expect(screen.getByRole('button', { name: /zamítnout knihu/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /schválit do longlistu/i })).not.toBeInTheDocument();
  });
});

describe('ReviewDecisionBar edit mode', () => {
  it("carries the AI's text into the editor so it can be adjusted, not retyped", async () => {
    renderBar(SUGGESTED);

    await userEvent.click(screen.getByRole('button', { name: /upravit rozhodnutí/i }));

    expect(screen.getByLabelText(/důvod rozhodnutí/i)).toHaveValue('Kategorie 2 — 288 stran.');
    expect(screen.getByRole('radio', { name: '2 body' })).toHaveAttribute('data-state', 'on');
  });

  it('submits the coach\'s override', async () => {
    const { onDecide } = renderBar(SUGGESTED);

    await userEvent.click(screen.getByRole('button', { name: /upravit rozhodnutí/i }));
    await userEvent.click(screen.getByRole('radio', { name: '3 body' }));
    await userEvent.clear(screen.getByLabelText(/důvod rozhodnutí/i));
    await userEvent.type(screen.getByLabelText(/důvod rozhodnutí/i), 'Zásadní kniha.');
    await userEvent.click(cta());

    expect(onDecide).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1' }), 3, 'Zásadní kniha.');
  });

  it('can be abandoned back to the untouched suggestion', async () => {
    renderBar(SUGGESTED);

    await userEvent.click(screen.getByRole('button', { name: /upravit rozhodnutí/i }));
    await userEvent.click(screen.getByRole('radio', { name: '3 body' }));
    await userEvent.click(screen.getByRole('button', { name: /zpět k návrhu AI/i }));

    expect(screen.getByText('Kategorie 2 — 288 stran.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/důvod rozhodnutí/i)).not.toBeInTheDocument();
  });

  it('blocks the decision until a reason is written', async () => {
    renderBar();

    expect(cta()).toBeDisabled();

    await userEvent.click(screen.getByRole('radio', { name: '1 bod' }));
    expect(cta()).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/důvod rozhodnutí/i), 'Sedí do longlistu.');
    expect(cta()).toBeEnabled();
  });

  it('blocks the decision while the facts form is open', () => {
    renderBar(SUGGESTED, { blocked: true });

    expect(cta()).toBeDisabled();
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
