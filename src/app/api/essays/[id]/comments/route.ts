import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssayComments } from '@/lib/essays/queries';
import { notifyEssayCommented } from '@/lib/notifications/essay-notifications';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const comments = await getEssayComments(supabase, id);
    return NextResponse.json({ data: comments });
  } catch (error) {
    console.error('GET /api/essays/[id]/comments error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst komentáře' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const payload = (await request.json()) as { body?: unknown; parent_id?: unknown };
    const body = payload.body;
    const parent_id = payload.parent_id;
    if (typeof body !== 'string' || !body.trim()) {
      return NextResponse.json({ error: 'Text komentáře je povinný' }, { status: 400 });
    }

    if (typeof parent_id === 'string' && parent_id.trim()) {
      const { data: parent } = await supabase
        .from('essay_comments')
        .select('id')
        .eq('id', parent_id)
        .eq('essay_id', id)
        .is('removed_at', null)
        .maybeSingle();
      if (!parent) {
        return NextResponse.json({ error: 'Komentář, na který odpovídáte, neexistuje' }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('essay_comments')
      .insert({
        essay_id: id,
        author_profile_id: profile.id,
        parent_id: typeof parent_id === 'string' ? parent_id : null,
        body: body.trim(),
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
      .select(`*, author:profiles!author_profile_id(id, name, picture, role)`)
      .single();

    if (error) throw error;

    after(() => {
      notifyEssayCommented(supabase, {
        essayId: id,
        actorProfileId: profile.id,
        origin: new URL(request.url).origin,
        commentBody: body.trim(),
      }).catch((err) => console.error('notifyEssayCommented failed:', err));
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('POST /api/essays/[id]/comments error:', error);
    return NextResponse.json({ error: 'Nepodařilo se přidat komentář' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Neplatné tělo požadavku' }, { status: 400 });
    }
    const { comment_id, body } = (payload ?? {}) as { comment_id?: unknown; body?: unknown };
    if (typeof comment_id !== 'string' || !comment_id.trim()) {
      return NextResponse.json({ error: 'Neplatné ID komentáře' }, { status: 400 });
    }
    if (typeof body !== 'string' || !body.trim()) {
      return NextResponse.json({ error: 'Text komentáře je povinný' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { data, error } = await supabase
      .from('essay_comments')
      .update({ body: body.trim(), updated_by_profile_id: profile.id, updated_at: new Date().toISOString() })
      .eq('id', comment_id)
      .eq('essay_id', id)
      .is('removed_at', null)
      .select(`*, author:profiles!author_profile_id(id, name, picture, role)`)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Komentář nebyl nalezen nebo nemáte oprávnění' }, { status: 404 });
      }
      throw error;
    }
    return NextResponse.json({ data });
  } catch (error) {
    console.error('PATCH /api/essays/[id]/comments error:', error);
    return NextResponse.json({ error: 'Nepodařilo se upravit komentář' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Neplatné tělo požadavku' }, { status: 400 });
    }
    const { comment_id } = (payload ?? {}) as { comment_id?: unknown };
    if (typeof comment_id !== 'string' || !comment_id.trim()) {
      return NextResponse.json({ error: 'Neplatné ID komentáře' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { data, error } = await supabase
      .from('essay_comments')
      .update({
        removed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by_profile_id: profile.id,
      })
      .eq('id', comment_id)
      .eq('essay_id', id)
      .is('removed_at', null)
      .select(`*, author:profiles!author_profile_id(id, name, picture, role)`)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Komentář nebyl nalezen nebo nemáte oprávnění' }, { status: 404 });
      }
      throw error;
    }
    return NextResponse.json({ data });
  } catch (error) {
    console.error('DELETE /api/essays/[id]/comments error:', error);
    return NextResponse.json({ error: 'Nepodařilo se smazat komentář' }, { status: 500 });
  }
}
