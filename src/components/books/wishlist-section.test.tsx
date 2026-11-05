import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WishlistSection } from './wishlist-section';
import { WishlistProvider } from './wishlist-provider';
import type { BookWithProfiles } from '@/lib/books/types';

function book(overrides: Partial<BookWithProfiles> = {}): BookWithProfiles {
  return {
    id: 'b1',
    title_cs: 'Sprint',
    title_en: null,
    author: 'Jake Knapp',
    isbn_13: null,
    description: null,
    google_books_cover_url: null,
    book_points: 2,
    page_count: 288,
    preview_link: null,
    source: 'manual',
    external_id: null,
    list_status: 'shortlist',
    list_status_changed_at: null,
    list_status_changed_by_profile_id: null,
    list_status_reason: null,
    highlight_category_id: null,
    is_rocket_model: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by_profile_id: 'p1',
    updated_by_profile_id: 'p1',
    created_by: null,
    list_status_changed_by: null,
    essay_count: 0,
    tags: [],
    highlight_category: null,
    ...overrides,
  };
}

describe('WishlistSection', () => {
  it('renders nothing when the shelf is empty', () => {
    const { container } = render(
      <WishlistProvider initialSavedIds={[]}>
        <WishlistSection books={[]} />
      </WishlistProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows saved books as linked covers with a count', () => {
    render(
      <WishlistProvider initialSavedIds={['b1']}>
        <WishlistSection books={[book()]} />
      </WishlistProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Chci si přečíst 1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sprint' })).toHaveAttribute('href', '/cteni/knihy/b1');
  });

  it('hides books that are no longer saved in the shared store', () => {
    render(
      <WishlistProvider initialSavedIds={['b1']}>
        <WishlistSection books={[book(), book({ id: 'b2', title_cs: 'Removed elsewhere' })]} />
      </WishlistProvider>,
    );

    expect(screen.getByText('Sprint')).toBeInTheDocument();
    expect(screen.queryByText('Removed elsewhere')).not.toBeInTheDocument();
  });
});
