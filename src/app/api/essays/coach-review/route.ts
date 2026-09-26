import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getCoachReviewEssays } from '@/lib/essays/queries';
import { ALL_TEAMS, parseCoachReviewParams, teamIdForQuery } from '@/lib/essays/coach-review-params';
import { serverLogger } from "@/lib/server-logger";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Přístup odepřen' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const params = parseCoachReviewParams((key) => searchParams.get(key), ALL_TEAMS);

    const result = await getCoachReviewEssays(supabase, profile.id, {
      tab: params.tab,
      teamId: teamIdForQuery(params.team),
      rocket: params.rocket,
      points: params.points,
      reply: params.reply,
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
    });

    return NextResponse.json({
      data: result.essays,
      totalCount: result.totalCount,
      unreadCount: result.unreadCount,
      readCount: result.readCount,
      hasMore: result.hasMore,
      commentsMap: result.commentsMap,
      coachReadsMap: result.coachReadsMap,
    });
  } catch (error) {
    serverLogger.console.error('GET /api/essays/coach-review error:', error);
    return NextResponse.json(
      { error: 'Nepodařilo se načíst eseje ke kontrole' },
      { status: 500 },
    );
  }
}
