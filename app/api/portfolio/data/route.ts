import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

  const { data, error } = await supabase
    .from('essays')
    .select(`
      id,
      title,
      book:books!book_id(id, title, author, book_points, tags, source)
    `)
    .eq('author_profile_id', profile.id)
    .eq('published', true)
    .not('book_id', 'is', null)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []).map((essay, i) => {
    const book = (Array.isArray(essay.book) ? essay.book[0] : essay.book) as { id: string; title: string; author: string; book_points: number; tags: string[]; source: string } | null;
    const firstTag = book?.tags?.[0] ?? '';
    const category = BOOK_CATEGORY_LABELS[firstTag] ?? firstTag;

    return {
      index: i + 1,
      bookTitle: book?.title ?? '',
      author: book?.author ?? '',
      essayId: essay.id as string,
      essayTitle: essay.title as string,
      category,
      source: 'Kniha',
      points: book?.book_points ?? 0,
    };
  });

  return NextResponse.json({ rows });
}
