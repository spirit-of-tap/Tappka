import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildBookportCzuLoginUrl,
  pickBookportMatch,
  resolveBookportBook,
  type BookportSearchBook,
} from './bookport';

function makeBook(overrides: Partial<BookportSearchBook> = {}): BookportSearchBook {
  return {
    Title: 'Strážci růže',
    AuthorNamesText: 'Rebecca Gablé',
    Id: 15104,
    Score: 0.016,
    DetailLink: '/kniha/strazci-ruze-15104/',
    EPubUrl: '/ukazka/strazci-ruze-15104/',
    PdfUrl: null,
    Isbn: '978-80-249-5297-0',
    HasOnlineAccess: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pickBookportMatch', () => {
  it('prefers an exact ISBN match over a higher-scored title-only hit', () => {
    const books = [
      makeBook({ Id: 1, Isbn: '978-80-249-5297-0', Title: 'Strážci růže', Score: 0.5 }),
      makeBook({ Id: 2, Isbn: '978-80-900000-0', Title: 'Strážci růže', Score: 0.9 }),
    ];
    const match = pickBookportMatch(books, { titleCs: 'Strážci růže', isbn13: '978-80-249-5297-0' });
    expect(match?.Id).toBe(1);
  });

  it('falls back to the best-scoring title match without an ISBN', () => {
    const books = [
      makeBook({ Id: 1, Isbn: null, Score: 0.4 }),
      makeBook({ Id: 2, Isbn: null, Score: 0.8, Title: 'Strážci růže' }),
    ];
    const match = pickBookportMatch(books, { titleCs: 'Strážci růže', isbn13: null });
    expect(match?.Id).toBe(2);
  });

  it('matches titles case- and diacritics-insensitively', () => {
    const books = [makeBook()];
    const match = pickBookportMatch(books, { titleCs: 'strazci ruze', isbn13: null });
    expect(match?.Id).toBe(15104);
  });

  it('matches a shorter query contained in the book title', () => {
    const books = [makeBook()];
    const match = pickBookportMatch(books, { titleCs: 'Strážci', isbn13: null });
    expect(match?.Id).toBe(15104);
  });

  it('returns null when no result matches the Czech title', () => {
    const books = [makeBook({ Title: 'Úplně jiná kniha' })];
    const match = pickBookportMatch(books, { titleCs: 'Strážci růže', isbn13: null });
    expect(match).toBeNull();
  });

  it('returns null for an empty result set', () => {
    expect(pickBookportMatch([], { titleCs: 'X', isbn13: null })).toBeNull();
  });
});

describe('resolveBookportBook', () => {
  function mockFetchOnce(body: unknown, ok = true) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, status: 200, json: async () => body }));
  }

  it('returns absolute book and ČZU login links for an ISBN match', async () => {
    mockFetchOnce({ Books: [makeBook()] });
    const match = await resolveBookportBook({
      titleCs: 'Strážci růže',
      isbn13: '978-80-249-5297-0',
    });
    expect(match?.bookUrl).toBe('https://www.bookport.cz/kniha/strazci-ruze-15104/');
    expect(match?.loginUrl).toContain('https://www.bookport.cz/AccountSaml/SignIn/');
    expect(match?.loginUrl).toContain('returnUrl=%2Fkniha%2Fstrazci-ruze-15104%2F');
    expect(match?.loginUrl).toContain('idp=https%3A%2F%2Feduid.czu.cz%2Fidp%2Fshibboleth');
    expect(match?.title).toBe('Strážci růže');
  });

  it('builds a ČZU-bound login url from a book path', () => {
    const url = buildBookportCzuLoginUrl('/kniha/strazci-ruze-15104/');
    expect(url).toBe(
      'https://www.bookport.cz/AccountSaml/SignIn/?returnUrl=%2Fkniha%2Fstrazci-ruze-15104%2F' +
        '&idp=https%3A%2F%2Feduid.czu.cz%2Fidp%2Fshibboleth',
    );
  });

  it('returns null when the fetch fails', async () => {
    mockFetchOnce({}, false);
    const match = await resolveBookportBook({ titleCs: 'Strážci růže', isbn13: null });
    expect(match).toBeNull();
  });

  it('returns null for an empty czech title without fetching', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const match = await resolveBookportBook({ titleCs: '   ', isbn13: null });
    expect(match).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null when the match has no usable link', async () => {
    mockFetchOnce({ Books: [makeBook({ DetailLink: null, EPubUrl: null, PdfUrl: null })] });
    const match = await resolveBookportBook({ titleCs: 'Strážci růže', isbn13: null });
    expect(match).toBeNull();
  });
});
