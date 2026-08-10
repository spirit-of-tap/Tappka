import { describe, expect, it } from 'vitest';

import { findDuplicate, normalizeTitleKey, type MatchableBook } from './dedupe';

const SPRINT_CS: MatchableBook = {
  id: 'book-cs',
  title_cs: 'Sprint: Jak vyřešit velké problémy',
  title_en: 'Sprint',
  author: 'Jake Knapp',
  isbn_13: '9788075550699',
};

describe('normalizeTitleKey', () => {
  it('lowercases, strips diacritics, punctuation and collapses whitespace', () => {
    expect(normalizeTitleKey('Pátá   disciplína!')).toBe('pata disciplina');
    expect(normalizeTitleKey('Radikální otevřenost')).toBe('radikalni otevrenost');
  });

  it('is stable across punctuation-only differences', () => {
    expect(normalizeTitleKey('Sprint: Jak na to')).toBe(normalizeTitleKey('Sprint - jak na to'));
  });
});

describe('findDuplicate', () => {
  it('matches on ISBN-13 when both sides have one', () => {
    const hit = findDuplicate(
      { title_cs: 'Úplně jiný název', author: 'Někdo Jiný', isbn_13: '9788075550699' },
      [SPRINT_CS],
    );
    expect(hit?.id).toBe('book-cs');
  });

  it('matches an English candidate against a Czech record via title_en', () => {
    const hit = findDuplicate({ title_cs: 'Sprint', author: 'Jake Knapp' }, [SPRINT_CS]);
    expect(hit?.id).toBe('book-cs');
  });

  it('matches a Czech candidate against an English-only record', () => {
    const englishOnly: MatchableBook = {
      id: 'book-en',
      title_cs: 'Sprint',
      title_en: null,
      author: 'Jake Knapp',
      isbn_13: null,
    };
    const hit = findDuplicate(
      { title_cs: 'Jiné vydání', title_en: 'Sprint', author: 'Jake Knapp' },
      [englishOnly],
    );
    expect(hit?.id).toBe('book-en');
  });

  it('does not match when the author differs', () => {
    expect(findDuplicate({ title_cs: 'Sprint', author: 'Jiný Autor' }, [SPRINT_CS])).toBeNull();
  });

  it('ignores a null ISBN on either side rather than treating it as equal', () => {
    const noIsbn: MatchableBook = { ...SPRINT_CS, id: 'x', isbn_13: null, title_en: null, title_cs: 'Něco' };
    expect(findDuplicate({ title_cs: 'Jiné', author: 'Jake Knapp' }, [noIsbn])).toBeNull();
  });
});
