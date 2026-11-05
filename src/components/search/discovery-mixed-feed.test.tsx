import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryMixedFeed, type EssayWithVoted } from './discovery-mixed-feed';
import type { BookWithProfiles } from '@/lib/books/types';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

const mockBook1: BookWithProfiles = {
  id: 'b-1',
  title_cs: 'Kniha 1',
  title_en: null,
  author: 'Autor 1',
  isbn_13: null,
  description: 'Popis knihy 1',
  google_books_cover_url: null,
  book_points: 2,
  page_count: 200,
  preview_link: null,
  source: 'manual',
  external_id: null,
  list_status: 'shortlist',
  list_status_changed_at: null,
  list_status_changed_by_profile_id: null,
  list_status_reason: null,
  highlight_category_id: null,
  is_rocket_model: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by_profile_id: 'p1',
  updated_by_profile_id: 'p1',
  created_by: null,
  list_status_changed_by: null,
  essay_count: 3,
  tags: ['Leadership'],
  highlight_category: null,
};

const mockBook2: BookWithProfiles = {
  ...mockBook1,
  id: 'b-2',
  title_cs: 'Kniha 2',
  author: 'Autor 2',
};

const mockBook3: BookWithProfiles = {
  ...mockBook1,
  id: 'b-3',
  title_cs: 'Kniha 3',
  author: 'Autor 3',
};

