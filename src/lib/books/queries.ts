import { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

import { getBookIdsByTagNames, tagNamesFromJoin } from './tags';
import type {
  Book,
  BookHighlight,
  BookWithProfiles,
  BookFilters,
} from './types';

const PAGE_SIZE_DEFAULT = 20;

const BOOK_PROFILES_SELECT = `
  *,
  created_by:profiles!created_by_profile_id(id, name, picture),
  list_status_changed_by:profiles!list_status_changed_by_profile_id(id, name),
  highlight:book_highlights(*),
  book_tags(tags(name))
`;

interface BookQueryRow extends Omit<BookWithProfiles, 'tags' | 'essay_count' | 'highlight'> {
  essay_count?: number;
  highlight?: BookWithProfiles['highlight'] | BookWithProfiles['highlight'][];
  book_tags?: { tags: { name: string } | null }[] | null;
}

/**
 * Maps a books query row (with optional book_tags join) to BookWithProfiles.
 */
function mapBookRow(row: BookQueryRow): BookWithProfiles {
  const { book_tags, essay_count, highlight, ...rest } = row;

  return {
    ...rest,
    tags: tagNamesFromJoin(book_tags),
    essay_count: essay_count ?? 0,
    highlight: Array.isArray(highlight) ? highlight[0] ?? null : highlight ?? null,
  };
}

export async function getBooks(
  supabase: SupabaseClient<Database>,
  filters?: BookFilters,
): Promise<BookWithProfiles[]> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? PAGE_SIZE_DEFAULT;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Use the view when sorting by popularity so ORDER BY happens in Postgres.
  // The view is a superset of `books` (adds essay_count); supabase-js can't
  // type a table|view union for .from(), so pin to the `books` literal — the
  // result is reshaped to BookWithProfiles below regardless.
  const table = (filters?.sortBy === 'popular'
    ? 'books_with_essay_count'
    : 'books') as 'books';

  let query = supabase
    .from(table)
    .select(BOOK_PROFILES_SELECT)
    .range(from, to);

  if (filters?.sortBy === 'popular') {
    query = query.order('essay_count', { ascending: false }).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  if (filters?.listStatuses) {
    query = query.in('list_status', filters.listStatuses);
  } else if (filters?.listStatus) {
    query = query.eq('list_status', filters.listStatus);
  }

  if (filters?.createdBy) {
    query = query.eq('created_by_profile_id', filters.createdBy);
  }

  if (filters?.search?.trim()) {
    const q = filters.search.trim();
    query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%`);
  }

  if (filters?.tags && filters.tags.length > 0) {
    const bookIds = await getBookIdsByTagNames(supabase, filters.tags);
    if (bookIds.length === 0) return [];
    query = query.in('id', bookIds);
  }

  if (filters?.libraryOnly) {
    const { data: libraryBookIds, error: libError } = await supabase
      .from('library_books')
      .select('book_id');

    if (libError) throw libError;

    const bookIdsWithCopies = [...new Set(libraryBookIds?.map((lb: { book_id: string }) => lb.book_id) ?? [])];

    if (bookIdsWithCopies.length === 0) return [];
    query = query.in('id', bookIdsWithCopies);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as unknown as BookQueryRow[]).map(mapBookRow);
}

export async function getBookById(
  supabase: SupabaseClient<Database>,
  bookId: string,
): Promise<BookWithProfiles | null> {
  const { data, error } = await supabase
    .from('books')
    .select(BOOK_PROFILES_SELECT)
    .eq('id', bookId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapBookRow(data as unknown as BookQueryRow);
}

export async function getProcessingBooks(
  supabase: SupabaseClient<Database>,
): Promise<BookWithProfiles[]> {
  const { data, error } = await supabase
    .from('books')
    .select(BOOK_PROFILES_SELECT)
    .eq('list_status', 'processing')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as unknown as BookQueryRow[]).map(mapBookRow);
}

export async function getArchivedBooks(
  supabase: SupabaseClient<Database>,
): Promise<BookWithProfiles[]> {
  const { data, error } = await supabase
    .from('books')
    .select(BOOK_PROFILES_SELECT)
    .eq('list_status', 'archived')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as BookQueryRow[]).map(mapBookRow);
}

export async function searchBooksLocally(
  supabase: SupabaseClient<Database>,
  query: string,
  limit = 10,
): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .or(`title_cs.ilike.%${query}%,title_en.ilike.%${query}%,author.ilike.%${query}%`)
    .limit(limit);

  if (error) throw error;
  return data as Book[];
}

export async function getBooksByProfilePoints(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<{ book_id: string; book_points: number }[]> {
  const { data, error } = await supabase
    .from('essays')
    .select('book_id, books!inner(book_points, list_status)')
    .eq('author_profile_id', profileId)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('book_id', 'is', null);

  if (error) throw error;

  const ELIGIBLE: string[] = ['shortlist', 'longlist'];
  const seen = new Set<string>();
  const result: { book_id: string; book_points: number }[] = [];

  for (const row of (data ?? []) as unknown as Array<{ book_id: string; books: { book_points: number | null; list_status: string } }>) {
    if (row.book_id && !seen.has(row.book_id) && ELIGIBLE.includes(row.books.list_status)) {
      seen.add(row.book_id);
      result.push({ book_id: row.book_id, book_points: Number(row.books.book_points ?? 0) });
    }
  }

  return result;
}

export async function getHighlightedBooks(
  supabase: SupabaseClient<Database>,
): Promise<BookWithProfiles[]> {
  const { data, error } = await supabase
    .from('books')
    .select(`${BOOK_PROFILES_SELECT}, book_highlights!inner(*)`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as (BookQueryRow & { book_highlights: BookWithProfiles['highlight'][] })[];

  return rows.map((row) => {
    const { book_highlights, ...rest } = row;
    return {
      ...mapBookRow(rest),
      highlight: Array.isArray(book_highlights) ? book_highlights[0] ?? null : book_highlights,
    };
  });
}

export async function getBookHighlight(
  supabase: SupabaseClient<Database>,
  bookId: string,
): Promise<BookHighlight | null> {
  const { data, error } = await supabase
    .from('book_highlights')
    .select('*')
    .eq('book_id', bookId)
    .maybeSingle();

  if (error) throw error;
  return data as BookHighlight | null;
}
