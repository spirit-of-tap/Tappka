import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildBookportCzuLoginUrl,
  pickBookportMatch,
  resolveBookportBook,
  type BookportSearchBook,
} from './bookport';

function makeBook(overrides: Partial<BookportSearchBook> = {}): BookportSearchBook {
  return {
    Title: 'Babička',
    AuthorNamesText: 'Němcová Božena',
    Id: 7862,
    Score: 0.016,
    DetailLink: '/kniha/babicka-7862/',
    EPubUrl: '/ukazka/babicka-7862/',
    PdfUrl: null,
    Isbn: '978-80-274-0043-9',
    HasOnlineAccess: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pickBookportMatch', () => {
  it('keeps the exact title even when a partial match scores higher on Bookport', () => {
    const books = [
      makeBook({ Id: 7862, Title: 'Babička', AuthorNamesText: 'Němcová Božena', Score: 0.016 }),
      makeBook({
        Id: 16409,
        Title: 'Šílená babička na cestách',
        AuthorNamesText: 'Boučková Martina',
        Score: 0.031,
        Isbn: '978-80-247-0980-2',
      }),
    ];

    const match = pickBookportMatch(books, {
      titleCs: 'Babička',
      isbn13: null,
      author: 'Božena Němcová',
    });

    expect(match?.Id).toBe(7862);
  });

  it('rejects a partial title when no result is the same book', () => {
    const books = [
      makeBook({
        Id: 16409,
        Title: 'Šílená babička na cestách',
        AuthorNamesText: 'Boučková Martina',
        Score: 0.031,
      }),
    ];

    const match = pickBookportMatch(books, {
      titleCs: 'Babička',
      isbn13: null,
      author: 'Božena Němcová',
    });

    expect(match).toBeNull();
  });

  it('does not let a single shared word pull in an unrelated book', () => {
    const books = [
      makeBook({
        Id: 1,
        Title: 'Zlom',
        AuthorNamesText: 'Dahl Arne',
        Score: 0.9,
        Isbn: '978-80-8090-299-5',
      }),
    ];

    const match = pickBookportMatch(books, {
      titleCs: 'Bod zlomu',
      isbn13: '9783641189143',
      author: 'Malcolm Gladwell',
    });

    expect(match).toBeNull();
  });

  it('accepts an ISBN match only when the title agrees', () => {
    const books = [makeBook({ Title: 'Konec prokrastinace', AuthorNamesText: 'Petr Ludwig' })];

    const match = pickBookportMatch(books, {
      titleCs: 'Konec prokrastinace: Jak přestat odkládat a začít žít naplno',
      isbn13: '9788087270516',
      author: 'Petr Ludwig',
    });

    expect(match?.Title).toBe('Konec prokrastinace');
  });

  it('ignores an ISBN that points at a different book and uses title + author instead', () => {
    const books = [
      makeBook({
        Id: 1,
        Title: 'Úplně jiná kniha',
        AuthorNamesText: 'Někdo Jiný',
        Score: 0.9,
        Isbn: '978-80-000-0000-1',
      }),
      makeBook({
        Id: 2,
        Title: 'Babička',
        AuthorNamesText: 'Němcová Božena',
        Score: 0.01,
        Isbn: null,
      }),
    ];

    const match = pickBookportMatch(books, {
      titleCs: 'Babička',
      isbn13: '978-80-000-0000-1',
      author: 'Božena Němcová',
    });

    expect(match?.Id).toBe(2);
  });

  it('rejects an ISBN match whose title does not agree when nothing else fits', () => {
    const books = [
      makeBook({
        Id: 1,
        Title: 'Úplně jiná kniha',
        AuthorNamesText: 'Někdo Jiný',
        Isbn: '978-80-000-0000-1',
      }),
    ];

    const match = pickBookportMatch(books, {
      titleCs: 'Babička',
      isbn13: '978-80-000-0000-1',
      author: 'Božena Němcová',
    });

    expect(match).toBeNull();
  });

  it('matches a book stored with a subtitle against the bare title', () => {
    const books = [
      makeBook({
        Id: 1,
        Title: 'Konec prokrastinace',
        AuthorNamesText: 'Petr Ludwig',
      }),
    ];

    const match = pickBookportMatch(books, {
      titleCs: 'Konec prokrastinace: Jak přestat odkládat a začít žít naplno',
      isbn13: null,
      author: 'Petr Ludwig',
    });

    expect(match?.Id).toBe(1);
  });

  it('rejects a same-title book by a different author', () => {
    const books = [
      makeBook({ Id: 1, Title: 'Koučování', AuthorNamesText: 'Daňková Michaela' }),
    ];

    const match = pickBookportMatch(books, {
      titleCs: 'Koučování',
      isbn13: null,
      author: 'John Whitmore',
    });

    expect(match).toBeNull();
  });

  it('breaks a same-title tie by author, not by Bookport score', () => {
    const books = [
      makeBook({
        Id: 1,
        Title: 'Online marketing: Od webových stránek k sociálním sítím',
        AuthorNamesText: 'Novotová Jitka',
        Score: 0.9,
      }),
      makeBook({
        Id: 2,
        Title: 'Online marketing: Od webových stránek k sociálním sítím',
        AuthorNamesText: 'Burešová Jitka',
        Score: 0.1,
      }),
    ];

    const match = pickBookportMatch(books, {
      titleCs: 'Online marketing: Od webových stránek k sociálním sítím',
      isbn13: null,
      author: 'Burešová Jitka',
    });

    expect(match?.Id).toBe(2);
  });

  it('matches authors across word order and Czech feminine endings', () => {
    const dweck = pickBookportMatch(
      [makeBook({ Title: 'Nastavení mysli [2]', AuthorNamesText: 'Carol Dwecková' })],
      { titleCs: 'Nastavení mysli: Nová psychologie úspěchu', isbn13: null, author: 'Carol Dweck' },
    );
    const cain = pickBookportMatch(
      [makeBook({ Title: 'Ticho', AuthorNamesText: 'Susan Cainová' })],
      { titleCs: 'Ticho: Síla introvertů ve světě, který nikdy nepřestává mluvit', isbn13: null, author: 'SUSAN CAINOVA.' },
    );
    const kabatZinn = pickBookportMatch(
      [makeBook({ Title: 'Život samá pohroma', AuthorNamesText: 'Jon KabatZinn' })],
      { titleCs: 'Život samá pohroma', isbn13: null, author: 'Jon Kabat-Zinn' },
    );

    expect(dweck?.Title).toBe('Nastavení mysli [2]');
    expect(cain?.Title).toBe('Ticho');
    expect(kabatZinn?.Title).toBe('Život samá pohroma');
  });

  it('matches titles case- and diacritics-insensitively', () => {
    const books = [makeBook({ Title: 'Strážci růže', AuthorNamesText: 'Rebecca Gablé' })];
    const match = pickBookportMatch(books, {
      titleCs: 'strazci ruze',
      isbn13: null,
      author: 'Rebecca Gablé',
    });
    expect(match?.Title).toBe('Strážci růže');
  });

  it('requires an exact title when the author is unknown', () => {
    const partial = pickBookportMatch([makeBook({ Title: 'Den', AuthorNamesText: 'Němec Jan' })], {
      titleCs: 'Den, kdy jsem se naučil žít',
      isbn13: null,
      author: 'Neznámý autor',
    });
    const exact = pickBookportMatch(
      [makeBook({ Title: 'Základy úspěšného podnikání', AuthorNamesText: 'Šafrová Drášilová Alena' })],
      { titleCs: 'Základy úspěšného podnikání', isbn13: null, author: 'Neznámý autor' },
    );

    expect(partial).toBeNull();
    expect(exact?.Title).toBe('Základy úspěšného podnikání');
  });

  it('refuses to guess when several works share the main title', () => {
    const books = [
      makeBook({
        Id: 1,
        Title: 'Čtyři dohody - Kniha moudrosti starých Toltéků',
        AuthorNamesText: 'Don Miguel Ruiz',
      }),
      makeBook({
        Id: 2,
        Title: 'Čtyři dohody - Modlitby',
        AuthorNamesText: 'Ruiz Don Miguel, Millsová Janet',
      }),
    ];

    const match = pickBookportMatch(books, {
      titleCs: 'Čtyři dohody',
      isbn13: null,
      author: 'Miguel Ruiz, Janet Mills',
    });

    expect(match).toBeNull();
  });

  it('rejects two different subtitles under the same main title', () => {
    const books = [
      makeBook({
        Title: 'Nenásilná komunikace - základní myšlenky',
        AuthorNamesText: 'Marshall B. Rosenberg',
      }),
    ];

    const match = pickBookportMatch(books, {
      titleCs: 'Nenásilná komunikace - řeč života',
      isbn13: null,
      author: 'Marshall B. Rosenberg, Norma Garcíová',
    });

    expect(match).toBeNull();
  });

  it('still matches an edition marker after the main title', () => {
    const books = [
      makeBook({
        Title: 'Konec prokrastinace: 2. vydání',
        AuthorNamesText: 'Petr Ludwig',
      }),
    ];

    const match = pickBookportMatch(books, {
      titleCs: 'Konec prokrastinace: Jak přestat odkládat a začít žít naplno',
      isbn13: null,
      author: 'Petr Ludwig',
    });

    expect(match?.Title).toBe('Konec prokrastinace: 2. vydání');
  });

  it('returns null when no result matches the Czech title', () => {
    const books = [makeBook({ Title: 'Úplně jiná kniha' })];
    const match = pickBookportMatch(books, {
      titleCs: 'Strážci růže',
      isbn13: null,
      author: 'Rebecca Gablé',
    });
    expect(match).toBeNull();
  });

  it('returns null for an empty result set', () => {
    expect(
      pickBookportMatch([], { titleCs: 'X', isbn13: null, author: 'Autor' }),
    ).toBeNull();
  });
});

