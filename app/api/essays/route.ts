import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssays, getEssaysByTeam } from '@/lib/essays/queries';
import type { EssayListView } from '@/lib/essays/types';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const view = (searchParams.get('view') ?? 'vse') as EssayListView;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
    const teamId = searchParams.get('team_id') ?? undefined;

    if (view === 'moje') {
      const profile = await getCurrentUserProfile(supabase, { user });
      if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });
      const essays = await getEssays(supabase, { authorProfileId: profile.id, page });
      return NextResponse.json({ data: essays });
    }

    if (view === 'tym' && teamId) {
      const essays = await getEssaysByTeam(supabase, teamId, { page });
      return NextResponse.json({ data: essays });
    }

    const essays = await getEssays(supabase, { page });
    return NextResponse.json({ data: essays });
  } catch (error) {
    console.error('GET /api/essays error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst eseje' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const body = await request.json();
    const { title, content_json, content_text, book_id } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Název eseje je povinný' }, { status: 400 });
    }
    if (!content_json) {
      return NextResponse.json({ error: 'Obsah eseje je povinný' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('essays')
      .insert({
        author_profile_id: profile.id,
        title: title.trim(),
        content_json,
        content_text: content_text ?? '',
        book_id: book_id ?? null,
        published: true,
      })
      .select(`
        *,
        author:profiles!author_profile_id(id, name, picture, role),
        book:books!book_id(id, title, author, book_points, status, cover_path)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('POST /api/essays error:', error);
    return NextResponse.json({ error: 'Nepodařilo se uložit esej' }, { status: 500 });
  }
}
