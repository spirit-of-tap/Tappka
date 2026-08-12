import { describe, expect, it } from 'vitest';

import { looksLikeIsbn } from './index';

describe('looksLikeIsbn', () => {
  it('accepts a bare 13-digit EAN/ISBN-13', () => {
    expect(looksLikeIsbn('9781501121746')).toBe(true);
  });

  it('accepts a 10-digit ISBN-10', () => {
    expect(looksLikeIsbn('1501121745')).toBe(true);
  });

  it('tolerates dashes and spaces', () => {
    expect(looksLikeIsbn('978-1-5011-2174-6')).toBe(true);
    expect(looksLikeIsbn('978 1501121746')).toBe(true);
  });

  it('rejects keywords and short or non-numeric queries', () => {
    expect(looksLikeIsbn('sprint')).toBe(false);
    expect(looksLikeIsbn('Sprint od Jakea Knappa')).toBe(false);
    expect(looksLikeIsbn('978150112174')).toBe(false);
    expect(looksLikeIsbn('97815011217461')).toBe(false);
  });

  it('accepts an explicit ISBN prefix', () => {
    expect(looksLikeIsbn('ISBN 978-1-5011-2174-6')).toBe(true);
    expect(looksLikeIsbn('isbn:9781501121746')).toBe(true);
  });
});
