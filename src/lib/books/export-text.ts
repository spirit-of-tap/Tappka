import { formatPoints, pointsLabel } from './points';
import { pluralizeCz } from '@/lib/utils/pluralize-cz';
import type { BookWithProfiles } from './types';

export interface ExportCategory {
  key: string;
  label: string;
}

export type ExportableBook = Pick<BookWithProfiles, 'title_cs' | 'author' | 'tags'> & {
  book_points: number | string | null;
  essay_count: number | null;
};

const UNFILED_LABEL = 'Ostatní';

function compareTitles(a: ExportableBook, b: ExportableBook): number {
  return a.title_cs.localeCompare(b.title_cs, 'cs');
}

function bookStatsSuffix(book: ExportableBook): string {
  const parts: string[] = [];
  if (book.book_points != null) {
    parts.push(`${formatPoints(book.book_points)} ${pointsLabel(book.book_points)}`);
  }
  parts.push(`${book.essay_count ?? 0} ${pluralizeCz(book.essay_count ?? 0, ['esej', 'eseje', 'esejí'])}`);
  return ` (${parts.join(', ')})`;
}

/**
 * Plain-text list of verified books grouped by category, ready for the
 * clipboard (e.g. pasting into an AI chat). Each line carries the book's
 * point value and essay count. Books appear under their first matching
 * category so multi-tagged books aren't duplicated; books without a known
 * category tag land in a trailing "Ostatní" group.
 */
export function formatVerifiedBooksForClipboard(
  books: ExportableBook[],
  categories: ExportCategory[],
): string {
  const lines: string[] = [`Ověřené knihy (${books.length})`];
  const assigned = new Set<ExportableBook>();

  for (const category of categories) {
    const inCategory = books
      .filter((book) => !assigned.has(book) && (book.tags ?? []).includes(category.key))
      .sort(compareTitles);
    if (inCategory.length === 0) continue;
    lines.push('', category.label);
    for (const book of inCategory) {
      assigned.add(book);
      lines.push(`- ${book.title_cs} – ${book.author}${bookStatsSuffix(book)}`);
    }
  }

  const unfiled = books.filter((book) => !assigned.has(book)).sort(compareTitles);
  if (unfiled.length > 0) {
    lines.push('', UNFILED_LABEL);
    for (const book of unfiled) {
      lines.push(`- ${book.title_cs} – ${book.author}${bookStatsSuffix(book)}`);
    }
  }

  return lines.join('\n');
}
