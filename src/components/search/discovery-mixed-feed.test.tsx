import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});
