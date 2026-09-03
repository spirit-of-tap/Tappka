import { describe, expect, it } from 'vitest';

import { searchCatalogBooks, type CatalogSearchBook } from './catalog-search';

const BOOKS: CatalogSearchBook[] = [
  {
    id: 'profit-first',
    title_cs: 'Nejdřív zisk',
    title_en: 'Profit First',
    author: 'Mike Michalowicz',
    isbn_13: '9780241341032',
    google_books_cover_url: null,
  },
  {
    id: 'business-school',
    title_cs: 'Škola businessu',
    title_en: 'The Business School',
    author: 'Robert T. Kiyosaki, Sharon L. Lechter',
    isbn_13: '9788073491000',
    google_books_cover_url: null,
  },
];

describe('searchCatalogBooks', () => {
  it('matches Czech titles without requiring diacritics', () => {
    expect(searchCatalogBooks(BOOKS, 'nejdriv zisk', 10).map((book) => book.id))
      .toEqual(['profit-first']);
  });

  it('matches authors, including names stored with comma-separated co-authors', () => {
    expect(searchCatalogBooks(BOOKS, 'Sharon Lechter', 10).map((book) => book.id))
      .toEqual(['business-school']);
    expect(searchCatalogBooks(BOOKS, 'Michalowicz', 10).map((book) => book.id))
      .toEqual(['profit-first']);
  });

  it('matches English titles and ISBN', () => {
    expect(searchCatalogBooks(BOOKS, 'Profit First', 10).map((book) => book.id))
      .toEqual(['profit-first']);
    expect(searchCatalogBooks(BOOKS, '9788073491000', 10).map((book) => book.id))
      .toEqual(['business-school']);
  });

  it('ranks a title match ahead of an author match', () => {
    const titleMatch = { ...BOOKS[0], id: 'title-match', title_cs: 'Mike' };
    expect(searchCatalogBooks([BOOKS[0], titleMatch], 'Mike', 10).map((book) => book.id))
      .toEqual(['title-match', 'profit-first']);
  });
});
