import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getContentSourceById } from '@/lib/content-sources/queries';
import { CONTENT_SOURCE_POINT_VALUES } from '@/lib/content-sources/points';
import type { ContentSourceStatus } from '@/lib/content-sources/types';
import { serverLogger } from "@/lib/server-logger";

const REVIEW_STATUSES: ContentSourceStatus[] = ['approved', 'archived'];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const source = await getContentSourceById(supabase, id);
    if (!source) return NextResponse.json({ error: 'Zdroj nenalezen' }, { status: 404 });

    return NextResponse.json({ data: source });
  } catch (error) {
    serverLogger.console.error('GET /api/content-sources/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst zdroj' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Nedostatečná oprávnění' }, { status: 403 });
    }

    const body: { status: ContentSourceStatus; points?: number | null } = await request.json();

    if (!REVIEW_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Neplatný stav' }, { status: 400 });
    }
    if (body.points != null && !(CONTENT_SOURCE_POINT_VALUES as readonly number[]).includes(body.points)) {
      return NextResponse.json({ error: 'Neplatný počet bodů' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('content_sources')
      .update({
        status: body.status,
        points: body.points ?? undefined,
        status_changed_at: new Date().toISOString(),
        status_changed_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data: updated });
  } catch (error) {
    serverLogger.console.error('PATCH /api/content-sources/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se uložit rozhodnutí' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Nedostatečná oprávnění' }, { status: 403 });
    }

    const body: { reroute_to_book_id?: string; reroute_to_content_source_id?: string } =
      await request.json().catch(() => ({}));

    if (body.reroute_to_book_id && body.reroute_to_content_source_id) {
      return NextResponse.json({ error: 'Vyber jen jeden cíl přesměrování' }, { status: 400 });
    }

    if (body.reroute_to_book_id) {
      const { data: target, error: targetError } = await supabase
        .from('books')
        .select('id')
        .eq('id', body.reroute_to_book_id)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!target) return NextResponse.json({ error: 'Cílová kniha nenalezena' }, { status: 404 });

      // Generated RPC types mark all params as `string`, but PostgREST maps
      // an explicit JSON null to SQL NULL — which is how the unset target
      // of the exclusive (book XOR source) link is passed.
      const { error: rerouteError } = await supabase.rpc('reassign_content_source_essays', {
        p_source_content_source_id: id,
        p_target_book_id: body.reroute_to_book_id,
        p_target_content_source_id: null as unknown as string,
        p_updated_by_profile_id: profile.id,
      });
      if (rerouteError) throw rerouteError;
    }

    if (body.reroute_to_content_source_id) {
      if (body.reroute_to_content_source_id === id) {
        return NextResponse.json({ error: 'Nelze přesměrovat eseje na stejný zdroj' }, { status: 400 });
      }
      const { data: target, error: targetError } = await supabase
        .from('content_sources')
        .select('id')
        .eq('id', body.reroute_to_content_source_id)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!target) return NextResponse.json({ error: 'Cílový zdroj nenalezen' }, { status: 404 });

      const { error: rerouteError } = await supabase.rpc('reassign_content_source_essays', {
        p_source_content_source_id: id,
        p_target_book_id: null as unknown as string,
        p_target_content_source_id: body.reroute_to_content_source_id,
        p_updated_by_profile_id: profile.id,
      });
      if (rerouteError) throw rerouteError;
    }

    const { error } = await supabase.from('content_sources').delete().eq('id', id);
    if (error) throw error;

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    serverLogger.console.error('DELETE /api/content-sources/[id] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se smazat zdroj' }, { status: 500 });
  }
}
