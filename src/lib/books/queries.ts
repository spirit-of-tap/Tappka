import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type {
  Book,
  BookWithProfiles,
  BookCommentWithAuthor,
  BookFilters,
} from './types';

const PAGE_SIZE_DEFAULT = 20;

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
    .select(`
      *,
      added_by:profiles!added_by_profile_id(id, name, picture),
      approved_by:profiles!approved_by_profile_id(id, name)
    `)
    .range(from, to);

  if (filters?.sortBy === 'popular') {
    query = query.order('essay_count', { ascending: false }).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.addedBy) {
    query = query.eq('added_by_profile_id', filters.addedBy);
  }

  if (filters?.search?.trim()) {
    const q = filters.search.trim();
    query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%`);
  }

  if (filters?.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as BookWithProfiles[]).map((b) => ({
    ...b,
    essay_count: (b as BookWithProfiles & { essay_count?: number }).essay_count ?? 0,
  }));
}

export async function getBookById(
  supabase: SupabaseClient<Database>,
  bookId: string,
): Promise<BookWithProfiles | null> {
  const { data, error } = await supabase
    .from('books')
    .select(`
      *,
      added_by:profiles!added_by_profile_id(id, name, picture),
      approved_by:profiles!approved_by_profile_id(id, name)
    `)
    .eq('id', bookId)
    .maybeSingle();

  if (error) throw error;
  return data as BookWithProfiles | null;
}

export async function getBookComments(
  supabase: SupabaseClient<Database>,
  bookId: string,
): Promise<BookCommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('book_comments')
    .select(`
      *,
      author:profiles!author_profile_id(id, name, picture, role)
    `)
    .eq('book_id', bookId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as BookCommentWithAuthor[];
}

export async function getPendingBooks(
  supabase: SupabaseClient<Database>,
): Promise<BookWithProfiles[]> {
  const { data, error } = await supabase
    .from('books')
    .select(`
      *,
      added_by:profiles!added_by_profile_id(id, name, picture),
      approved_by:profiles!approved_by_profile_id(id, name)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as BookWithProfiles[];
}

export async function getRejectedBooks(
  supabase: SupabaseClient<Database>,
): Promise<BookWithProfiles[]> {
  const { data, error } = await supabase
    .from('books')
    .select(`
      *,
      added_by:profiles!added_by_profile_id(id, name, picture),
      approved_by:profiles!approved_by_profile_id(id, name)
    `)
    .eq('status', 'rejected')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data as BookWithProfiles[];
}

export async function searchBooksLocally(
  supabase: SupabaseClient<Database>,
  query: string,
  limit = 10,
): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .or(`title.ilike.%${query}%,author.ilike.%${query}%`)
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
    .select('book_id, books!inner(book_points, status)')
    .eq('author_profile_id', profileId)
    .not('book_id', 'is', null);

  if (error) throw error;

  const seen = new Set<string>();
  const result: { book_id: string; book_points: number }[] = [];

  for (const row of (data ?? []) as unknown as Array<{ book_id: string; books: { book_points: number; status: string } }>) {
    if (row.book_id && !seen.has(row.book_id) && row.books.status === 'approved') {
      seen.add(row.book_id);
      result.push({ book_id: row.book_id, book_points: Number(row.books.book_points) });
    }
  }

  return result;
}
