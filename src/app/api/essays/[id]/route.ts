import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssayById } from '@/lib/essays/queries';
import { contentTextFromJson } from '@/lib/essays/content-text';
import { shouldCoalesceRevision } from '@/lib/essays/revisions';
import { validateEssaySourceIds } from '@/lib/essays/validate-source';
import { serverLogger } from "@/lib/server-logger";

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
    serverLogger.console.error('GET /api/essays/[id] error:', error);
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
    const hasSourceUpdate = 'content_source_id' in body;

    if (!hasContentUpdate && !hasBookUpdate && !hasSourceUpdate) {
      return NextResponse.json({ error: 'Žádné změny' }, { status: 400 });
    }

    if (hasBookUpdate || hasSourceUpdate) {
      const sourceError = validateEssaySourceIds(body.book_id, body.content_source_id);
      if (sourceError) {
        return NextResponse.json({ error: sourceError }, { status: 400 });
      }
    }

    const { data: existing, error: existingError } = await supabase
      .from('essays')
      .select('id, author_profile_id, removed_at, published_at')
      .eq('id', id)
      .eq('author_profile_id', profile.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing || existing.removed_at != null) {
      return NextResponse.json({ error: 'Esej nenalezena nebo nemáš oprávnění' }, { status: 404 });
    }

    const now = new Date().toISOString();
    let revisionNo: number | null = null;
    let revisionUpdatedAt = now;
    // There is no explicit publish step: the essay becomes visible to
    // everyone the moment it first has a title, as a side effect of autosave.
    let shouldAutoPublish = false;

    if (hasContentUpdate) {
      const { data: latest, error: latestError } = await supabase
        .from('essay_revisions')
        .select('revision_no, title, content_json, created_at, created_by_profile_id')
        .eq('essay_id', id)
        .order('revision_no', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError) throw latestError;

      const nextTitle = body.title !== undefined
        ? String(body.title).trim()
        : (latest?.title ?? '');
      const nextContent = body.content_json !== undefined
        ? body.content_json
        : (latest?.content_json ?? {});

      // An essay is allowed to be untitled before it's ever been visible; once
      // it has a title (and so has been auto-published), the title can't be
      // cleared back out.
      if (existing.published_at != null && !nextTitle) {
        return NextResponse.json({ error: 'Název eseje je povinný' }, { status: 400 });
      }
      if (nextTitle.length > MAX_TITLE_LENGTH) {
        return NextResponse.json({ error: 'Název eseje je příliš dlouhý' }, { status: 400 });
      }
      if (existing.published_at == null && nextTitle) {
        shouldAutoPublish = true;
      }

      const plainText = typeof body.content_text === 'string'
        ? body.content_text
        : contentTextFromJson(nextContent);
      if (plainText.length > MAX_CONTENT_TEXT_LENGTH) {
        return NextResponse.json({ error: 'Esej je příliš dlouhá' }, { status: 400 });
      }

      if (shouldCoalesceRevision(latest, profile.id, now)) {
        // `.select()` is load-bearing: an UPDATE that RLS declines affects zero
        // rows and returns no error, so without reading back what changed this
        // route would answer 200 and the editor would show "Uloženo" for work
        // that was never written.
        const { data: coalesced, error: coalesceError } = await supabase
          .from('essay_revisions')
          .update({
            title: nextTitle,
            content_json: nextContent,
            updated_at: now,
            updated_by_profile_id: profile.id,
          })
          .eq('essay_id', id)
          .eq('revision_no', latest!.revision_no)
          .select('revision_no')
          .maybeSingle();

        if (coalesceError) throw coalesceError;
        if (coalesced) revisionNo = coalesced.revision_no;
      }

      // Either coalescing was not appropriate, or it was refused — the author's
      // text still has to land, so cut a new revision instead of losing it.
      if (revisionNo == null) {
        const nextNo = (latest?.revision_no ?? 0) + 1;
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
        revisionNo = nextNo;
      }
      revisionUpdatedAt = now;
    }

    const essayUpdates: {
      updated_by_profile_id: string;
      updated_at: string;
      book_id?: string | null;
      content_source_id?: string | null;
      published_at?: string;
    } = {
      updated_by_profile_id: profile.id,
      updated_at: now,
    };

    if (hasBookUpdate) {
      essayUpdates.book_id = body.book_id ?? null;
    }
    if (hasSourceUpdate) {
      essayUpdates.content_source_id = body.content_source_id ?? null;
    }
    if (shouldAutoPublish) {
      essayUpdates.published_at = now;
    }

    const { error: updateError } = await supabase
      .from('essays')
      .update(essayUpdates)
      .eq('id', id)
      .eq('author_profile_id', profile.id);

    if (updateError) throw updateError;

    return NextResponse.json({ data: { revision_no: revisionNo, updated_at: revisionUpdatedAt } });
  } catch (error) {
    serverLogger.console.error('PATCH /api/essays/[id] error:', error);
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
    serverLogger.console.error('DELETE /api/essays/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se smazat esej' }, { status: 500 });
  }
}
