import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyEssayList } from '@/components/essays/my-essay-list';
import type { EssayWithDetails } from '@/lib/essays/types';

function essay(overrides: Partial<EssayWithDetails> = {}): EssayWithDetails {
  return {
    id: 'essay-1',
    author_profile_id: 'profile-1',
    book_id: null,
    content_source_id: null,
    title: 'Zveřejněná esej',
    content_json: {},
    content_text: 'Text',
    published_at: '2026-08-01T10:00:00Z',
    view_count: 0,
    vote_count: 0,
    comment_count: 0,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
    pinned_at: null,
    pinned_by_profile_id: null,
    removed_at: null,
    author: null,
    book: null,
    content_source: null,
    ...overrides,
  };
}

describe('MyEssayList koncepty', () => {
  it('renders no koncepty heading when there are none', () => {
    render(<MyEssayList essays={[essay()]} />);
    expect(screen.queryByText(/Koncepty/)).not.toBeInTheDocument();
  });

  it('groups koncepty above published essays with a count', () => {
    const draft = essay({ id: 'essay-2', title: 'Rozepsané', published_at: null });
    render(<MyEssayList essays={[essay()]} drafts={[draft]} />);
    expect(screen.getByText('Koncepty (1)')).toBeInTheDocument();
  });

  it('falls back to Bez názvu for an untitled koncept', () => {
    const draft = essay({ id: 'essay-2', title: '', published_at: null });
    render(<MyEssayList essays={[]} drafts={[draft]} />);
    expect(screen.getByText('Bez názvu')).toBeInTheDocument();
  });

  it('links a koncept straight to the editor', () => {
    const draft = essay({ id: 'essay-2', title: 'Rozepsané', published_at: null });
    render(<MyEssayList essays={[]} drafts={[draft]} />);
    expect(screen.getByRole('link', { name: /Rozepsané/ })).toHaveAttribute(
      'href',
      '/cteni/eseje/essay-2/upravit',
    );
  });

  it('renders linked book title and omits verbose snippet/word count', () => {
    const draft = essay({
      id: 'essay-2',
      title: 'Návrh design sprintu',
      content_text: 'Dlouhý text konceptu...',
      published_at: null,
      book: {
        id: 'book-1',
        title_cs: 'Design Sprint',
        author: 'Jake Knapp',
        book_points: 3,
        list_status: 'shortlist',
        is_rocket_model: false,
        google_books_cover_url: null,
        highlight_category: null,
      },
    });
    render(<MyEssayList essays={[]} drafts={[draft]} />);
    expect(screen.getByText('Návrh design sprintu')).toBeInTheDocument();
    expect(screen.getByText(/Design Sprint/)).toBeInTheDocument();
    expect(screen.queryByText('Dlouhý text konceptu...')).not.toBeInTheDocument();
    expect(screen.queryByText(/slov/)).not.toBeInTheDocument();
  });
});

describe('MyEssayList source buckets', () => {
  it('shows a content source essay with its title and points, not as "Nad rámec četby"', () => {
    const sourced = essay({
      id: 'essay-3',
      title: 'Co jsem si odnesl z Founders',
      content_source_id: 'src-1',
      content_source: {
        id: 'src-1',
        kind: 'podcast',
        title: 'Founders',
        creator: 'David Senra',
        points: 0.5,
        status: 'approved',
      },
    });

    render(<MyEssayList essays={[sourced]} />);

    expect(screen.getByText('Founders')).toBeInTheDocument();
    expect(screen.getByText('0,50 b.')).toBeInTheDocument();
    expect(screen.queryByText('Nad rámec četby')).not.toBeInTheDocument();
  });

  it('still shows "Nad rámec četby" for an essay with no source at all', () => {
    render(<MyEssayList essays={[essay()]} />);
    expect(screen.getByText('Nad rámec četby')).toBeInTheDocument();
  });
});