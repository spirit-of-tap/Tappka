import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssays, getEssaysByTeam } from '@/lib/essays/queries';
import { contentTextFromJson } from '@/lib/essays/content-text';
import { validateEssaySourceIds } from '@/lib/essays/validate-source';
import type { EssayListView, EssaySortOrder } from '@/lib/essays/types';
import type { Database } from '@/lib/supabase/database.types';

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
    const { title, content_json, content_text, book_id, content_source_id } = body;

    const sourceError = validateEssaySourceIds(book_id, content_source_id);
    if (sourceError) {
      return NextResponse.json({ error: sourceError }, { status: 400 });
    }

    // The essay may be empty in every field at creation time — a title-less
    // essay stays a private draft. There is no explicit publish step: it
    // becomes visible to everyone the moment it first has a title, whether
    // that happens here on the first save or later (see PATCH /api/essays/[id]).
    const trimmedTitle = typeof title === 'string' ? title.trim() : '';
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      return NextResponse.json({ error: 'Název eseje je příliš dlouhý' }, { status: 400 });
    }

    const nextContent = content_json ?? {};
    const plainText = typeof content_text === 'string'
      ? content_text
      : contentTextFromJson(nextContent);
    if (plainText.length > MAX_CONTENT_TEXT_LENGTH) {
      return NextResponse.json({ error: 'Esej je příliš dlouhá' }, { status: 400 });
    }

    const { data: essay, error: essayError } = await supabase
      .from('essays')
      .insert({
        author_profile_id: profile.id,
        book_id: book_id ?? null,
        content_source_id: content_source_id ?? null,
        published_at: trimmedTitle ? new Date().toISOString() : null,
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
        title: trimmedTitle,
        content_json: nextContent,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      });

    if (revisionError) throw revisionError;

    return NextResponse.json({ data: { id: essay.id } }, { status: 201 });
  } catch (error) {
    console.error('POST /api/essays error:', error);
    return NextResponse.json({ error: 'Nepodařilo se uložit esej' }, { status: 500 });
  }
}
