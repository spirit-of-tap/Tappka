import { describe, expect, it } from 'vitest';
import {
  countWords,
  formatReadingTime,
  formatWordCount,
  formatWordDelta,
} from '@/lib/essays/text-stats';

describe('countWords', () => {
  it('counts zero for empty and whitespace-only text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n  ')).toBe(0);
  });

  it('collapses runs of whitespace between words', () => {
    expect(countWords('jedno   dvě\n\ntři')).toBe(3);
  });
});

describe('formatWordCount', () => {
  it('uses all three Czech plural forms', () => {
    expect(formatWordCount(0)).toBe('0 slov');
    expect(formatWordCount(1)).toBe('1 slovo');
    expect(formatWordCount(3)).toBe('3 slova');
    expect(formatWordCount(12)).toBe('12 slov');
  });

  it('groups thousands', () => {
    expect(formatWordCount(1240)).toMatch(/^1.240 slov$/);
  });
});

describe('formatReadingTime', () => {
  it('never reports less than a minute', () => {
    expect(formatReadingTime(3)).toBe('1 min čtení');
  });

  it('rounds to the nearest minute', () => {
    expect(formatReadingTime(500)).toBe('3 min čtení');
  });
});

describe('formatWordDelta', () => {
  it('returns null when the count is unchanged', () => {
    expect(formatWordDelta(120, 120)).toBeNull();
  });

  it('signs growth and shrinkage', () => {
    expect(formatWordDelta(300, 120)).toBe('+180');
    expect(formatWordDelta(100, 140)).toBe('−40');
  });
});
