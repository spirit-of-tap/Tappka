import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssays, getEssaysByTeam, pickLatestRevision } from '@/lib/essays/queries';
import { contentTextFromJson } from '@/lib/essays/content-text';
import type { EssayListView, EssaySortOrder } from '@/lib/essays/types';
import type { Database, Json } from '@/lib/supabase/database.types';

const MAX_TITLE_LENGTH = 500;
const MAX_CONTENT_TEXT_LENGTH = 100_000;

async function annotateWithVoted<T extends { id: string }>(
  supabase: SupabaseClient<Database>,
  essays: T[],
  profileId: string | undefined,
): Promise<(T & { user_has_voted: boolean })[]> {
  const annotated = essays.map((e) => ({ ...e, user_has_voted: false }));
  if (profileId && essays.length > 0) {
    const { data } = await supabase
      .from('essay_votes')
      .select('essay_id')
      .eq('voter_profile_id', profileId)
      .in('essay_id', essays.map((e) => e.id));
    const votedIds = new Set((data ?? []).map((v: { essay_id: string }) => v.essay_id));
    annotated.forEach((e, i) => { annotated[i].user_has_voted = votedIds.has(essays[i].id); });
  }
  return annotated;
}

/**
 * Loads a freshly created essay with revision + count embeds for the API response.
 */
async function fetchCreatedEssay(
  supabase: SupabaseClient<Database>,
  essayId: string,
) {
  const { data, error } = await supabase
    .from('essays')
    .select(`
      *,
      essay_revisions(title, content_json, revision_no, invalid_since),
      essay_votes(count),
      essay_views(count),
      essay_comments(count),
      author:profiles!author_profile_id(id, name, picture, role),
      book:books!book_id(id, title_cs, author, book_points, status, google_books_cover_url)
    `)
    .eq('id', essayId)
    .single();

  if (error) throw error;

  const revision = pickLatestRevision(
    data.essay_revisions as {
      title: string;
      content_json: Json;
      revision_no: number;
      invalid_since: string | null;
    }[] | null,
  );
  const content_json = (revision?.content_json ?? {}) as object;
  const {
    essay_revisions: _revs,
    essay_votes,
    essay_views,
    essay_comments,
    created_by_profile_id: _c,
    updated_by_profile_id: _u,
    ...rest
  } = data as typeof data & {
    essay_votes?: { count: number }[];
    essay_views?: { count: number }[];
    essay_comments?: { count: number }[];
  };

  return {
    ...rest,
    title: revision?.title ?? '',
    content_json,
    content_text: contentTextFromJson(content_json),
    vote_count: Number(essay_votes?.[0]?.count ?? 0),
    view_count: Number(essay_views?.[0]?.count ?? 0),
    comment_count: Number(essay_comments?.[0]?.count ?? 0),
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const view = (searchParams.get('view') ?? 'vse') as EssayListView;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
    const teamId = searchParams.get('team_id') ?? undefined;
    const search = searchParams.get('q') ?? undefined;
    const sort = (searchParams.get('sort') ?? 'recent') as EssaySortOrder;
    const tag = searchParams.get('tag') ?? undefined;

    if (view === 'moje') {
      const profile = await getCurrentUserProfile(supabase, { user });
      if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });
      const essays = await getEssays(supabase, { authorProfileId: profile.id, page, search, sort, tag });
      return NextResponse.json({ data: await annotateWithVoted(supabase, essays, profile.id) });
    }

    if (view === 'tym' && teamId) {
      const profile = await getCurrentUserProfile(supabase, { user });
      const essays = await getEssaysByTeam(supabase, teamId, { page, search });
      return NextResponse.json({ data: await annotateWithVoted(supabase, essays, profile?.id) });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    const essays = await getEssays(supabase, { page, search, sort, tag });
    return NextResponse.json({ data: await annotateWithVoted(supabase, essays, profile?.id) });
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
    if (title.trim().length > MAX_TITLE_LENGTH) {
      return NextResponse.json({ error: 'Název eseje je příliš dlouhý' }, { status: 400 });
    }

    const plainText = typeof content_text === 'string'
      ? content_text
      : contentTextFromJson(content_json);
    if (plainText.length > MAX_CONTENT_TEXT_LENGTH) {
      return NextResponse.json({ error: 'Esej je příliš dlouhá' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { data: essay, error: essayError } = await supabase
      .from('essays')
      .insert({
        author_profile_id: profile.id,
        book_id: book_id ?? null,
        published_at: now,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
      .select('id')
      .single();

    if (essayError) throw essayError;

    const { error: revisionError } = await supabase
      .from('essay_revisions')
      .insert({
        essay_id: essay.id,
        revision_no: 1,
        title: title.trim(),
        content_json,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      });

    if (revisionError) throw revisionError;

    const normalized = await fetchCreatedEssay(supabase, essay.id);
    return NextResponse.json({ data: normalized }, { status: 201 });
  } catch (error) {
    console.error('POST /api/essays error:', error);
    return NextResponse.json({ error: 'Nepodařilo se uložit esej' }, { status: 500 });
  }
}
