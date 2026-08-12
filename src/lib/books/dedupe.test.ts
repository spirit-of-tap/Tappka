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

  it('matches on title even when the author string differs', () => {
    const hit = findDuplicate({ title_cs: 'Sprint', author: 'Jiný Autor' }, [SPRINT_CS]);
    expect(hit?.id).toBe('book-cs');
  });

  it('matches a title with a subtitle against a shorter submitted title', () => {
    const hit = findDuplicate(
      { title_cs: 'Sprint', title_en: null, author: 'Někdo' },
      [
        {
          id: 'book-sub',
          title_cs: 'Sprint: Jak vyřešit velké problémy za pět dní',
          title_en: null,
          author: 'Jake Knapp',
          isbn_13: null,
        },
      ],
    );
    expect(hit?.id).toBe('book-sub');
  });

  it('matches via title_en when the probe only carries the Czech title', () => {
    const hit = findDuplicate(
      { title_cs: 'Sprint', author: 'Někdo' },
      [
        {
          id: 'book-en',
          title_cs: 'Úplně jiný název',
          title_en: 'Sprint',
          author: 'Jake Knapp',
          isbn_13: null,
        },
      ],
    );
    expect(hit?.id).toBe('book-en');
  });

  it('does not treat a two-letter title as contained in another title', () => {
    expect(
      findDuplicate(
        { title_cs: 'IT', author: 'Někdo' },
        [
          {
            id: 'book-it',
            title_cs: 'IT služby pro malé firmy',
            title_en: null,
            author: 'Někdo Jiný',
            isbn_13: null,
          },
        ],
      ),
    ).toBeNull();
  });

  it('ignores a null ISBN on either side rather than treating it as equal', () => {
    const noIsbn: MatchableBook = { ...SPRINT_CS, id: 'x', isbn_13: null, title_en: null, title_cs: 'Něco' };
    expect(findDuplicate({ title_cs: 'Jiné', author: 'Jake Knapp' }, [noIsbn])).toBeNull();
  });

  it('matches a multi-author string, which is how Google Books reports co-authors', () => {
    const coAuthored: MatchableBook = {
      id: 'book-multi',
      title_cs: 'Sprint',
      title_en: null,
      author: 'Jake Knapp, John Zeratsky, Braden Kowitz',
      isbn_13: null,
    };
    const hit = findDuplicate(
      { title_cs: 'Sprint', author: 'Jake Knapp, John Zeratsky, Braden Kowitz' },
      [coAuthored],
    );
    expect(hit?.id).toBe('book-multi');
  });
});
