import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssayById } from '@/lib/essays/queries';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const essay = await getEssayById(supabase, id);
    if (!essay) return NextResponse.json({ error: 'Esej nenalezena' }, { status: 404 });

    return NextResponse.json({ data: essay });
  } catch (error) {
    console.error('GET /api/essays/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst esej' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.content_json !== undefined) updates.content_json = body.content_json;
    if (body.content_text !== undefined) updates.content_text = body.content_text;
    if ('book_id' in body) updates.book_id = body.book_id ?? null;

    const { data, error } = await supabase
      .from('essays')
      .update(updates)
      .eq('id', id)
      .eq('author_profile_id', profile.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Esej nenalezena nebo nemáš oprávnění' }, { status: 404 });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('PATCH /api/essays/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se aktualizovat esej' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const isAdmin = profile.role === 'admin';
    let deleteQuery = supabase.from('essays').delete().eq('id', id);

    if (!isAdmin) {
      deleteQuery = deleteQuery.eq('author_profile_id', profile.id);
    }

    const { error } = await deleteQuery;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/essays/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se smazat esej' }, { status: 500 });
  }
}
