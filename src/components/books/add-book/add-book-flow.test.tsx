import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { AddBookFlow } from './add-book-flow';

const CANDIDATE = {
  title: 'Sprint',
  author: 'Jake Knapp',
  isbn_13: null,
  description: null,
  cover_url: null,
  page_count: 288,
  publisher: null,
  published_year: null,
  preview_link: null,
  source: 'google_books',
  external_id: 'vol-1',
};

const ENRICHED = {
  title_cs: 'Sprint',
  title_en: null,
  author: 'Jake Knapp',
  isbn_13: null,
  page_count: 288,
  description: 'Naučíš se…',
  tag: 'Leadership',
  suggested_points: 2,
  points_reason: 'Kategorie 2.',
  confidence: 'high',
  low_confidence_fields: [],
};

function persist(step: string, draft: Record<string, unknown>) {
  sessionStorage.setItem('tappka:add-book-draft', JSON.stringify({ step, draft }));
}

beforeEach(() => {
  push.mockReset();
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AddBookFlow', () => {
  it('starts on the gate and does not search until it is affirmed', async () => {
    render(<AddBookFlow initialQuery="sprint" returnTo={null} discardHref="/cteni/hledat" />);

    expect(screen.getByRole('heading', { name: /co patří do boba/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/najdi knihu/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /pojďme na to/i }));

    expect(await screen.findByLabelText(/najdi knihu/i)).toBeInTheDocument();
  });

  it('tracks progress on the same flow map the gate taught', async () => {
    render(<AddBookFlow initialQuery="" returnTo={null} discardHref="/cteni/hledat" />);

    const map = screen.getByRole('list', { name: /postup přidání knihy/i });
    expect(map).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step');

    await userEvent.click(screen.getByRole('button', { name: /pojďme na to/i }));

    await waitFor(() =>
      expect(
        screen.getByRole('list', { name: /postup přidání knihy/i }).children[1],
      ).toHaveAttribute('aria-current', 'step'),
    );
  });

  it('restores a draft from sessionStorage instead of starting over', async () => {
    persist('review', {
      candidate: { ...CANDIDATE, source: 'google_books' },
      enriched: null,
      citations: [],
      manual: true,
      appealing: false,
    });

    render(<AddBookFlow initialQuery="" returnTo={null} discardHref="/cteni/hledat" />);

    expect(await screen.findByLabelText(/český název/i)).toHaveValue('Sprint');
  });

  it('restores a draft written before appeals existed', async () => {
    // No `appealing` key — an older session must not land on the appeal wording.
    persist('review', {
      candidate: { ...CANDIDATE, source: 'google_books' },
      enriched: ENRICHED,
      citations: [],
      manual: false,
    });

    render(<AddBookFlow initialQuery="" returnTo={null} discardHref="/cteni/hledat" />);

    expect(await screen.findByLabelText(/popis — proč to číst/i)).toHaveValue('Naučíš se…');
  });

  describe('a refused book', () => {
    const REJECTED = {
      ...ENRICHED,
      suggested_points: 0,
      description: 'ZAMÍTNUTO: Kniha nesouvisí se zaměřením programu TAP.',
      points_reason: 'Beletrie — rozhoduje žánr, ne téma.',
    };

    function renderAfterRejection() {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: REJECTED, citations: [] }) }),
      );
      persist('enriching', {
        candidate: { ...CANDIDATE, source: 'google_books' },
        enriched: null,
        citations: [],
        manual: false,
        appealing: false,
      });
      render(<AddBookFlow initialQuery="" returnTo={null} discardHref="/cteni/hledat" />);
    }

    it('dead-ends instead of dropping into the form', async () => {
      renderAfterRejection();

      expect(
        await screen.findByRole('heading', { name: /nemyslí, že tahle kniha/i }),
      ).toBeInTheDocument();
      expect(screen.getByText('Beletrie — rozhoduje žánr, ne téma.')).toBeInTheDocument();
      expect(screen.queryByLabelText(/český název/i)).not.toBeInTheDocument();
    });

    it('discards the draft from the rejected window', async () => {
      renderAfterRejection();

      await screen.findByRole('heading', { name: /nemyslí, že tahle kniha/i });
      await userEvent.click(screen.getByRole('button', { name: /zrušit přidávání/i }));
      await userEvent.click(await screen.findByRole('button', { name: /zahodit/i }));

      expect(sessionStorage.getItem('tappka:add-book-draft')).toBeNull();
      await waitFor(() => expect(push).toHaveBeenCalledWith('/cteni/hledat'));
    });

    it('reaches the coach through the appeal path', async () => {
      renderAfterRejection();

      await userEvent.click(await screen.findByRole('button', { name: /pokračovat přesto/i }));

      expect(
        await screen.findByLabelText(/proč kniha do boba patří/i),
      ).toHaveValue('');
    });
  });

  it('navigates to the existing book when the API reports a duplicate', async () => {
    persist('review', {
      candidate: null,
      enriched: ENRICHED,
      citations: [],
      manual: false,
      appealing: false,
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Tato kniha již existuje v katalogu', existingId: 'dup-1' }),
    }));

    render(<AddBookFlow initialQuery="" returnTo={null} discardHref="/cteni/hledat" />);
    await userEvent.click(await screen.findByRole('button', { name: /odeslat/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/cteni/knihy/dup-1'));
  });

  it('returns to the essay editor with the new book preselected', async () => {
    persist('review', {
      candidate: null,
      enriched: ENRICHED,
      citations: [],
      manual: false,
      appealing: false,
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'new-1' } }),
    }));

    render(<AddBookFlow initialQuery="" returnTo="/cteni/eseje/e1/upravit" discardHref="/cteni/eseje/e1/upravit" />);
    await userEvent.click(await screen.findByRole('button', { name: /odeslat/i }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/cteni/eseje/e1/upravit?book=new-1'),
    );
  });

  describe('discarding the draft', () => {
    const DRAFT = {
      candidate: { ...CANDIDATE, source: 'google_books' },
      enriched: null,
      citations: [],
      manual: true,
      appealing: false,
    };

    function renderWithDraft() {
      persist('review', DRAFT);
      render(<AddBookFlow initialQuery="" returnTo={null} discardHref="/cteni/hledat" />);
    }

    it('clears the draft and navigates back when confirmed', async () => {
      renderWithDraft();

      await userEvent.click(await screen.findByRole('button', { name: /zrušit přidávání/i }));
      await userEvent.click(await screen.findByRole('button', { name: /zahodit/i }));

      expect(sessionStorage.getItem('tappka:add-book-draft')).toBeNull();
      await waitFor(() => expect(push).toHaveBeenCalledWith('/cteni/hledat'));
    });

    it('keeps the draft when the dialog is cancelled', async () => {
      renderWithDraft();

      await userEvent.click(await screen.findByRole('button', { name: /zrušit přidávání/i }));
      await userEvent.click(screen.getByRole('button', { name: 'Zrušit' }));

      expect(push).not.toHaveBeenCalled();
      expect(sessionStorage.getItem('tappka:add-book-draft')).not.toBeNull();
    });

    it('is not offered while there is nothing to discard', async () => {
      render(<AddBookFlow initialQuery="" returnTo={null} discardHref="/cteni/hledat" />);

      expect(
        screen.queryByRole('button', { name: /zrušit přidávání/i }),
      ).not.toBeInTheDocument();
    });
  });
});
