import { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

import { getBookIdsByTagNames } from './tags';
import { BOOK_JOIN_FIELDS, mapBookRow, type BookQueryRow } from './row-mapper';
import { getBookIdsInLibrary } from '@/lib/library/book-ids';
import type {
  HighlightCategory,
  BookWithProfiles,
  BookFilters,
  BookListStatus,
} from './types';
import { POINTS_ELIGIBLE_LIST_STATUSES } from './types';

const PAGE_SIZE_DEFAULT = 20;

const BOOK_PROFILES_SELECT = `*, ${BOOK_JOIN_FIELDS}`;

export async function getBooks(
  supabase: SupabaseClient<Database>,
  filters?: BookFilters,
): Promise<BookWithProfiles[]> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? PAGE_SIZE_DEFAULT;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Use the view when sorting by popularity or filtering by essay count so ORDER BY / WHERE happens in Postgres.
  // The view is a superset of `books` (adds essay_count); supabase-js can't
  // type a table|view union for .from(), so pin to the `books` literal — the
  // result is reshaped to BookWithProfiles below regardless.
  const table = (filters?.sortBy === 'popular' || (filters?.minEssayCount !== undefined && filters.minEssayCount > 0)
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

  if (filters?.minEssayCount !== undefined && filters.minEssayCount > 0) {
    query = query.gte('essay_count', filters.minEssayCount);
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
    query = query.or(
      `title_cs.ilike.%${q}%,title_en.ilike.%${q}%,author.ilike.%${q}%,isbn_13.ilike.%${q}%`,
    );
  }

  if (filters?.tags && filters.tags.length > 0) {
    const bookIds = await getBookIdsByTagNames(supabase, filters.tags);
    if (bookIds.length === 0) return [];
    query = query.in('id', bookIds);
  }

  if (filters?.libraryOnly) {
    const bookIdsWithCopies = [...await getBookIdsInLibrary(supabase)];
    if (bookIdsWithCopies.length === 0) return [];
    query = query.in('id', bookIdsWithCopies);
  }

  if (filters?.isRocketModel) {
    query = query.eq('is_rocket_model', true);
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

export async function getShortlistedBooks(
  supabase: SupabaseClient<Database>,
): Promise<BookWithProfiles[]> {
  // Use the view so essay_count is populated for the list table.
  const { data, error } = await supabase
    .from('books_with_essay_count')
    .select(BOOK_PROFILES_SELECT)
    .eq('list_status', 'shortlist')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as BookQueryRow[]).map(mapBookRow);
}

export async function getLonglistedBooks(
  supabase: SupabaseClient<Database>,
): Promise<BookWithProfiles[]> {
  const { data, error } = await supabase
    .from('books_with_essay_count')
    .select(BOOK_PROFILES_SELECT)
    .eq('list_status', 'longlist')
    .order('updated_at', { ascending: false });

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

  const seen = new Set<string>();
  const result: { book_id: string; book_points: number }[] = [];

  for (const row of (data ?? []) as unknown as Array<{ book_id: string; books: { book_points: number | null; list_status: BookListStatus } }>) {
    if (row.book_id && !seen.has(row.book_id) && POINTS_ELIGIBLE_LIST_STATUSES.includes(row.books.list_status)) {
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
    .select(BOOK_PROFILES_SELECT)
    .not('highlight_category_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as BookQueryRow[]).map(mapBookRow);
}

export async function getRocketModelBooks(
  supabase: SupabaseClient<Database>,
): Promise<BookWithProfiles[]> {
  const { data, error } = await supabase
    .from('books')
    .select(BOOK_PROFILES_SELECT)
    .eq('is_rocket_model', true)
    .in('list_status', POINTS_ELIGIBLE_LIST_STATUSES)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as BookQueryRow[]).map(mapBookRow);
}

export async function getHighlightCategories(
  supabase: SupabaseClient<Database>,
): Promise<HighlightCategory[]> {
  const { data, error } = await supabase
    .from('highlight_categories')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data as HighlightCategory[];
}
