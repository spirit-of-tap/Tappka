import { describe, expect, it } from 'vitest';

import type { BookWithProfiles } from '@/lib/books/types';
import {
  SCROLLKY_BATCH_SIZE,
  SCROLLKY_INITIAL_BOOK_COUNT,
  SCROLLKY_INITIAL_ESSAY_COUNT,
  buildScrollkySegment,
  collectShownIds,
  createPrng,
  getScrollkyBatchPage,
  rankScrollkyEssays,
  type ScrollkyEssay,
} from './scrollky';

const NOW = new Date('2026-11-05T12:00:00Z').getTime();
const OLD = '2026-06-01T10:00:00Z';

function book(id: string, overrides: Partial<BookWithProfiles> = {}): BookWithProfiles {
  return {
    id,
    title_cs: `Kniha ${id}`,
    list_status: 'shortlist',
    essay_count: 3,
    tags: [],
    ...overrides,
  } as BookWithProfiles;
}

function essay(id: string, overrides: Partial<ScrollkyEssay> = {}): ScrollkyEssay {
  return {
    id,
    author_profile_id: `author-${id}`,
    book_id: null,
    title: `Esej ${id}`,
    vote_count: 0,
    comment_count: 0,
    created_at: OLD,
    published_at: OLD,
    author: { id: `author-${id}`, name: 'Autor', picture: null, role: 'student', team_id: 'other-team' },
    ...overrides,
  } as ScrollkyEssay;
}

describe('getScrollkyBatchPage', () => {
  it('keeps initial loads aligned to the batch size', () => {
    expect(SCROLLKY_INITIAL_BOOK_COUNT % SCROLLKY_BATCH_SIZE).toBe(0);
    expect(SCROLLKY_INITIAL_ESSAY_COUNT % SCROLLKY_BATCH_SIZE).toBe(0);
  });

  it('starts the first batch right after the server-loaded rows', () => {
    const page = getScrollkyBatchPage(SCROLLKY_INITIAL_BOOK_COUNT, 1);
    expect((page - 1) * SCROLLKY_BATCH_SIZE).toBe(SCROLLKY_INITIAL_BOOK_COUNT);
  });
});

describe('rankScrollkyEssays', () => {
  it('puts seen and liked essays after every unseen one', () => {
    const essays = [
      essay('viewed', { user_has_viewed: true, vote_count: 50 }),
      essay('voted', { user_has_voted: true }),
      essay('new-1'),
      essay('new-2'),
    ];
    const ranked = rankScrollkyEssays(essays, { prng: createPrng(1), now: NOW }).map((r) => r.essay.id);
    expect(ranked.slice(0, 2).sort()).toEqual(['new-1', 'new-2']);
    expect(ranked.slice(2).sort()).toEqual(['viewed', 'voted']);
  });

  it('drops the viewer’s own essays', () => {
    const ranked = rankScrollkyEssays([essay('mine', { author_profile_id: 'me' }), essay('theirs')], {
      viewer: { profileId: 'me' },
      prng: createPrng(1),
      now: NOW,
    });
    expect(ranked.map((r) => r.essay.id)).toEqual(['theirs']);
  });

  it('labels unseen teammate and popular essays, never seen ones', () => {
    const teammate = essay('team', { author: { id: 'x', name: 'X', picture: null, role: 'student', team_id: 't1' } });
    const popular = essay('pop', { vote_count: 4 });
    const seenPopular = essay('seen-pop', { vote_count: 9, user_has_viewed: true });
    const ranked = rankScrollkyEssays([teammate, popular, seenPopular], {
      viewer: { teamId: 't1' },
      popularEssayIds: ['pop', 'seen-pop'],
      prng: createPrng(1),
      now: NOW,
    });
    const reasons = Object.fromEntries(ranked.map((r) => [r.essay.id, r.reason]));
    expect(reasons).toEqual({ team: 'team', pop: 'popular', 'seen-pop': undefined });
  });
});

describe('buildScrollkySegment', () => {
  const books = Array.from({ length: 6 }, (_, i) => book(`b${i}`));
  const essays = Array.from({ length: 12 }, (_, i) => essay(`e${i}`));

  it('places every verified book and every essay exactly once', () => {
    const items = buildScrollkySegment({ books, essays, essayPool: essays, seed: 1, segmentIndex: 0, now: NOW });
    const { bookIds, essayIds } = collectShownIds(items);
    expect(bookIds.size).toBe(books.length);
    expect(essayIds.size).toBe(essays.length);
    expect(items).toHaveLength(books.length + essays.length);
  });

  it('skips unverified books', () => {
    const items = buildScrollkySegment({
      books: [book('ok'), book('few', { essay_count: 1 }), book('long', { list_status: 'longlist' })],
      essays: [],
      essayPool: [],
      seed: 1,
      segmentIndex: 0,
      now: NOW,
    });
    expect(collectShownIds(items).bookIds).toEqual(new Set(['ok']));
  });

  it('is deterministic for a seed and differs between segments', () => {
    const input = { books, essays, essayPool: essays, seed: 20261105, now: NOW };
    const order = (segmentIndex: number) =>
      buildScrollkySegment({ ...input, segmentIndex }).map((item) =>
        item.type === 'essay' ? item.data.id : item.type === 'book' ? item.data.id : item.book.id,
      );
    expect(order(0)).toEqual(order(0));
    expect(order(1)).not.toEqual(order(0));
  });

  it('turns a book with several pooled essays into a multi-perspective card after the interval', () => {
    const manyBooks = Array.from({ length: 10 }, (_, i) => book(`b${i}`));
    const pool = manyBooks.flatMap((b) => [essay(`${b.id}-a`, { book_id: b.id }), essay(`${b.id}-b`, { book_id: b.id })]);
    const items = buildScrollkySegment({
      books: manyBooks,
      essays: Array.from({ length: 20 }, (_, i) => essay(`e${i}`)),
      essayPool: pool,
      seed: 3,
      segmentIndex: 0,
      now: NOW,
    });
    // book, essay, essay, book, essay, essay → the 7th card is the first eligible slot.
    expect(items.slice(0, 6).some((item) => item.type === 'multi_perspective')).toBe(false);
    expect(items[6].type).toBe('multi_perspective');
  });

  it('never uses the viewer’s own essays as perspectives', () => {
    const pool = [
      essay('mine', { book_id: 'b0', author_profile_id: 'me' }),
      essay('other', { book_id: 'b0' }),
    ];
    const items = buildScrollkySegment({
      books: Array.from({ length: 10 }, () => book('b0')).map((b, i) => ({ ...b, id: i === 3 ? 'b0' : `x${i}` })),
      essays: Array.from({ length: 20 }, (_, i) => essay(`e${i}`)),
      essayPool: pool,
      viewer: { profileId: 'me' },
      seed: 3,
      segmentIndex: 0,
      now: NOW,
    });
    expect(items.some((item) => item.type === 'multi_perspective')).toBe(false);
  });
});
