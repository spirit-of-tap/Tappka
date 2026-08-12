import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { AddBookFlow } from './add-book-flow';

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
    render(<AddBookFlow initialQuery="sprint" returnTo={null} />);

    expect(screen.getByRole('heading', { name: /patří ta kniha do boba/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/najdi knihu/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /chci přidat/i }));

    expect(await screen.findByLabelText(/najdi knihu/i)).toBeInTheDocument();
  });

  it('restores a draft from sessionStorage instead of starting over', async () => {
    sessionStorage.setItem(
      'tappka:add-book-draft',
      JSON.stringify({
        step: 'review',
        draft: {
          candidate: {
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
          },
          enriched: null,
          citations: [],
          manual: true,
        },
      }),
    );

    render(<AddBookFlow initialQuery="" returnTo={null} />);

    expect(await screen.findByLabelText(/český název/i)).toHaveValue('Sprint');
  });

  it('navigates to the existing book when the API reports a duplicate', async () => {
    sessionStorage.setItem(
      'tappka:add-book-draft',
      JSON.stringify({
        step: 'review',
        draft: {
          candidate: null,
          enriched: {
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
          },
          citations: [],
          manual: false,
        },
      }),
    );

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Tato kniha již existuje v katalogu', existingId: 'dup-1' }),
    }));

    render(<AddBookFlow initialQuery="" returnTo={null} />);
    await userEvent.click(await screen.findByRole('button', { name: /odeslat/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/cteni/knihy/dup-1'));
  });

  it('returns to the essay editor with the new book preselected', async () => {
    sessionStorage.setItem(
      'tappka:add-book-draft',
      JSON.stringify({
        step: 'review',
        draft: {
          candidate: null,
          enriched: {
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
          },
          citations: [],
          manual: false,
        },
      }),
    );

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'new-1' } }),
    }));

    render(<AddBookFlow initialQuery="" returnTo="/cteni/eseje/e1/upravit" />);
    await userEvent.click(await screen.findByRole('button', { name: /odeslat/i }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/cteni/eseje/e1/upravit?book=new-1'),
    );
  });
});
