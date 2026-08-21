/**
 * Bookport (https://www.bookport.cz) integration — resolves a Tappka book to its
 * Bookport page by searching Bookport by the Czech title, and links to it
 * through ČZU's eduID login so a university student can read it for free.
 *
 * The Bookport API is public (no auth). Bookport's SAML sign-in endpoint accepts
 * an `idp` parameter, so we can send the student straight to the ČZU identity
 * provider, skipping the identity-provider chooser.
 */

export interface BookportSearchBook {
  Title: string;
  AuthorNamesText?: string | null;
  Id: number;
  Score: number;
  DetailLink: string | null;
  EPubUrl: string | null;
  PdfUrl: string | null;
  Isbn: string | null;
  HasOnlineAccess: boolean;
}

export interface BookportMatch {
  title: string;
  isbn: string | null;
  /** Absolute deep link to the Bookport book page. */
  bookUrl: string;
  /** ČZU eduID sign-in URL that lands the student on the book page signed in. */
  loginUrl: string;
}

interface BookportSearchDataResponse {
  Books?: BookportSearchBook[];
}

const BOOKPORT_BASE_URL = 'https://www.bookport.cz';
const SEARCH_DATA_URL = `${BOOKPORT_BASE_URL}/Search/Data`;
const SEARCH_PAGE_SIZE = 20;
/** Bookport availability rarely changes; cache the search response. */
const SEARCH_REVALIDATE_SECONDS = 6 * 60 * 60;

/** ČZU (Czech University of Life Sciences Prague) eduID identity provider. */
const CZU_ENTITY_ID = 'https://eduid.czu.cz/idp/shibboleth';

const DIACRITIC_RANGE = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;

/** Lowercases, strips diacritics and punctuation, collapses whitespace. */
function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(DIACRITIC_RANGE, '')
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, ' ')
    .trim();
}

/** Reduces an ISBN to its bare digits, when it is a plausible 10/13-digit code. */
function normalizeIsbn(isbn: string | null | undefined): string | null {
  if (!isbn) return null;
  const digits = isbn.replace(/[^\dX]/gi, '').toUpperCase();
  return digits.length === 10 || digits.length === 13 ? digits : null;
}

function isTitleMatch(query: string, title: string): boolean {
  const want = normalizeKey(query);
  const candidate = normalizeKey(title);
  if (!want || !candidate) return false;
  return want === candidate || candidate.includes(want) || (candidate.length >= 4 && want.includes(candidate));
}

/**
 * Picks the Bookport book that most likely corresponds to the Tappka book.
 * Prefers an exact ISBN match, then the highest-scoring result whose title
 * matches the Czech title. Returns null when nothing plausibly matches.
 */
export function pickBookportMatch(
  books: BookportSearchBook[],
  { titleCs, isbn13 }: { titleCs: string; isbn13: string | null },
): BookportSearchBook | null {
  if (!books.length) return null;

  const wantIsbn = normalizeIsbn(isbn13);
  if (wantIsbn) {
    const byIsbn = books.find((book) => normalizeIsbn(book.Isbn) === wantIsbn);
    if (byIsbn) return byIsbn;
  }

  const byTitle = books.filter((book) => isTitleMatch(titleCs, book.Title));
  if (byTitle.length === 0) return null;
  return byTitle.reduce((best, book) => (book.Score > best.Score ? book : best));
}

function toAbsolute(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : `${BOOKPORT_BASE_URL}${path}`;
}

/**
 * Builds the Bookport sign-in URL bound to the ČZU eduID identity provider, so
 * a Czech University of Life Sciences student lands directly on their ČZU login
 * (skipping the identity-provider chooser) and returns to the given book page.
 */
export function buildBookportCzuLoginUrl(bookPath: string): string {
  const params = new URLSearchParams({
    returnUrl: bookPath,
    idp: CZU_ENTITY_ID,
  });
  return `${BOOKPORT_BASE_URL}/AccountSaml/SignIn/?${params.toString()}`;
}

/**
 * Resolves a Tappka book to its Bookport counterpart, or null when the book is
 * not available on Bookport. Never throws — network failures yield null.
 */
export async function resolveBookportBook({
  titleCs,
  isbn13,
}: {
  titleCs: string;
  isbn13: string | null;
}): Promise<BookportMatch | null> {
  if (!titleCs.trim()) return null;

  const params = new URLSearchParams({
    Query: titleCs,
    Page: '0',
    PageSize: String(SEARCH_PAGE_SIZE),
    IsSearchInBookContent: 'false',
  });

  let json: BookportSearchDataResponse;
  try {
    const res = await fetch(`${SEARCH_DATA_URL}?${params}`, {
      next: { revalidate: SEARCH_REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.error(`Bookport search error ${res.status} for "${titleCs}"`);
      return null;
    }
    json = (await res.json()) as BookportSearchDataResponse;
  } catch (error) {
    console.error('Bookport search failed', error);
    return null;
  }

  const match = pickBookportMatch(json.Books ?? [], { titleCs, isbn13 });
  if (!match?.DetailLink) return null;

  const bookUrl = toAbsolute(match.DetailLink);
  if (!bookUrl) return null;

  return {
    title: match.Title,
    isbn: match.Isbn ?? null,
    bookUrl,
    loginUrl: buildBookportCzuLoginUrl(match.DetailLink),
  };
}
