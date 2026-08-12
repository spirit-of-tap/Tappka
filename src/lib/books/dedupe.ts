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

/**
 * Titles shorter than this are never treated as contained in another title —
 * two-letter keys like "IT" would match any title mentioning the letters.
 */
const MIN_CONTAINED_TITLE_LENGTH = 4;

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
 * True when one normalized title equals or contains the other. Cross-pairs
 * probe and stored keys, so a Czech title matches an English one (and vice
 * versa) whenever the record stores both languages.
 */
function titlesOverlap(probeKeys: Set<string>, storedKey: string): boolean {
  if (probeKeys.has(storedKey)) return true;

  for (const probeKey of probeKeys) {
    const shorter = probeKey.length <= storedKey.length ? probeKey : storedKey;
    const longer = probeKey.length <= storedKey.length ? storedKey : probeKey;
    if (shorter.length >= MIN_CONTAINED_TITLE_LENGTH && longer.includes(shorter)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the first book the probe duplicates: same ISBN-13 when both sides
 * have one, otherwise an overlapping title in either language (author is not
 * part of the match — editions and translations differ in how they spell it,
 * but the same work carries the same title).
 */
export function findDuplicate(
  probe: DuplicateProbe,
  books: MatchableBook[],
): MatchableBook | null {
  const probeTitles = titleKeys(probe.title_cs, probe.title_en);

  for (const book of books) {
    if (probe.isbn_13 && book.isbn_13 && probe.isbn_13 === book.isbn_13) {
      return book;
    }

    for (const storedKey of titleKeys(book.title_cs, book.title_en)) {
      if (titlesOverlap(probeTitles, storedKey)) return book;
    }
  }

  return null;
}
