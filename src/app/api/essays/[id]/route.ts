import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssayById } from '@/lib/essays/queries';
import { contentTextFromJson } from '@/lib/essays/content-text';

const MAX_TITLE_LENGTH = 500;
const MAX_CONTENT_TEXT_LENGTH = 100_000;

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
    const hasContentUpdate =
      body.title !== undefined || body.content_json !== undefined;
    const hasBookUpdate = 'book_id' in body;

    if (!hasContentUpdate && !hasBookUpdate) {
      return NextResponse.json({ error: 'Žádné změny' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from('essays')
      .select('id, author_profile_id, removed_at')
      .eq('id', id)
      .eq('author_profile_id', profile.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing || existing.removed_at != null) {
      return NextResponse.json({ error: 'Esej nenalezena nebo nemáš oprávnění' }, { status: 404 });
    }

    if (hasContentUpdate) {
      const [{ data: maxRow, error: maxError }, { data: latestRows, error: latestError }] =
        await Promise.all([
          supabase
            .from('essay_revisions')
            .select('revision_no')
            .eq('essay_id', id)
            .order('revision_no', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('essay_revisions')
            .select('title, content_json, revision_no, invalid_since')
            .eq('essay_id', id)
            .is('invalid_since', null)
            .order('revision_no', { ascending: false })
            .limit(1),
        ]);

      if (maxError) throw maxError;
      if (latestError) throw latestError;

      const latest = latestRows?.[0];
      const nextNo = (maxRow?.revision_no ?? 0) + 1;

      const nextTitle = body.title !== undefined
        ? String(body.title).trim()
        : (latest?.title ?? '');
      const nextContent = body.content_json !== undefined
        ? body.content_json
        : (latest?.content_json ?? {});

      if (!nextTitle) {
        return NextResponse.json({ error: 'Název eseje je povinný' }, { status: 400 });
      }
      if (nextTitle.length > MAX_TITLE_LENGTH) {
        return NextResponse.json({ error: 'Název eseje je příliš dlouhý' }, { status: 400 });
      }

      const plainText = typeof body.content_text === 'string'
        ? body.content_text
        : contentTextFromJson(nextContent);
      if (plainText.length > MAX_CONTENT_TEXT_LENGTH) {
        return NextResponse.json({ error: 'Esej je příliš dlouhá' }, { status: 400 });
      }

      const { error: insertRevError } = await supabase
        .from('essay_revisions')
        .insert({
          essay_id: id,
          revision_no: nextNo,
          title: nextTitle,
          content_json: nextContent,
          created_by_profile_id: profile.id,
          updated_by_profile_id: profile.id,
        });

      if (insertRevError) throw insertRevError;
    }

    const essayUpdates: {
      updated_by_profile_id: string;
      updated_at: string;
      book_id?: string | null;
    } = {
      updated_by_profile_id: profile.id,
      updated_at: new Date().toISOString(),
    };

    if (hasBookUpdate) {
      essayUpdates.book_id = body.book_id ?? null;
    }

    const { error: updateError } = await supabase
      .from('essays')
      .update(essayUpdates)
      .eq('id', id)
      .eq('author_profile_id', profile.id);

    if (updateError) throw updateError;

    const essay = await getEssayById(supabase, id);
    return NextResponse.json({ data: essay });
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
    const now = new Date().toISOString();

    // Soft-delete for authors (UPDATE). Admins removing others' essays must hard-delete
    // because essays UPDATE RLS is author-only; DELETE allows admins.
    if (isAdmin) {
      const { data: existing } = await supabase
        .from('essays')
        .select('author_profile_id, removed_at')
        .eq('id', id)
        .maybeSingle();

      if (!existing || existing.removed_at != null) {
        return NextResponse.json({ error: 'Esej nenalezena nebo nemáš oprávnění' }, { status: 404 });
      }

      if (existing.author_profile_id === profile.id) {
        const { error } = await supabase
          .from('essays')
          .update({
            removed_at: now,
            updated_by_profile_id: profile.id,
            updated_at: now,
          })
          .eq('id', id)
          .eq('author_profile_id', profile.id);

        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      const { error } = await supabase.from('essays').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    const { data, error } = await supabase
      .from('essays')
      .update({
        removed_at: now,
        updated_by_profile_id: profile.id,
        updated_at: now,
      })
      .eq('id', id)
      .eq('author_profile_id', profile.id)
      .is('removed_at', null)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Esej nenalezena nebo nemáš oprávnění' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/essays/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se smazat esej' }, { status: 500 });
  }
}
