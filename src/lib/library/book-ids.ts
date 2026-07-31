import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Book ids that have at least one TAP Knihovna copy (existence only, not
 * availability — see `getBookLibraryInfo`/`getBooksWithLibraryInfo` for that).
 */
export async function getBookIdsInLibrary(
  supabase: SupabaseClient<Database>,
  bookIds?: string[],
): Promise<Set<string>> {
  let query = supabase.from('library_books').select('book_id');
  if (bookIds) {
    if (bookIds.length === 0) return new Set();
    query = query.in('book_id', bookIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  return new Set((data ?? []).map((row: { book_id: string }) => row.book_id));
}
