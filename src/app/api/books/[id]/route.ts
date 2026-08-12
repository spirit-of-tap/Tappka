import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getBookById } from '@/lib/books/queries';
import { setBookTags } from '@/lib/books/tags';
import { notifyBookDecided } from '@/lib/notifications/book-notifications';
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

    const body: { action: 'classify' | 'highlight' | 'unhighlight' | 'edit' | 'points' | 'replace-record' } & Partial<ClassifyBookInput> & SetBookHighlightInput & {
      title?: string; author?: string; description?: string; tags?: string[]; is_rocket_model?: boolean;
      cover_url?: string | null; isbn_13?: string | null; external_id?: string | null; source?: string;
    } = await request.json();

    const now = new Date().toISOString();

    if (body.action === 'classify') {
      const listStatus = body.list_status;
      if (!listStatus || !['processing', 'shortlist', 'longlist', 'archived'].includes(listStatus)) {
        return NextResponse.json({ error: 'Neplatný seznam' }, { status: 400 });
      }

      const { data: current, error: currentError } = await supabase
        .from('books')
        .select('list_status, list_status_reason')
        .eq('id', id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) return NextResponse.json({ error: 'Kniha nenalezena' }, { status: 404 });

      // New books (processing) and archived books must always carry a reason.
      const needsReason = current.list_status === 'processing' || listStatus === 'archived';
      if (needsReason && !body.status_reason?.trim()) {
        return NextResponse.json({ error: 'Důvod zařazení je povinný' }, { status: 400 });
      }

      if (listStatus !== 'archived') {
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
          list_status_reason: body.status_reason?.trim() || current.list_status_reason || null,
          updated_by_profile_id: profile.id,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Kniha nenalezena' }, { status: 404 });

      // A failed email must never fail the decision.
      try {
        await notifyBookDecided(supabase, {
          bookId: id,
          origin: new URL(request.url).origin,
        });
      } catch (notifyError) {
        console.error('notifyBookDecided failed:', notifyError);
      }

      return NextResponse.json({ data });
    }

    if (body.action === 'highlight') {
      if (!body.highlight_category_id) {
        return NextResponse.json({ error: 'Chybí kategorie' }, { status: 400 });
      }

      const { data: category, error: categoryError } = await supabase
        .from('highlight_categories')
        .select('id')
        .eq('id', body.highlight_category_id)
        .maybeSingle();

      if (categoryError) throw categoryError;
      if (!category) return NextResponse.json({ error: 'Kategorie nenalezena' }, { status: 404 });

      const { data, error } = await supabase
        .from('books')
        .update({
          highlight_category_id: body.highlight_category_id,
          updated_by_profile_id: profile.id,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Kniha nenalezena' }, { status: 404 });

      return NextResponse.json({ data });
    }

    if (body.action === 'unhighlight') {
      const { data, error } = await supabase
        .from('books')
        .update({
          highlight_category_id: null,
          updated_by_profile_id: profile.id,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Kniha nenalezena' }, { status: 404 });

      return NextResponse.json({ data });
    }

    if (body.action === 'edit') {
      const updates: Record<string, unknown> = {
        updated_by_profile_id: profile.id,
      };
      if (body.title?.trim()) updates.title_cs = body.title.trim();
      if (body.author?.trim()) updates.author = body.author.trim();
      if (body.description !== undefined) updates.description = body.description?.trim() || null;
      if (body.is_rocket_model !== undefined) updates.is_rocket_model = body.is_rocket_model;

      const hasFieldUpdates = body.title?.trim() || body.author?.trim() || body.description !== undefined || body.is_rocket_model !== undefined;
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

    if (body.action === 'replace-record') {
      const source = body.source;
      if (source !== 'google_books' && source !== 'open_library') {
        return NextResponse.json({ error: 'Neplatný zdroj záznamu' }, { status: 400 });
      }
      if (!body.external_id?.trim()) {
        return NextResponse.json({ error: 'Chybí identifikátor záznamu' }, { status: 400 });
      }

      const coverUrl = body.cover_url?.trim() ? body.cover_url.trim().replace(/^http:\/\//, 'https://') : null;
      const isbn = body.isbn_13?.trim() || null;

      // The table has no UNIQUE constraint on isbn_13 (an ISBN identifies an
      // edition, not a work), so the duplicate guard is app-level.
      // PostgREST rejects `eq.` with an empty value, so the ISBN clause is only
      // included when the record actually carries an ISBN.
      const duplicateFilters = isbn
        ? `isbn_13.eq.${isbn},and(source.eq.${source},external_id.eq.${body.external_id})`
        : `and(source.eq.${source},external_id.eq.${body.external_id})`;
      const { data: existing, error: existingError } = await supabase
        .from('books')
        .select('id')
        .or(duplicateFilters)
        .neq('id', id)
        .limit(1);
      if (existingError) throw existingError;
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: 'Tento záznam už má jiná kniha' }, { status: 409 });
      }

      const { error } = await supabase
        .from('books')
        .update({
          google_books_cover_url: coverUrl,
          isbn_13: isbn,
          external_id: body.external_id,
          source,
          updated_by_profile_id: profile.id,
        })
        .eq('id', id);
      if (error) throw error;

      const book = await getBookById(supabase, id);
      return NextResponse.json({ data: book });
    }

    if (body.action === 'points') {
      const points = body.book_points;
      if (points === undefined || points === null || ![1, 2, 3].includes(points)) {
        return NextResponse.json({ error: 'Neplatný počet bodů (1–3)' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('books')
        .update({
          book_points: points,
          updated_by_profile_id: profile.id,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Kniha nenalezena' }, { status: 404 });

      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: 'Neplatná akce' }, { status: 400 });
  } catch (error) {
    console.error('PATCH /api/books/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se aktualizovat knihu' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
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

    const body: { reroute_to_book_id?: string } = await request.json().catch(() => ({}));

    if (body.reroute_to_book_id) {
      if (body.reroute_to_book_id === id) {
        return NextResponse.json({ error: 'Nelze přesměrovat eseje na stejnou knihu' }, { status: 400 });
      }

      const { data: target, error: targetError } = await supabase
        .from('books')
        .select('id')
        .eq('id', body.reroute_to_book_id)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!target) return NextResponse.json({ error: 'Cílová kniha nenalezena' }, { status: 404 });

      const { error: rerouteError } = await supabase.rpc('reassign_essays_to_book', {
        p_source_book_id: id,
        p_target_book_id: body.reroute_to_book_id,
        p_updated_by_profile_id: profile.id,
      });
      if (rerouteError) throw rerouteError;
    }

    const { error } = await supabase.from('books').delete().eq('id', id);
    if (error) throw error;

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('DELETE /api/books/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se smazat knihu' }, { status: 500 });
  }
}
