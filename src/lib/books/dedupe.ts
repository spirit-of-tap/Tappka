/**
 * Application-level duplicate detection. There is deliberately no UNIQUE
 * constraint on `isbn_13` — an ISBN identifies an edition, not a work — so the
 * check lives here and in `POST /api/books`.
 */

export interface MatchableBook {
  id: string;
  title_cs: string;
  title_en: string | null;
  author: string;
  isbn_13: string | null;
}

export interface DuplicateProbe {
  title_cs: string;
  title_en?: string | null;
  author: string;
  isbn_13?: string | null;
}

const DIACRITIC_RANGE = /[̀-ͯ]/g;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;

/** Lowercases, strips diacritics and punctuation, collapses whitespace. */
export function normalizeTitleKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(DIACRITIC_RANGE, '')
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, ' ')
    .trim();
}

function titleKeys(titleCs: string, titleEn: string | null | undefined): Set<string> {
  const keys = new Set<string>([normalizeTitleKey(titleCs)]);
  if (titleEn) keys.add(normalizeTitleKey(titleEn));
  keys.delete('');
  return keys;
}

/**
 * Returns the first book the probe duplicates: same ISBN-13 when both sides
 * have one, otherwise same author and an overlapping title in either language.
 */
export function findDuplicate(
  probe: DuplicateProbe,
  books: MatchableBook[],
): MatchableBook | null {
  const probeAuthor = normalizeTitleKey(probe.author);
  const probeTitles = titleKeys(probe.title_cs, probe.title_en);

  for (const book of books) {
    if (probe.isbn_13 && book.isbn_13 && probe.isbn_13 === book.isbn_13) {
      return book;
    }

    if (normalizeTitleKey(book.author) !== probeAuthor) continue;

    for (const key of titleKeys(book.title_cs, book.title_en)) {
      if (probeTitles.has(key)) return book;
    }
  }

  return null;
}
