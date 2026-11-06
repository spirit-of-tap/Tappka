import { serverLogger } from "@/lib/server-logger";

/**
 * Bookport (https://www.bookport.cz) integration — resolves a Tappka book to its
 * Bookport page by searching Bookport by the Czech title, and links to it
 * through ČZU's eduID login so a university student can read it for free.
 *
 * The Bookport API is public (no auth). Bookport's SAML sign-in endpoint accepts
 * an `idp` parameter, so we can send the student straight to the ČZU identity
 * provider, skipping the identity-provider chooser.
 *
 * Matching is deliberately strict: Bookport's search returns fuzzy, loosely
 * ranked results (an exact title can be listed *below* an unrelated book that
 * merely contains one of its words), and neither the ISBN nor Bookport's own
 * `Score` can be trusted on its own. A wrong `Číst zdarma` button is worse than
 * no button, so a candidate is only accepted when the title *and* the author
 * agree, or when a matching ISBN is corroborated by the title.
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

interface BookportPickInput {
  titleCs: string;
  isbn13: string | null;
  author: string;
}

interface ScoredBookportBook {
  book: BookportSearchBook;
  titleScore: number;
  authorScore: number | null;
  isbnMatch: boolean;
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
const WHITESPACE = /\s+/g;
const BRACKETED = /\[[^\]]*\]/g;
/** `Title: subtitle`, `Title - subtitle`, `Title. Subtitle`. */
const SUBTITLE_SEPARATOR = /\s*[:–—]\s*|\s+-\s+|\.\s+/;

/** Author metadata that carries no usable information. */
const UNKNOWN_AUTHOR = /^(nezn|kolektiv|autor neuveden|unknown|anonym)/i;

const TITLE_STOP_WORDS = new Set([
  'a', 'i', 'v', 've', 'na', 'do', 'k', 'ke', 'o', 'pro', 'se', 's', 'z', 'ze',
  'the', 'of', 'and', 'to', 'je', 'jak', 'aneb', 'edice', 'vydani',
]);
const AUTHOR_STOP_WORDS = new Set([
  'de', 'da', 'von', 'van', 'jr', 'sr', 'ml', 'st', 'and', 'kolektiv', 'firma',
]);

const ISBN_TITLE_MIN_SCORE = 0.6;
const TITLE_MATCH_MIN_SCORE = 0.75;
const AUTHOR_MATCH_MIN_SCORE = 0.5;
/** Only an exact (or main-title) match is trusted when we don't know the author. */
const AUTHORLESS_TITLE_MIN_SCORE = 0.95;
const MAIN_TITLE_SCORE = 0.95;
const MAX_FUZZY_TITLE_SCORE = 0.94;
const FUZZY_SCORE_PENALTY = 0.95;
const MIN_FUZZY_PRECISION = 0.8;
const MIN_FUZZY_F1 = 0.6;
const MIN_FUZZY_SHARED_TOKENS = 2;
const MIN_TITLE_TOKEN_LENGTH = 2;
const MIN_AUTHOR_TOKEN_LENGTH = 3;
/** Words are matched by prefix to absorb Czech inflection (Dweck/Dwecková). */
const MIN_TOKEN_PREFIX_LENGTH = 5;
const MIN_COLLAPSED_AUTHOR_LENGTH = 6;
const SCORE_EPSILON = 1e-9;

/** Lowercases, strips diacritics and punctuation, collapses whitespace. */
function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(DIACRITIC_RANGE, '')
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, ' ')
    .replace(WHITESPACE, ' ')
    .trim();
}

/** Bookport uses bracketed markers such as `[2]` for editions/formats. */
function stripBrackets(value: string): string {
  return value.replace(BRACKETED, ' ');
}

function tokenize(value: string, stopWords: ReadonlySet<string>, minLength: number): string[] {
  return normalizeKey(stripBrackets(value))
    .split(' ')
    .filter((token) => token.length >= minLength && !stopWords.has(token));
}

function mainTitle(value: string): string {
  return stripBrackets(value).split(SUBTITLE_SEPARATOR)[0] ?? '';
}

