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
    });
    expect(display).toEqual({
      kind: 'book', title: 'Sprint', author: 'Jake Knapp', points: 2,
      isArchived: false, illustrationKind: null,
    });
  });

  it('reads title/creator/points from a content source', () => {
    const display = getEssaySourceDisplay({
      book: null,
      content_source: { id: 's1', kind: 'podcast', title: 'Founders', creator: 'David Senra', points: 0.5, status: 'approved' },
    });
    expect(display).toEqual({
      kind: 'content_source', title: 'Founders', author: 'David Senra', points: 0.5,
      isArchived: false, illustrationKind: 'podcast',
    });
  });

  it('flags an archived content source', () => {
    const display = getEssaySourceDisplay({
      book: null,
      content_source: { id: 's1', kind: 'conference', title: 'X', creator: null, points: 1, status: 'archived' },
    });
    expect(display.isArchived).toBe(true);
  });

  it('falls back to "none" when neither is set', () => {
    const display = getEssaySourceDisplay({ book: null, content_source: null });
    expect(display).toEqual({
      kind: 'none', title: null, author: null, points: 0,
      isArchived: false, illustrationKind: null,
    });
  });
});
