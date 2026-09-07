import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachReviewQueue } from './coach-review-queue';
import type { BookWithProfiles } from '@/lib/books/types';
import type { ContentSourceWithProfiles } from '@/lib/content-sources/types';

const mockBooks: BookWithProfiles[] = [
  {
    id: 'b1',
    title_cs: 'Kniha ke zpracování',
    title_en: null,
    author: 'Autor Test',
    description: 'Popis knihy',
    book_points: 2,
    list_status: 'processing',
    list_status_reason: 'Doporučeno Perplexity',
    page_count: 200,
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
  } as unknown as BookWithProfiles,
];

const mockSources: ContentSourceWithProfiles[] = [
  {
    id: 's1',
    kind: 'podcast',
    title: 'Podcast ke schválení',
    creator: 'Tvůrce Podcastu',
    description: 'Popis podcastu',
    external_url: null,
    points: 1,
    status: 'pending_review',
    status_changed_at: null,
    status_changed_by_profile_id: null,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
    created_by_profile_id: 'p1',
    updated_by_profile_id: 'p1',
    created_by: null,
  },
];

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('CoachReviewQueue', () => {
  it('renders book queue workbench by default', () => {
    render(
      <CoachReviewQueue
        books={mockBooks}
        sources={mockSources}
        onDecideBook={vi.fn().mockResolvedValue(true)}
        onEditedBook={vi.fn()}
        onDeletedBook={vi.fn()}
        onDecideSource={vi.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: 'Kniha ke zpracování' })).toBeInTheDocument();
    expect(screen.getAllByText('Autor Test').length).toBeGreaterThan(0);
  });

  it('switches to content sources review queue', async () => {
    const user = userEvent.setup();
    render(
      <CoachReviewQueue
        books={mockBooks}
        sources={mockSources}
        onDecideBook={vi.fn().mockResolvedValue(true)}
        onEditedBook={vi.fn()}
        onDeletedBook={vi.fn()}
        onDecideSource={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Ostatní zdroje/i }));
    expect(screen.getByText('Podcast ke schválení')).toBeInTheDocument();
    expect(screen.getByText(/Tvůrce Podcastu/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schválit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zamítnout' })).toBeInTheDocument();
  });
});
