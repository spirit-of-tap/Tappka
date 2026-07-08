import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface TeamReadingListBook {
  book_id: string;
  position: number;
  note: string | null;
  book: {
    id: string;
    title: string;
    cover_path: string | null;
    author: string;
  };
}

export interface TeamReadingList {
  id: string;
  team_id: string;
  title: string;
  month: string | null;
  created_by_profile_id: string;
  created_at: string;
  updated_at: string;
  team: { id: string; name: string } | null;
  books: TeamReadingListBook[];
}

export async function getTeamReadingLists(
  supabase: SupabaseClient<Database>,
): Promise<TeamReadingList[]> {
  const { data, error } = await supabase
    .from('team_reading_lists')
    .select(`
      *,
      team:teams!team_id(id, name),
      books:team_reading_list_books(
        book_id,
        position,
        note,
        book:books!book_id(id, title, cover_path, author)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((list) => ({
    ...list,
    books: ((list.books ?? []) as TeamReadingListBook[]).sort(
      (a, b) => a.position - b.position,
    ),
  })) as TeamReadingList[];
}