/** Everything after the first subtitle separator, e.g. `2. vydání` or `Řeč života`. */
function subtitleOf(value: string): string {
  const parts = stripBrackets(value).split(SUBTITLE_SEPARATOR);
  return parts.slice(1).join(' ').trim();
}

/**
 * When both titles carry a meaningful subtitle, those subtitles have to agree.
 * A missing subtitle (`Title` vs `Title: Příručka`) or an edition marker such as
 * `2. vydání` is fine; two unrelated subtitles mean two different works.
 */
function subtitlesAgree(query: string, candidate: string): boolean {
  const queryTokens = tokenize(subtitleOf(query), TITLE_STOP_WORDS, MIN_TITLE_TOKEN_LENGTH);
  const candidateTokens = tokenize(subtitleOf(candidate), TITLE_STOP_WORDS, MIN_TITLE_TOKEN_LENGTH);
  if (!queryTokens.length || !candidateTokens.length) return true;
  return queryTokens.some((token) =>
    candidateTokens.some((candidateToken) => tokensMatch(token, candidateToken)),
  );
}

/** Two words are equal, or one is a Czech-inflected prefix of the other. */
function tokensMatch(left: string, right: string): boolean {
  if (left === right) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return shorter.length >= MIN_TOKEN_PREFIX_LENGTH && longer.startsWith(shorter);
}

/**
 * How likely two titles describe the same work (0 = no match, 1 = exact).
 * Handles subtitles, edition markers and inflected word order.
 */
function titleConfidence(query: string, candidate: string): number {
  const queryKey = normalizeKey(query);
  const candidateKey = normalizeKey(candidate);
  if (!queryKey || !candidateKey) return 0;
  if (queryKey === candidateKey) return 1;

  const queryMain = normalizeKey(mainTitle(query));
  const candidateMain = normalizeKey(mainTitle(candidate));
  if (queryMain && candidateMain && queryMain === candidateMain && subtitlesAgree(query, candidate)) {
    return MAIN_TITLE_SCORE;
  }

  const queryTokens = tokenize(query, TITLE_STOP_WORDS, MIN_TITLE_TOKEN_LENGTH);
  const candidateTokens = tokenize(candidate, TITLE_STOP_WORDS, MIN_TITLE_TOKEN_LENGTH);
  if (!queryTokens.length || !candidateTokens.length) return 0;

  const shared = queryTokens.filter((token) =>
    candidateTokens.some((candidateToken) => tokensMatch(token, candidateToken)),
  ).length;

  const minimumShared = Math.min(MIN_FUZZY_SHARED_TOKENS, queryTokens.length);
  if (shared < minimumShared) return 0;

  const precision = shared / queryTokens.length;
  const recall = shared / candidateTokens.length;
  const f1 = (2 * precision * recall) / (precision + recall);
  if (precision < MIN_FUZZY_PRECISION || f1 < MIN_FUZZY_F1) return 0;

  return Math.min(MAX_FUZZY_TITLE_SCORE, f1 * FUZZY_SCORE_PENALTY);
}

/**
 * Weighted overlap of the query author's words with a Bookport author string
 * (0 = different author, 1 = every word matched). Longer words weigh more, so a
 * shared first name alone does not pass as the same author.
 *
 * Returns null when it cannot judge (unknown author on either side).
 */
function authorConfidence(author: string, candidateAuthor: string | null | undefined): number | null {
  const queryAuthor = author.trim();
  if (!queryAuthor || UNKNOWN_AUTHOR.test(queryAuthor)) return null;
  const candidate = (candidateAuthor ?? '').trim();
  if (!candidate) return null;

  const queryKey = normalizeKey(stripBrackets(queryAuthor)).replace(WHITESPACE, '');
  const candidateKey = normalizeKey(stripBrackets(candidate)).replace(WHITESPACE, '');
  if (
    queryKey.length >= MIN_COLLAPSED_AUTHOR_LENGTH &&
    candidateKey.length >= MIN_COLLAPSED_AUTHOR_LENGTH &&
    (queryKey.includes(candidateKey) || candidateKey.includes(queryKey))
  ) {
    return 1;
  }

  const queryTokens = tokenize(queryAuthor, AUTHOR_STOP_WORDS, MIN_AUTHOR_TOKEN_LENGTH);
  const candidateTokens = tokenize(candidate, AUTHOR_STOP_WORDS, MIN_AUTHOR_TOKEN_LENGTH);
  if (!queryTokens.length || !candidateTokens.length) return null;

  const totalWeight = queryTokens.reduce((sum, token) => sum + token.length, 0);
  const matchedWeight = queryTokens
    .filter((token) => candidateTokens.some((candidateToken) => tokensMatch(token, candidateToken)))
    .reduce((sum, token) => sum + token.length, 0);

  return totalWeight === 0 ? null : matchedWeight / totalWeight;
}

