import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachCatalogView } from './coach-catalog-view';
import type { BookWithProfiles, HighlightCategory } from '@/lib/books/types';
import type { ContentSourceWithProfiles } from '@/lib/content-sources/types';

const mockBooks: BookWithProfiles[] = [
  {
    id: 'b1',
    title_cs: 'Kniha Alpha',
    title_en: null,
    author: 'Autor Alpha',
    description: 'Popis knihy Alpha',
    book_points: 2,
    list_status: 'longlist',
    list_status_reason: null,
    page_count: 250,
    source: 'manual',
    external_id: null,
    google_books_cover_url: null,
    is_rocket_model: false,
    isbn_13: '9781234567890',
    created_at: '2026-08-01T10:00:00Z',
    created_by: null,
    list_status_changed_by: null,
    essay_count: 3,
    tags: [],
    highlight_category: null,
  } as unknown as BookWithProfiles,
  {
    id: 'b2',
    title_cs: 'Kniha Beta',
    title_en: null,
    author: 'Autor Beta',
    description: 'Popis knihy Beta',
    book_points: 3,
    list_status: 'shortlist',
    list_status_reason: null,
    page_count: 350,
    source: 'manual',
    external_id: null,
    google_books_cover_url: null,
    is_rocket_model: true,
    isbn_13: '9789876543210',
    created_at: '2026-08-02T10:00:00Z',
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
    title: 'Podcast Gamma',
    creator: 'Tvůrce Gamma',
    description: 'Popis podcastu Gamma',
    external_url: 'https://example.com/gamma',
    points: 1,
    status: 'approved',
    status_changed_at: null,
    status_changed_by_profile_id: null,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
    created_by_profile_id: 'p1',
    updated_by_profile_id: 'p1',
    created_by: null,
  },
];

const mockCategories: HighlightCategory[] = [
  {
    id: 'cat-1',
    name: 'Leadership',
    description: 'Knihy o vedení lidí',
    created_at: '2026-08-01T10:00:00Z',
  } as unknown as HighlightCategory,
];

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('CoachCatalogView', () => {
  it('renders catalog with books and status counts', () => {
    render(
      <CoachCatalogView
        books={mockBooks}
        sources={mockSources}
        categories={mockCategories}
        onMoveBook={vi.fn().mockResolvedValue(true)}
        onRestoreBook={vi.fn().mockResolvedValue(true)}
        onToggleRocketModel={vi.fn().mockResolvedValue(true)}
        onPointsSaved={vi.fn()}
        onBookEdited={vi.fn()}
        onBookDeleted={vi.fn()}
        onUpdateSourceStatus={vi.fn().mockResolvedValue(true)}
        onUpdateSourcePoints={vi.fn()}
      />,
    );

    expect(screen.getByText('Kniha Alpha')).toBeInTheDocument();
    expect(screen.getByText('Kniha Beta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Shortlist/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Longlist/ })).toBeInTheDocument();
  });

  it('filters books by status segment', async () => {
    const user = userEvent.setup();
    render(
      <CoachCatalogView
        books={mockBooks}
        sources={mockSources}
        categories={mockCategories}
        onMoveBook={vi.fn().mockResolvedValue(true)}
        onRestoreBook={vi.fn().mockResolvedValue(true)}
        onToggleRocketModel={vi.fn().mockResolvedValue(true)}
        onPointsSaved={vi.fn()}
        onBookEdited={vi.fn()}
        onBookDeleted={vi.fn()}
        onUpdateSourceStatus={vi.fn().mockResolvedValue(true)}
        onUpdateSourcePoints={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Shortlist/ }));
    expect(screen.queryByText('Kniha Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Kniha Beta')).toBeInTheDocument();
  });

  it('switches to other sources tab and displays sources', async () => {
    const user = userEvent.setup();
    render(
      <CoachCatalogView
        books={mockBooks}
        sources={mockSources}
        categories={mockCategories}
        onMoveBook={vi.fn().mockResolvedValue(true)}
        onRestoreBook={vi.fn().mockResolvedValue(true)}
        onToggleRocketModel={vi.fn().mockResolvedValue(true)}
        onPointsSaved={vi.fn()}
        onBookEdited={vi.fn()}
        onBookDeleted={vi.fn()}
        onUpdateSourceStatus={vi.fn().mockResolvedValue(true)}
        onUpdateSourcePoints={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Ostatní zdroje/ }));
    expect(screen.getByText('Podcast Gamma')).toBeInTheDocument();
    expect(screen.getByText('Tvůrce Gamma')).toBeInTheDocument();
  });

  it('calls onMoveBook when clicking move button', async () => {    const user = userEvent.setup();
    const onMoveBook = vi.fn().mockResolvedValue(true);
    render(
      <CoachCatalogView
        books={mockBooks}
        sources={mockSources}
        categories={mockCategories}
        onMoveBook={onMoveBook}
        onRestoreBook={vi.fn().mockResolvedValue(true)}
        onToggleRocketModel={vi.fn().mockResolvedValue(true)}
        onPointsSaved={vi.fn()}
        onBookEdited={vi.fn()}
        onBookDeleted={vi.fn()}
        onUpdateSourceStatus={vi.fn().mockResolvedValue(true)}
        onUpdateSourcePoints={vi.fn()}
      />,
    );

    // Kniha Alpha is in longlist, so its move button is "Do shortlistu"
    await user.click(screen.getByRole('button', { name: /Do shortlistu/i }));
    expect(onMoveBook).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1' }),
      'shortlist',
    );
  });

  it('renders only the first page of a large catalog with a counter', () => {
    const manyBooks = Array.from({ length: 60 }, (_, i) => ({
      id: `bx-${i}`,
      title_cs: `Kniha ${i}`,
      title_en: null,
      author: 'Autor',
      book_points: 2,
      list_status: 'longlist',
      is_rocket_model: false,
      essay_count: 0,
      highlight_category: null,
    })) as unknown as BookWithProfiles[];
    render(
      <CoachCatalogView
        books={manyBooks}
        sources={[]}
        categories={mockCategories}
        onMoveBook={vi.fn().mockResolvedValue(true)}
        onRestoreBook={vi.fn().mockResolvedValue(true)}
        onToggleRocketModel={vi.fn().mockResolvedValue(true)}
        onPointsSaved={vi.fn()}
        onBookEdited={vi.fn()}
        onBookDeleted={vi.fn()}
        onUpdateSourceStatus={vi.fn().mockResolvedValue(true)}
        onUpdateSourcePoints={vi.fn()}
      />,
    );

    expect(screen.getByText('Kniha 0')).toBeInTheDocument();
    expect(screen.queryByText('Kniha 59')).not.toBeInTheDocument();
    expect(screen.getByText('Zobrazeno 50 z 60')).toBeInTheDocument();
  });
});
