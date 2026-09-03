import type { Tables } from '@/lib/supabase/tables';

const NON_ALPHANUMERIC_PATTERN = /[^a-z0-9\s]/g;
const COMBINING_MARK_PATTERN = /[\u0300-\u036f]/g;
const WHITESPACE_PATTERN = /\s+/g;

const SEARCH_SCORE = {
  exactIsbn: 1_000,
  exactTitle: 900,
  titlePrefix: 800,
  titleContains: 700,
  exactAuthor: 600,
  authorPrefix: 500,
  authorContains: 400,
  allTokens: 300,
} as const;

export type CatalogSearchBook = Pick<
  Tables<'books'>,
  'id' | 'title_cs' | 'title_en' | 'author' | 'isbn_13' | 'google_books_cover_url'
>;

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARK_PATTERN, '')
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();
}

function scoreBook(book: CatalogSearchBook, normalizedQuery: string): number {
  const titleCs = normalizeSearchText(book.title_cs);
  const titleEn = normalizeSearchText(book.title_en ?? '');
  const author = normalizeSearchText(book.author);
  const isbn = normalizeSearchText(book.isbn_13 ?? '');
  const titles = [titleCs, titleEn];

  if (isbn === normalizedQuery) return SEARCH_SCORE.exactIsbn;
  if (titles.some((title) => title === normalizedQuery)) return SEARCH_SCORE.exactTitle;
  if (titles.some((title) => title.startsWith(normalizedQuery))) return SEARCH_SCORE.titlePrefix;
  if (titles.some((title) => title.includes(normalizedQuery))) return SEARCH_SCORE.titleContains;
  if (author === normalizedQuery) return SEARCH_SCORE.exactAuthor;
  if (author.startsWith(normalizedQuery)) return SEARCH_SCORE.authorPrefix;
  if (author.includes(normalizedQuery)) return SEARCH_SCORE.authorContains;

  const searchableText = `${titleCs} ${titleEn} ${author} ${isbn}`;
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  return tokens.every((token) => searchableText.includes(token)) ? SEARCH_SCORE.allTokens : 0;
}

export function searchCatalogBooks(
  books: CatalogSearchBook[],
  query: string,
  limit: number,
): CatalogSearchBook[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery || limit <= 0) return [];

  return books
    .map((book) => ({ book, score: scoreBook(book, normalizedQuery) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => (
      right.score - left.score
      || left.book.title_cs.localeCompare(right.book.title_cs, 'cs')
    ))
    .slice(0, limit)
    .map(({ book }) => book);
}
