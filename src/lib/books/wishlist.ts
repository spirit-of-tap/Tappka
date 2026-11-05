import { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

import { BOOK_JOIN_FIELDS, mapBookRow, type BookQueryRow } from './row-mapper';
import type { BookWithProfiles } from './types';

const WISHLIST_BOOK_SELECT = `
  book:books!inner(
    *,
    ${BOOK_JOIN_FIELDS}
  )
`;

/**
 * The viewer's personal "Chci si přečíst" shelf, newest first.
 *
 * Returns the same `BookWithProfiles` shape as the rest of the catalogue so
 * the UI can reuse book rows/cards without a second mapper.
 */
export async function getMyWishlist(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<BookWithProfiles[]> {
  const { data, error } = await supabase
    .from('book_wishlist')
    .select(WISHLIST_BOOK_SELECT)
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as Array<{ book: BookQueryRow | null }>)
    .map((row) => row.book)
    .filter((book): book is BookQueryRow => book !== null)
    .map(mapBookRow);
}

/**
 * Book IDs on the viewer's shelf. The /cteni layout runs this once per page
 * and exposes the set through WishlistProvider, so cards don't issue a
 * request each.
 */
export async function getMyWishlistBookIds(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('book_wishlist')
    .select('book_id')
    .eq('profile_id', profileId);

  if (error) throw error;

  return new Set((data ?? []).map((row) => row.book_id));
}
