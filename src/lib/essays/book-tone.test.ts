import { describe, expect, it } from 'vitest';
import { BOOK_TONE_CLASSES, bookToneClass } from './book-tone';

describe('bookToneClass', () => {
  it('is deterministic per key', () => {
    expect(bookToneClass('book-1')).toBe(bookToneClass('book-1'));
  });

  it('always returns one of the fixed tones', () => {
    for (const key of ['', 'a', 'Clean Code', 'e5a1-77']) {
      expect(BOOK_TONE_CLASSES).toContain(bookToneClass(key));
    }
  });

  it('spreads different keys over more than one tone', () => {
    const tones = new Set(Array.from({ length: 20 }, (_, i) => bookToneClass(`book-${i}`)));
    expect(tones.size).toBeGreaterThan(1);
  });
});
