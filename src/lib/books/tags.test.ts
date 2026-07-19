import { describe, expect, it } from 'vitest';

import { tagNamesFromJoin } from './tags';

describe('tagNamesFromJoin', () => {
  it('returns tag names from a book_tags join payload', () => {
    expect(
      tagNamesFromJoin([
        { tags: { name: 'podnikani' } },
        { tags: { name: 'vedeni' } },
      ]),
    ).toEqual(['podnikani', 'vedeni']);
  });

  it('skips null tag joins and empty payloads', () => {
    expect(tagNamesFromJoin([{ tags: null }])).toEqual([]);
    expect(tagNamesFromJoin(null)).toEqual([]);
    expect(tagNamesFromJoin(undefined)).toEqual([]);
  });
});
