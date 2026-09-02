import { describe, expect, it } from 'vitest';
import { validateEssaySourceIds } from './validate-source';

describe('validateEssaySourceIds', () => {
  it('allows a book alone', () => {
    expect(validateEssaySourceIds('book-1', undefined)).toBeNull();
  });

  it('allows a content source alone', () => {
    expect(validateEssaySourceIds(undefined, 'source-1')).toBeNull();
  });

  it('allows neither (essay beyond the reading list)', () => {
    expect(validateEssaySourceIds(undefined, undefined)).toBeNull();
    expect(validateEssaySourceIds(null, null)).toBeNull();
  });

  it('rejects both set at once', () => {
    expect(validateEssaySourceIds('book-1', 'source-1')).toBe(
      'Esej může patřit jen ke knize, nebo jen k jinému zdroji.',
    );
  });
});
