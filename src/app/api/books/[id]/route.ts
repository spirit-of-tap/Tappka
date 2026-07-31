import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getBookById } from '@/lib/books/queries';
import { setBookTags } from '@/lib/books/tags';
import type { ClassifyBookInput, SetBookHighlightInput } from '@/lib/books/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const book = await getBookById(supabase, id);
    if (!book) return NextResponse.json({ error: 'Kniha nenalezena' }, { status: 404 });

    return NextResponse.json({ data: book });
  } catch (error) {
    console.error('GET /api/books/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst knihu' }, { status: 500 });
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

    const isCoachOrAdmin = profile.role === 'coach' || profile.role === 'admin';
    if (!isCoachOrAdmin) {
      return NextResponse.json({ error: 'Nemáš oprávnění' }, { status: 403 });
    }

    const body: { action: 'classify' | 'highlight' | 'edit' } & Partial<ClassifyBookInput> & SetBookHighlightInput & {
      title?: string; author?: string; description?: string; tags?: string[];
    } = await request.json();

    const now = new Date().toISOString();

    if (body.action === 'classify') {
      const listStatus = body.list_status;
      if (!listStatus || !['processing', 'shortlist', 'longlist', 'archived'].includes(listStatus)) {
        return NextResponse.json({ error: 'Neplatný seznam' }, { status: 400 });
      }

      if (listStatus === 'archived') {
        if (!body.status_reason?.trim()) {
          return NextResponse.json({ error: 'Důvod archivace je povinný' }, { status: 400 });
        }
      } else {
        const points = body.book_points;
        if (points === undefined || points === null || ![1, 2, 3].includes(points)) {
          return NextResponse.json({ error: 'Neplatný počet bodů (1–3)' }, { status: 400 });
        }
      }

      const { data, error } = await supabase
        .from('books')
        .update({
          list_status: listStatus,
          book_points: listStatus === 'archived' ? 0 : body.book_points,
          list_status_changed_by_profile_id: profile.id,
          list_status_changed_at: now,
          list_status_reason: body.status_reason ?? null,
          updated_by_profile_id: profile.id,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Kniha nenalezena' }, { status: 404 });

      return NextResponse.json({ data });
    }

    if (body.action === 'highlight') {
      if (!body.highlighted && !body.category) {
        return NextResponse.json({ error: 'Chybí kategorie' }, { status: 400 });
      }

      if (body.highlighted) {
        if (!body.category || !['ja', 'my', 'oni', 'system'].includes(body.category)) {
          return NextResponse.json({ error: 'Neplatná kategorie' }, { status: 400 });
        }
        const { data, error } = await supabase
          .from('book_highlights')
          .upsert({
            book_id: id,
            category: body.category,
            description: body.description?.trim() || null,
            created_by_profile_id: profile.id,
            updated_by_profile_id: profile.id,
          }, { onConflict: 'book_id' })
          .select()
          .single();

        if (error) throw error;
        return NextResponse.json({ data });
      }

      const { error } = await supabase
        .from('book_highlights')
        .delete()
        .eq('book_id', id);
      if (error) throw error;
      return NextResponse.json({ data: null });
    }

    if (body.action === 'edit') {
      const updates: Record<string, unknown> = {
        updated_by_profile_id: profile.id,
      };
      if (body.title?.trim()) updates.title_cs = body.title.trim();
      if (body.author?.trim()) updates.author = body.author.trim();
      if (body.description !== undefined) updates.description = body.description?.trim() || null;

      const hasFieldUpdates = body.title?.trim() || body.author?.trim() || body.description !== undefined;
      const hasTagUpdates = body.tags !== undefined;

      if (!hasFieldUpdates && !hasTagUpdates) {
        return NextResponse.json({ error: 'Žádné změny' }, { status: 400 });
      }

      if (hasFieldUpdates) {
        const { error } = await supabase
          .from('books')
          .update(updates)
          .eq('id', id);

        if (error) throw error;
      }

      if (hasTagUpdates) {
        await setBookTags(supabase, id, body.tags ?? [], profile.id);
      }

      const book = await getBookById(supabase, id);
      return NextResponse.json({ data: book });
    }

    return NextResponse.json({ error: 'Neplatná akce' }, { status: 400 });
  } catch (error) {
    console.error('PATCH /api/books/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se aktualizovat knihu' }, { status: 500 });
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

    const isCoachOrAdmin = profile.role === 'coach' || profile.role === 'admin';
    if (!isCoachOrAdmin) {
      return NextResponse.json({ error: 'Nemáš oprávnění' }, { status: 403 });
    }

    const { error } = await supabase.from('books').delete().eq('id', id);
    if (error) throw error;

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('DELETE /api/books/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se smazat knihu' }, { status: 500 });
  }
}
