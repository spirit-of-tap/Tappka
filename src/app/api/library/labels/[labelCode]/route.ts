import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { parseLibraryLabelCode } from '@/lib/library/label-code';
import { createClient } from '@/lib/supabase/server';
import type { Insertable, Updatable } from '@/lib/supabase/tables';
import { serverLogger } from "@/lib/server-logger";

interface RouteContext {
  params: Promise<{ labelCode: string }>;
}

interface BookSummary {
  id: string;
  title_cs: string;
  author: string;
  google_books_cover_url: string | null;
}

async function getAuthorizedContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Neautorizováno' }, { status: 401 }) };

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
    return { error: NextResponse.json({ error: 'Nemáš oprávnění' }, { status: 403 }) };
  }

  return { supabase, profile };
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { labelCode: rawLabelCode } = await params;
    const labelCode = parseLibraryLabelCode(rawLabelCode);
    if (labelCode == null) {
      return NextResponse.json({ error: 'Neplatný kód štítku' }, { status: 400 });
    }

    const context = await getAuthorizedContext();
    if ('error' in context) return context.error;

    const { data, error } = await context.supabase
      .from('library_books')
      .select('id, book_id, book:books!inner(id, title_cs, author, google_books_cover_url)')
      .filter('label_code', 'eq', String(labelCode))
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Štítek zatím není přiřazený' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: data.id,
        book_id: data.book_id,
        label_code: labelCode,
        book: data.book as BookSummary,
      },
    });
  } catch (error) {
    serverLogger.console.error('GET /api/library/labels/[labelCode] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst štítek' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { labelCode: rawLabelCode } = await params;
    const labelCode = parseLibraryLabelCode(rawLabelCode);
    if (labelCode == null) {
      return NextResponse.json({ error: 'Neplatný kód štítku' }, { status: 400 });
    }

    const context = await getAuthorizedContext();
    if ('error' in context) return context.error;

    const body: { book_id?: unknown } = await request.json();
    const bookId = typeof body.book_id === 'string' ? body.book_id.trim() : '';
    if (!bookId) {
      return NextResponse.json({ error: 'Kniha je povinná' }, { status: 400 });
    }

    const [{ data: existingLabel, error: labelError }, { data: book, error: bookError }] = await Promise.all([
      context.supabase
        .from('library_books')
        .select('id, book_id')
        .filter('label_code', 'eq', String(labelCode))
        .maybeSingle(),
      context.supabase
        .from('books')
        .select('id, title_cs, author, google_books_cover_url')
        .eq('id', bookId)
        .maybeSingle(),
    ]);

    if (labelError) throw labelError;
    if (bookError) throw bookError;
    if (existingLabel) {
      return NextResponse.json(
        { error: 'Štítek už je přiřazený', data: existingLabel },
        { status: 409 },
      );
    }
    if (!book) {
      return NextResponse.json({ error: 'Kniha nebyla nalezena' }, { status: 404 });
    }

    const { data: unlabelledCopy, error: copyError } = await context.supabase
      .from('library_books')
      .select('id')
      .eq('book_id', bookId)
      .filter('label_code', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (copyError) throw copyError;

    const now = new Date().toISOString();
    let libraryBookId: string;
    let reusedExistingCopy = false;

    if (unlabelledCopy) {
      const updateValues: Updatable<'library_books'> & { label_code: number } = {
        label_code: labelCode,
        updated_at: now,
        updated_by_profile_id: context.profile.id,
      };
      const { data: updated, error: updateError } = await context.supabase
        .from('library_books')
        .update(updateValues)
        .eq('id', unlabelledCopy.id)
        .select('id')
        .single();

      if (updateError) throw updateError;
      libraryBookId = updated.id;
      reusedExistingCopy = true;
    } else {
      const insertValues: Insertable<'library_books'> & { label_code: number } = {
        book_id: bookId,
        label_code: labelCode,
        created_by_profile_id: context.profile.id,
        updated_by_profile_id: context.profile.id,
      };
      const { data: inserted, error: insertError } = await context.supabase
        .from('library_books')
        .insert(insertValues)
        .select('id')
        .single();

      if (insertError) throw insertError;
      libraryBookId = inserted.id;
    }

    return NextResponse.json({
      data: {
        id: libraryBookId,
        book_id: bookId,
        label_code: labelCode,
        reused_existing_copy: reusedExistingCopy,
        book,
      },
    }, { status: 201 });
  } catch (error) {
    const errorCode = typeof error === 'object' && error && 'code' in error
      ? String(error.code)
      : null;
    if (errorCode === '23505') {
      return NextResponse.json({ error: 'Štítek už je přiřazený' }, { status: 409 });
    }

    serverLogger.console.error('POST /api/library/labels/[labelCode] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se přiřadit štítek' }, { status: 500 });
  }
}
