import { describe, expect, it } from 'vitest';
import { formatVerifiedBooksForClipboard } from './export-text';

const CATEGORIES = [
  { key: 'finance', label: 'Finance' },
  { key: 'leadership', label: 'Leadership' },
];

describe('formatVerifiedBooksForClipboard', () => {
  it('groups books under their category with points and essay counts', () => {
    const text = formatVerifiedBooksForClipboard(
      [
        { title_cs: 'Sprint', author: 'Jake Knapp', tags: ['leadership'], book_points: 3, essay_count: 12 },
        { title_cs: 'Nudges', author: 'Richard Thaler', tags: ['finance'], book_points: 1, essay_count: 1 },
      ],
      CATEGORIES,
    );

    expect(text).toBe(
      [
        'Ověřené knihy (2)',
        '',
        'Finance',
        '- Nudges – Richard Thaler (1 bod, 1 esej)',
        '',
        'Leadership',
        '- Sprint – Jake Knapp (3 body, 12 esejí)',
      ].join('\n'),
    );
  });

  it('skips empty categories and sorts books by Czech title', () => {
    const text = formatVerifiedBooksForClipboard(
      [
        { title_cs: 'Život', author: 'A', tags: ['finance'], book_points: 2, essay_count: 0 },
        { title_cs: 'Alchymista', author: 'B', tags: ['finance'], book_points: 2, essay_count: 5 },
      ],
      CATEGORIES,
    );

    expect(text).not.toContain('Leadership');
    expect(text.indexOf('Alchymista')).toBeLessThan(text.indexOf('Život'));
    expect(text).toContain('(2 body, 0 esejí)');
    expect(text).toContain('(2 body, 5 esejí)');
  });

  it('lists a multi-tagged book once under its first category and unfiled books under Ostatní', () => {
    const text = formatVerifiedBooksForClipboard(
      [
        { title_cs: 'Oba', author: 'A', tags: ['leadership', 'finance'], book_points: 2, essay_count: 3 },
        { title_cs: 'Bez tagu', author: 'B', tags: [], book_points: null, essay_count: null },
      ],
      CATEGORIES,
    );

    expect(text).toBe(
      [
        'Ověřené knihy (2)',
        '',
        'Finance',
        '- Oba – A (2 body, 3 eseje)',
        '',
        'Ostatní',
        '- Bez tagu – B (0 esejí)',
      ].join('\n'),
    );
  });

  it('returns just the header when there are no books', () => {
    expect(formatVerifiedBooksForClipboard([], CATEGORIES)).toBe('Ověřené knihy (0)');
  });
});
