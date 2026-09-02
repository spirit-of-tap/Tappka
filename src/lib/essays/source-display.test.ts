import { describe, expect, it } from 'vitest';
import { getEssaySourceDisplay } from './source-display';

describe('getEssaySourceDisplay', () => {
  it('reads title/author/points from a book', () => {
    const display = getEssaySourceDisplay({
      book: {
        id: 'b1', title_cs: 'Sprint', author: 'Jake Knapp', book_points: 2,
        list_status: 'shortlist', is_rocket_model: false, google_books_cover_url: null,
        highlight_category: null,
      },
      content_source: null,
      frozen_book_points: null,
    });
    expect(display).toEqual({
      kind: 'book', title: 'Sprint', author: 'Jake Knapp', points: 2,
      isArchived: false, isFrozen: false, illustrationKind: null,
    });
  });

  it('reads title/creator/points from a content source', () => {
    const display = getEssaySourceDisplay({
      book: null,
      content_source: { id: 's1', kind: 'podcast', title: 'Founders', creator: 'David Senra', points: 0.5, status: 'approved' },
      frozen_book_points: null,
    });
    expect(display).toEqual({
      kind: 'content_source', title: 'Founders', author: 'David Senra', points: 0.5,
      isArchived: false, isFrozen: false, illustrationKind: 'podcast',
    });
  });

  it('flags an archived content source', () => {
    const display = getEssaySourceDisplay({
      book: null,
      content_source: { id: 's1', kind: 'conference', title: 'X', creator: null, points: 1, status: 'archived' },
      frozen_book_points: null,
    });
    expect(display.isArchived).toBe(true);
  });

  it('falls back to "none" when neither is set', () => {
    const display = getEssaySourceDisplay({ book: null, content_source: null, frozen_book_points: null });
    expect(display).toEqual({
      kind: 'none', title: null, author: null, points: 0,
      isArchived: false, isFrozen: false, illustrationKind: null,
    });
  });

  it('prefers frozen_book_points over the live book_points and flags isFrozen', () => {
    const display = getEssaySourceDisplay({
      book: {
        id: 'b1', title_cs: 'Sprint', author: 'Jake Knapp', book_points: 3,
        list_status: 'shortlist', is_rocket_model: false, google_books_cover_url: null,
        highlight_category: null,
      },
      content_source: null,
      frozen_book_points: '1.00',
    });
    expect(display.points).toBe(1);
    expect(display.isFrozen).toBe(true);
  });

  it('keeps a frozen value even when the book is later archived — earned credit is immune to archival', () => {
    const display = getEssaySourceDisplay({
      book: {
        id: 'b1', title_cs: 'Sprint', author: 'Jake Knapp', book_points: 0,
        list_status: 'archived', is_rocket_model: false, google_books_cover_url: null,
        highlight_category: null,
      },
      content_source: null,
      frozen_book_points: '2.00',
    });
    expect(display.points).toBe(2);
    expect(display.isArchived).toBe(false);
    expect(display.isFrozen).toBe(true);
  });

  it('still counts a frozen value when the essay has no book or content source at all', () => {
    const display = getEssaySourceDisplay({
      book: null,
      content_source: null,
      frozen_book_points: '2.00',
    });
    expect(display.kind).toBe('legacy');
    expect(display.points).toBe(2);
    expect(display.isFrozen).toBe(true);
    expect(display.isArchived).toBe(false);
  });

  it('forces points to 0 for an archived book when there is no frozen value (live points only)', () => {
    const display = getEssaySourceDisplay({
      book: {
        id: 'b1', title_cs: 'Sprint', author: 'Jake Knapp', book_points: 3,
        list_status: 'archived', is_rocket_model: false, google_books_cover_url: null,
        highlight_category: null,
      },
      content_source: null,
      frozen_book_points: null,
    });
    expect(display.points).toBe(0);
    expect(display.isArchived).toBe(true);
    expect(display.isFrozen).toBe(false);
  });
});
