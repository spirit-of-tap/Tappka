import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getBooks } from '@/lib/books/queries';
import { setBookTags } from '@/lib/books/tags';
import { downloadAndStoreCover } from '@/lib/storage/service';
import type { CreateBookInput, BookFilters, BookStatus } from '@/lib/books/types';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tags = searchParams.getAll('tag');
    const filters: BookFilters = {
      status: (searchParams.get('status') ?? 'approved') as BookStatus,
      search: searchParams.get('q') ?? undefined,
      tags: tags.length ? tags : undefined,
      sortBy: (searchParams.get('sort') === 'popular' ? 'popular' : undefined),
      createdBy: searchParams.get('created_by') ?? searchParams.get('added_by') ?? undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      pageSize: searchParams.get('page_size') ? Number(searchParams.get('page_size')) : undefined,
    };

    const books = await getBooks(supabase, filters);
    return NextResponse.json({ data: books });
  } catch (error) {
    console.error('GET /api/books error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst knihy' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const body: CreateBookInput & { cover_url?: string } = await request.json();

    if (!body.title?.trim() || !body.author?.trim()) {
      return NextResponse.json({ error: 'Název a autor jsou povinné' }, { status: 400 });
    }

    // Duplicate check: same ISBN, or same title+author (case-insensitive)
    const { data: existing } = await supabase
      .from('books')
      .select('id, title, author')
      .or(
        body.isbn_13
          ? `isbn_13.eq.${body.isbn_13},and(title.ilike.${body.title.trim()},author.ilike.${body.author.trim()})`
          : `and(title.ilike.${body.title.trim()},author.ilike.${body.author.trim()})`
      )
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Tato kniha již existuje v katalogu', existingId: existing.id }, { status: 409 });
    }

    const cleanTags = (body.tags ?? []).filter((t) => t.trim().length > 0);

    const { data: inserted, error: insertError } = await supabase
      .from('books')
      .insert({
        title: body.title.trim(),
        author: body.author.trim(),
        isbn_13: body.isbn_13 ?? null,
        description: body.description ?? null,
        source: body.source ?? 'manual',
        external_id: body.external_id ?? null,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    let coverUrl: string | null = body.supabase_cover_img_url ?? null;
    if (!coverUrl && body.cover_url) {
      coverUrl = await downloadAndStoreCover(body.cover_url, inserted.id);
    }

    if (coverUrl) {
      await supabase
        .from('books')
        .update({
          supabase_cover_img_url: coverUrl,
          updated_by_profile_id: profile.id,
        })
        .eq('id', inserted.id);
    }

    if (cleanTags.length > 0) {
      await setBookTags(supabase, inserted.id, cleanTags, profile.id);
    }

    return NextResponse.json(
      { data: { ...inserted, supabase_cover_img_url: coverUrl, tags: cleanTags } },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/books error:', error);
    return NextResponse.json({ error: 'Nepodařilo se přidat knihu' }, { status: 500 });
  }
}
