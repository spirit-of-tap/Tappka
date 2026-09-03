import { describe, expect, it } from 'vitest';
import { cleanBookTitle, structureBookTitle } from './format-title';

describe('cleanBookTitle', () => {
  it('strips leading and trailing quotes', () => {
    expect(cleanBookTitle('"Velká kniha"')).toBe('Velká kniha');
    expect(cleanBookTitle('„Restart“')).toBe('Restart');
    expect(cleanBookTitle('“Thinking, Fast and Slow”')).toBe('Thinking, Fast and Slow');
    expect(cleanBookTitle("'Deep Work'")).toBe('Deep Work');
  });

  it('handles empty or whitespace strings', () => {
    expect(cleanBookTitle('')).toBe('');
    expect(cleanBookTitle('   ')).toBe('');
  });

  it('preserves inner punctuation', () => {
    expect(cleanBookTitle('Thinking, Fast and Slow')).toBe('Thinking, Fast and Slow');
  });
});

describe('structureBookTitle', () => {
  it('splits main title and subtitle separated by colon', () => {
    const result = structureBookTitle(
      '"Velká kniha týmových koučovacích her: Rychlé a efektivní aktivity pro nabuzení, motivaci a týmovou spolupráci"',
    );
    expect(result.title).toBe('Velká kniha týmových koučovacích her');
    expect(result.subtitle).toBe('Rychlé a efektivní aktivity pro nabuzení, motivaci a týmovou spolupráci');
    expect(result.fullTitle).toBe(
      'Velká kniha týmových koučovacích her: Rychlé a efektivní aktivity pro nabuzení, motivaci a týmovou spolupráci',
    );
  });

  it('splits main title and subtitle separated by dash', () => {
    const result = structureBookTitle('Start with Why - How Great Leaders Inspire Everyone to Take Action');
    expect(result.title).toBe('Start with Why');
    expect(result.subtitle).toBe('How Great Leaders Inspire Everyone to Take Action');
  });

  it('returns clean title when no subtitle is present', () => {
    const result = structureBookTitle('"Restart"');
    expect(result.title).toBe('Restart');
    expect(result.subtitle).toBeUndefined();
    expect(result.fullTitle).toBe('Restart');
  });

  it('handles empty string', () => {
    const result = structureBookTitle('');
    expect(result.title).toBe('');
    expect(result.subtitle).toBeUndefined();
  });
});
