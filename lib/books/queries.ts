import { SupabaseClient } from '@supabase/supabase-js';
import type {
  Book,
  BookWithProfiles,
  BookCommentWithAuthor,
  BookFilters,
} from './types';

const PAGE_SIZE_DEFAULT = 20;

export async function getBooks(
  supabase: SupabaseClient,
  filters?: BookFilters,
): Promise<BookWithProfiles[]> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? PAGE_SIZE_DEFAULT;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('books')
    .select(`
      *,
      added_by:profiles!added_by_profile_id(id, name, picture),
      approved_by:profiles!approved_by_profile_id(id, name)
    `)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.addedBy) {
    query = query.eq('added_by_profile_id', filters.addedBy);
  }

  if (filters?.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as BookWithProfiles[];
}

export async function getBookById(
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
      result.push({ book_id: row.book_id, book_points: row.books.book_points });
    }
  }

  return result;
}