const mockEssay1: EssayWithVoted = {
  id: 'essay-1',
  author_profile_id: 'p1',
  book_id: 'b-1',
  frozen_book_points: null,
  content_source_id: null,
  title: 'Skvělá reflexe o leadershipu',
  content_json: {},
  content_text: 'Tato kniha změnila náš přístup k týmovému rozhodování.',
  published_at: '2026-08-20T10:00:00Z',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  pinned_at: null,
  pinned_by_profile_id: null,
  removed_at: null,
  view_count: 10,
  vote_count: 5,
  comment_count: 2,
  author: { id: 'p1', name: 'Petr Novák', picture: null, role: 'student', team_id: 't1' },
  book: {
    id: 'b-99',
    title_cs: 'Kniha k reflexi',
    author: 'Autor reflexe',
    book_points: 2,
    list_status: 'shortlist',
    is_rocket_model: false,
    google_books_cover_url: null,
    highlight_category: null,
  },
  content_source: null,
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('DiscoveryMixedFeed', () => {
  it('renders "Scrollky" title, books, and interleaved essays', () => {
    render(
      <DiscoveryMixedFeed
        books={[mockBook1, mockBook2, mockBook3]}
        recentEssays={[mockEssay1]}
        popularEssays={[]}
      />,
    );

    expect(screen.getByText('Scrollky')).toBeInTheDocument();
    expect(screen.getByText('Kniha 1')).toBeInTheDocument();
    expect(screen.getByText('Kniha 2')).toBeInTheDocument();
    expect(screen.getByText('Kniha 3')).toBeInTheDocument();
    expect(screen.getByText('Skvělá reflexe o leadershipu')).toBeInTheDocument();
  });

  it('filters out books that are not shortlist or have < 2 essays', () => {
    const unverifiedBook: BookWithProfiles = {
      ...mockBook1,
      id: 'b-unverified',
      title_cs: 'Neověřená kniha',
      essay_count: 0,
    };
    const nonShortlistBook: BookWithProfiles = {
      ...mockBook1,
      id: 'b-longlist',
      title_cs: 'Kniha na longlistu',
      list_status: 'longlist',
      essay_count: 5,
    };

    render(
      <DiscoveryMixedFeed
        books={[mockBook1, unverifiedBook, nonShortlistBook]}
        recentEssays={[mockEssay1]}
        popularEssays={[]}
      />,
    );

    expect(screen.getByText('Kniha 1')).toBeInTheDocument();
    expect(screen.queryByText('Neověřená kniha')).not.toBeInTheDocument();
    expect(screen.queryByText('Kniha na wishlistu')).not.toBeInTheDocument();
  });

  it('shows essays passed via essaysByBookId instead of the "Zatím bez eseje" fallback', () => {
    render(
      <DiscoveryMixedFeed
        books={[mockBook1]}
        recentEssays={[]}
        popularEssays={[]}
        essaysByBookId={{
          'b-1': [
            {
              id: 'essay-x',
              title: 'Esej z detailu knihy',
              author: { id: 'p1', name: 'Petr Novák', picture: null, team_id: 't1' },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText(/Esej z detailu knihy/)).toBeInTheDocument();
    expect(screen.queryByText(/Zatím bez eseje/)).not.toBeInTheDocument();
  });

  it('hides the viewer’s own essays from the feed', () => {
    render(
      <DiscoveryMixedFeed
        books={[mockBook1]}
        recentEssays={[mockEssay1]}
        popularEssays={[]}
        currentProfileId="p1"
      />,
    );

    expect(screen.queryByText('Skvělá reflexe o leadershipu')).not.toBeInTheDocument();
  });

  it('labels unseen teammate essays and marks viewed ones', () => {
    const viewed: EssayWithVoted = { ...mockEssay1, id: 'essay-viewed', title: 'Už otevřená', user_has_viewed: true, author: { ...mockEssay1.author!, team_id: 't-other' } };
    render(
      <DiscoveryMixedFeed
        books={[mockBook1]}
        recentEssays={[mockEssay1, viewed]}
        popularEssays={[]}
        userTeamId="t1"
        currentProfileId="someone-else"
      />,
    );

    expect(screen.getByText('Z tvého týmu')).toBeInTheDocument();
    expect(screen.getByText('Přečteno')).toBeInTheDocument();
  });

  describe('infinite scroll', () => {
    let triggerIntersection: () => void = () => {};

    beforeEach(() => {
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(cb: IntersectionObserverCallback) {
            triggerIntersection = () => cb([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
          }
          observe() {}
          disconnect() {}
        },
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const initialBooks = Array.from({ length: 8 }, (_, i) => ({
      ...mockBook1,
      id: `b-init-${i}`,
      title_cs: `Úvodní kniha ${i}`,
    }));

    it('appends the next batch without reordering cards already shown', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          books: [{ ...mockBook1, id: 'b-next', title_cs: 'Další kniha' }, initialBooks[0]],
          essays: [],
          essaysByBookId: {},
          hasMore: false,
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      render(<DiscoveryMixedFeed books={initialBooks} recentEssays={[]} popularEssays={[]} />);
      const before = screen.getAllByText(/Úvodní kniha \d/).map((el) => el.textContent);

      await act(async () => triggerIntersection());

      await waitFor(() => expect(screen.getByText('Další kniha')).toBeInTheDocument());
      expect(fetchMock).toHaveBeenCalledWith('/api/scrollky?batch=1');
      expect(screen.getAllByText(/Úvodní kniha \d/).map((el) => el.textContent)).toEqual(before);
      const titles = screen.getAllByText(/(Úvodní|Další) kniha/).map((el) => el.textContent);
      expect(titles.at(-1)).toBe('Další kniha');
      expect(screen.getByText(/Pro dnešek je to všechno/)).toBeInTheDocument();
    });

    it('offers a retry when a batch fails to load', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ books: [], essays: [], hasMore: false }) });
      vi.stubGlobal('fetch', fetchMock);
      vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<DiscoveryMixedFeed books={initialBooks} recentEssays={[]} popularEssays={[]} />);
      await act(async () => triggerIntersection());

      const retry = await screen.findByRole('button', { name: /Zkusit znovu/ });
      await act(async () => fireEvent.click(retry));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(screen.queryByRole('button', { name: /Zkusit znovu/ })).not.toBeInTheDocument();
    });
  });

  describe('daily seed rotation', () => {
    const dayBooks: BookWithProfiles[] = Array.from({ length: 10 }, (_, index) => ({
      ...mockBook1,
      id: `b-day-${index}`,
      title_cs: `Denní kniha ${index}`,
      author: `Autor ${index}`,
    }));

    function renderBookOrder(): string[] {
      render(<DiscoveryMixedFeed books={dayBooks} recentEssays={[]} popularEssays={[]} />);
      const order = screen.getAllByText(/Denní kniha \d+/).map((el) => el.textContent ?? '');
      cleanup();
      return order;
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('keeps the same book order for renders within the same day', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 18, 9));
      const morningOrder = renderBookOrder();

      vi.setSystemTime(new Date(2026, 8, 18, 21));
      const eveningOrder = renderBookOrder();

      expect(eveningOrder).toEqual(morningOrder);
    });

    it('rotates the book order on the next day', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 18, 12));
      const todayOrder = renderBookOrder();

      vi.setSystemTime(new Date(2026, 8, 19, 12));
      const tomorrowOrder = renderBookOrder();

      expect(tomorrowOrder).not.toEqual(todayOrder);
    });
  });
});
