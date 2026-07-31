import { tagNamesFromJoin } from './tags';
import type { BookWithProfiles } from './types';

/**
 * Shared join fragment for any query selecting from (or joining to) `books`.
 * Interpolate into a `*, ${BOOK_JOIN_FIELDS}` select — used by both
 * `books/queries.ts` (flat select) and `library/queries.ts` (nested under
 * `book:books!inner(...)`) so the two stay in sync (previously the library
 * copy silently omitted `highlight_category`).
 */
export const BOOK_JOIN_FIELDS = `
  created_by:profiles!created_by_profile_id(id, name, picture),
  list_status_changed_by:profiles!list_status_changed_by_profile_id(id, name),
  highlight_category:highlight_categories(*),
  book_tags(tags(name))
`;

export interface BookQueryRow extends Omit<BookWithProfiles, 'tags' | 'essay_count' | 'highlight_category'> {
  essay_count?: number;
  highlight_category?: BookWithProfiles['highlight_category'] | BookWithProfiles['highlight_category'][];
  book_tags?: { tags: { name: string } | null }[] | null;
}

/**
 * Maps a books query row (selected via `BOOK_JOIN_FIELDS`) to `BookWithProfiles`.
 */
export function mapBookRow(row: BookQueryRow): BookWithProfiles {
  const { book_tags, essay_count, highlight_category, ...rest } = row;

  return {
    ...rest,
    tags: tagNamesFromJoin(book_tags),
    essay_count: essay_count ?? 0,
    highlight_category: Array.isArray(highlight_category)
      ? highlight_category[0] ?? null
      : highlight_category ?? null,
  };
}