describe('resolveBookportBook', () => {
  function mockFetchOnce(body: unknown, ok = true) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, status: 200, json: async () => body }));
  }

  it('returns absolute book and ČZU login links for a corroborated match', async () => {
    mockFetchOnce({ Books: [makeBook()] });
    const match = await resolveBookportBook({
      titleCs: 'Babička',
      isbn13: '978-80-274-0043-9',
      author: 'Božena Němcová',
    });
    expect(match?.bookUrl).toBe('https://www.bookport.cz/kniha/babicka-7862/');
    expect(match?.loginUrl).toContain('https://www.bookport.cz/AccountSaml/SignIn/');
    expect(match?.loginUrl).toContain('returnUrl=%2Fkniha%2Fbabicka-7862%2F');
    expect(match?.loginUrl).toContain('idp=https%3A%2F%2Feduid.czu.cz%2Fidp%2Fshibboleth');
    expect(match?.title).toBe('Babička');
  });

  it('links to the exact title even when the search returns a higher-scored lookalike', async () => {
    mockFetchOnce({
      Books: [
        makeBook({ Id: 16409, Title: 'Šílená babička na cestách', AuthorNamesText: 'Boučková Martina', Score: 0.9, DetailLink: '/kniha/silena-babicka-na-cestach-16409/' }),
        makeBook({ Id: 7862, Title: 'Babička', AuthorNamesText: 'Němcová Božena', Score: 0.01 }),
      ],
    });

    const match = await resolveBookportBook({
      titleCs: 'Babička',
      isbn13: null,
      author: 'Božena Němcová',
    });

    expect(match?.bookUrl).toBe('https://www.bookport.cz/kniha/babicka-7862/');
    expect(match?.loginUrl).toContain('returnUrl=%2Fkniha%2Fbabicka-7862%2F');
  });

  it('builds a ČZU-bound login url from a book path', () => {
    const url = buildBookportCzuLoginUrl('/kniha/babicka-7862/');
    expect(url).toBe(
      'https://www.bookport.cz/AccountSaml/SignIn/?returnUrl=%2Fkniha%2Fbabicka-7862%2F' +
        '&idp=https%3A%2F%2Feduid.czu.cz%2Fidp%2Fshibboleth',
    );
  });

  it('returns null when the fetch fails', async () => {
    mockFetchOnce({}, false);
    const match = await resolveBookportBook({
      titleCs: 'Strážci růže',
      isbn13: null,
      author: 'Rebecca Gablé',
    });
    expect(match).toBeNull();
  });

  it('returns null for an empty czech title without fetching', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const match = await resolveBookportBook({
      titleCs: '   ',
      isbn13: null,
      author: 'Božena Němcová',
    });
    expect(match).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null when the match has no usable link', async () => {
    mockFetchOnce({ Books: [makeBook({ DetailLink: null, EPubUrl: null, PdfUrl: null })] });
    const match = await resolveBookportBook({
      titleCs: 'Babička',
      isbn13: null,
      author: 'Božena Němcová',
    });
    expect(match).toBeNull();
  });
});
