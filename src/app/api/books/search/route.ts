import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { searchBooksLocally } from '@/lib/books/queries';
import type { Database } from '@/lib/supabase/database.types';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    if (!q) return NextResponse.json({ data: [] });

    const results = await searchBooksLocally(supabase, q);

    const enriched = await enrichWithLibraryInfo(supabase, results);

    return NextResponse.json({ data: enriched });
  } catch (error) {
    console.error('GET /api/books/search error:', error);
    return NextResponse.json({ error: 'Hledání selhalo' }, { status: 500 });
  }
}

async function enrichWithLibraryInfo(
  supabase: SupabaseClient<Database>,
  books: Awaited<ReturnType<typeof searchBooksLocally>>,
) {
  if (books.length === 0) return [];

  const { data: libraryBooks } = await supabase
    .from('library_books')
    .select('book_id')
    .in('book_id', books.map((b) => b.id));

  const inLibrary = new Set(libraryBooks?.map((lb: { book_id: string }) => lb.book_id) ?? []);

  return books.map((book) => ({
    ...book,
    in_library: inLibrary.has(book.id),
  }));
}
