import { describe, expect, it } from 'vitest';

import type { EssayWithDetails } from '@/lib/essays/types';

import { filterMyEssays } from './my-essay-search';

function essay(overrides: Partial<EssayWithDetails>): EssayWithDetails {
  return {
    id: 'e',
    title: '',
    content_text: '',
    book: null,
    content_source: null,
    ...overrides,
  } as EssayWithDetails;
}

const ESSAYS = [
  essay({ id: 'leadership', title: 'Vedení týmu', content_text: 'O důvěře a zpětné vazbě' }),
  essay({
    id: 'book',
    title: 'Moje poznámky',
    book: { title_cs: 'Lean Startup', author: 'Eric Ries' } as EssayWithDetails['book'],
  }),
  essay({ id: 'topic', title: 'Úvaha o čase', content_text: 'Produktivita a priority' }),
];

const ids = (list: EssayWithDetails[]) => list.map((e) => e.id);

describe('filterMyEssays', () => {
  it('returns every essay for an empty query', () => {
    expect(ids(filterMyEssays(ESSAYS, '   '))).toEqual(['leadership', 'book', 'topic']);
  });

  it('matches titles ignoring case and diacritics', () => {
    expect(ids(filterMyEssays(ESSAYS, 'TYMU'))).toEqual(['leadership']);
  });

  it('matches book title and author', () => {
    expect(ids(filterMyEssays(ESSAYS, 'ries'))).toEqual(['book']);
    expect(ids(filterMyEssays(ESSAYS, 'lean startup'))).toEqual(['book']);
  });

  it('matches essay text and requires every word', () => {
    expect(ids(filterMyEssays(ESSAYS, 'duvere vazbe'))).toEqual(['leadership']);
    expect(ids(filterMyEssays(ESSAYS, 'duvere priority'))).toEqual([]);
  });
});
