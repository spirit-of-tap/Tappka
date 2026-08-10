import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { findDuplicate } from '@/lib/books/dedupe';
import { getBooks } from '@/lib/books/queries';
import { setBookTags } from '@/lib/books/tags';
import { downloadAndStoreCover } from '@/lib/storage/service';
import type { CreateBookInput, BookFilters, BookListStatus } from '@/lib/books/types';

/** Books by the same author to consider when looking for a duplicate. */
const DUPLICATE_CANDIDATE_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tags = searchParams.getAll('tag');
    const rawStatus = searchParams.get('status');
    const searchAll = searchParams.get('status') === 'all';
    const status = !searchAll && rawStatus && (['processing', 'shortlist', 'longlist', 'archived'] as string[]).includes(rawStatus)
      ? rawStatus as BookListStatus
      : null;
    const filters: BookFilters = {
      listStatus: status ?? undefined,
      listStatuses: searchAll ? undefined : (status ? undefined : ['shortlist', 'longlist']),
      search: searchParams.get('q') ?? undefined,
      tags: tags.length ? tags : undefined,
      sortBy: (searchParams.get('sort') === 'popular' ? 'popular' : undefined),
      createdBy: searchParams.get('created_by') ?? searchParams.get('added_by') ?? undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      pageSize: searchParams.get('page_size') ? Number(searchParams.get('page_size')) : undefined,
      libraryOnly: searchParams.get('library_only') === 'true',
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

    // Duplicate check: same ISBN-13, or same author with an overlapping title in
    // either language. Two separate parameter-safe queries merged in code —
    // NOT a single `.or()` string: `author` can contain commas (Google Books
    // reports co-authors as "A, B, C"), and a comma is the clause separator in
    // a PostgREST `or` filter, so interpolating it there would both break
    // multi-author lookups and let a crafted value inject extra clauses.
    // `.ilike()`/`.eq()` pass values as single filter params, where a comma is
    // just data. Matching in code (not in the query) also lets `title_en`
    // participate — a Czech record and its English twin must collide.
    const candidateColumns = 'id, title_cs, title_en, author, isbn_13';

    const [byAuthor, byIsbn] = await Promise.all([
      supabase
        .from('books')
        .select(candidateColumns)
        .ilike('author', body.author.trim())
        .limit(DUPLICATE_CANDIDATE_LIMIT),
      body.isbn_13
        ? supabase.from('books').select(candidateColumns).eq('isbn_13', body.isbn_13).limit(1)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (byAuthor.error) throw byAuthor.error;
    if (byIsbn.error) throw byIsbn.error;

    const candidatesById = new Map(
      [...(byAuthor.data ?? []), ...(byIsbn.data ?? [])].map((book) => [book.id, book]),
    );

    const existing = findDuplicate(
      {
        title_cs: body.title.trim(),
        title_en: body.title_en ?? null,
        author: body.author.trim(),
        isbn_13: body.isbn_13 ?? null,
      },
      [...candidatesById.values()],
    );

    if (existing) {
      return NextResponse.json(
        { error: 'Tato kniha již existuje v katalogu', existingId: existing.id },
        { status: 409 },
      );
    }

    const cleanTags = (body.tags ?? []).filter((t) => t.trim().length > 0);

    const { data: inserted, error: insertError } = await supabase
      .from('books')
      .insert({
        title_cs: body.title.trim(),
        title_en: body.title_en?.trim() ?? null,
        author: body.author.trim(),
        isbn_13: body.isbn_13 ?? null,
        description: body.description ?? null,
        page_count: body.page_count ?? null,
        preview_link: body.preview_link ?? null,
        book_points: body.book_points ?? null,
        // The scoring rationale lives here: the review UI already surfaces
        // `list_status_reason` as DŮVOD ZAŘAZENÍ, and `classify` replaces it
        // with the coach's own reason on approval.
        list_status_reason: body.points_reason?.trim() ?? null,
        source: body.source ?? 'manual',
        external_id: body.external_id ?? null,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    let coverUrl: string | null = body.google_books_cover_url ?? null;
    if (!coverUrl && body.cover_url) {
      coverUrl = await downloadAndStoreCover(body.cover_url, inserted.id);
    }

    if (coverUrl) {
      await supabase
        .from('books')
        .update({
          google_books_cover_url: coverUrl,
          updated_by_profile_id: profile.id,
        })
        .eq('id', inserted.id);
    }

    if (cleanTags.length > 0) {
      await setBookTags(supabase, inserted.id, cleanTags, profile.id);
    }

    return NextResponse.json(
      { data: { ...inserted, google_books_cover_url: coverUrl, tags: cleanTags } },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/books error:', error);
    return NextResponse.json({ error: 'Nepodařilo se přidat knihu' }, { status: 500 });
  }
}
