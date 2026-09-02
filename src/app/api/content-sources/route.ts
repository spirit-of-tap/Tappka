import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getContentSources, getPendingContentSources } from '@/lib/content-sources/queries';
import { CONTENT_SOURCE_KINDS } from '@/lib/content-sources/types';
import { CONTENT_SOURCE_POINT_VALUES } from '@/lib/content-sources/points';
import type { CreateContentSourceInput, ContentSourceStatus } from '@/lib/content-sources/types';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    if (status === 'pending_review') {
      const profile = await getCurrentUserProfile(supabase, { user });
      if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
        return NextResponse.json({ error: 'Nedostatečná oprávnění' }, { status: 403 });
      }
      const sources = await getPendingContentSources(supabase);
      return NextResponse.json({ data: sources });
    }

    const sources = await getContentSources(supabase, {
      status: (status as ContentSourceStatus | null) ?? undefined,
      search: searchParams.get('q') ?? undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      pageSize: searchParams.get('page_size') ? Number(searchParams.get('page_size')) : undefined,
    });
    return NextResponse.json({ data: sources });
  } catch (error) {
    console.error('GET /api/content-sources error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst zdroje' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const body: CreateContentSourceInput = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Název je povinný' }, { status: 400 });
    }
    if (!CONTENT_SOURCE_KINDS.includes(body.kind)) {
      return NextResponse.json({ error: 'Neplatný typ zdroje' }, { status: 400 });
    }
    if (body.points != null && !(CONTENT_SOURCE_POINT_VALUES as readonly number[]).includes(body.points)) {
      return NextResponse.json({ error: 'Neplatný počet bodů' }, { status: 400 });
    }

    const { data: inserted, error } = await supabase
      .from('content_sources')
      .insert({
        kind: body.kind,
        title: body.title.trim(),
        creator: body.creator?.trim() || null,
        description: body.description?.trim() || null,
        external_url: body.external_url?.trim() || null,
        points: body.points ?? null,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data: inserted }, { status: 201 });
  } catch (error) {
    console.error('POST /api/content-sources error:', error);
    return NextResponse.json({ error: 'Nepodařilo se přidat zdroj' }, { status: 500 });
  }
}
