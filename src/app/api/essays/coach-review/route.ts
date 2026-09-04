import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getCoachReviewEssays } from '@/lib/essays/queries';
import type {
  CoachReviewTab,
  CoachReviewRocketFilter,
  CoachReviewPointsFilter,
  CoachReviewReplyFilter,
} from '@/lib/essays/types';
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
    const tab = (searchParams.get('tab') ?? 'unread') as CoachReviewTab;
    const teamId = searchParams.get('team_id') ?? undefined;
    const rocket = (searchParams.get('rocket') ?? 'all') as CoachReviewRocketFilter;
    const points = (searchParams.get('points') ?? 'all') as CoachReviewPointsFilter;
    const reply = (searchParams.get('reply') ?? 'all') as CoachReviewReplyFilter;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
    const pageSize = searchParams.get('page_size')
      ? Number(searchParams.get('page_size'))
      : 50;

    const result = await getCoachReviewEssays(supabase, profile.id, {
      tab,
      teamId: teamId === 'all' ? null : teamId,
      rocket,
      points,
      reply,
      page,
      pageSize,
    });

    return NextResponse.json({
      data: result.essays,
      totalCount: result.totalCount,
      unreadCount: result.unreadCount,
      readCount: result.readCount,
      hasMore: result.hasMore,
      authorPointsMap: result.authorPointsMap,
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