/** Reduces an ISBN to its bare digits, when it is a plausible 10/13-digit code. */
function normalizeIsbn(isbn: string | null | undefined): string | null {
  if (!isbn) return null;
  const digits = isbn.replace(/[^\dX]/gi, '').toUpperCase();
  return digits.length === 10 || digits.length === 13 ? digits : null;
}

function scoresEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < SCORE_EPSILON;
}

function compareCandidates(left: ScoredBookportBook, right: ScoredBookportBook): number {
  const byTitle = right.titleScore - left.titleScore;
  if (byTitle !== 0) return byTitle;

  const byAuthor = (right.authorScore ?? 0) - (left.authorScore ?? 0);
  if (byAuthor !== 0) return byAuthor;

  return right.book.Score - left.book.Score;
}

/**
 * Picks the Bookport book that most likely corresponds to the Tappka book.
 *
 * An ISBN is never trusted on its own — a wrong ISBN in Tappka must not send a
 * reader to an unrelated book — so it only wins when the title also agrees.
 * Otherwise the best title match is accepted only when the author corroborates
 * it (or, without author metadata, when the title matches exactly).
 */
export function pickBookportMatch(
  books: BookportSearchBook[],
  { titleCs, isbn13, author }: BookportPickInput,
): BookportSearchBook | null {
  if (!books.length) return null;

  const wantedIsbn = normalizeIsbn(isbn13);
  const scored: ScoredBookportBook[] = books.map((book) => ({
    book,
    titleScore: titleConfidence(titleCs, book.Title),
    authorScore: authorConfidence(author, book.AuthorNamesText),
    isbnMatch: wantedIsbn !== null && normalizeIsbn(book.Isbn) === wantedIsbn,
  }));

  const isbnMatch = scored
    .filter((entry) => entry.isbnMatch && entry.titleScore >= ISBN_TITLE_MIN_SCORE)
    .sort(compareCandidates)[0];
  if (isbnMatch) return isbnMatch.book;

  const candidates = scored
    .filter((entry) => entry.titleScore >= TITLE_MATCH_MIN_SCORE)
    .filter((entry) =>
      entry.authorScore === null
        ? entry.titleScore >= AUTHORLESS_TITLE_MIN_SCORE
        : entry.authorScore >= AUTHOR_MATCH_MIN_SCORE,
    )
    .sort(compareCandidates);

  const best = candidates[0];
  if (!best) return null;

  // Subtitle-only matches can collide (e.g. two different works sharing a main
  // title). Without an ISBN or a stronger title signal, don't guess. Exact-title
  // duplicates are the same work, so they are not treated as rivals.
  if (best.titleScore < 1) {
    const bestMainTitle = normalizeKey(mainTitle(best.book.Title));
    const hasAmbiguousRival = candidates.some(
      (entry) =>
        entry !== best &&
        scoresEqual(entry.titleScore, best.titleScore) &&
        normalizeKey(mainTitle(entry.book.Title)) === bestMainTitle,
    );
    if (hasAmbiguousRival) return null;
  }

  return best.book;
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
  author,
}: BookportPickInput): Promise<BookportMatch | null> {
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
      serverLogger.console.error(`Bookport search error ${res.status} for "${titleCs}"`);
      return null;
    }
    json = (await res.json()) as BookportSearchDataResponse;
  } catch (error) {
    serverLogger.console.error('Bookport search failed', error);
    return null;
  }

  const match = pickBookportMatch(json.Books ?? [], { titleCs, isbn13, author });
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
