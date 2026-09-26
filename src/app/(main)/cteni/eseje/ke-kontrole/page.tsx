import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getCoachReviewEssays } from '@/lib/essays/queries';
import {
  ALL_TEAMS,
  COACH_REVIEW_DEFAULT_PAGE_SIZE,
  parseCoachReviewParams,
  teamIdForQuery,
} from '@/lib/essays/coach-review-params';
import { CoachReviewList } from '@/components/essays/coach-review-list';
import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';

export const metadata = {
  title: 'Ke kontrole',
  description: 'Nové eseje od studujících',
};

export default async function CoachReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
    redirect('/');
  }

  const rawParams = await searchParams;
  const defaultTeamId = profile.team_id ?? ALL_TEAMS;
  const params = parseCoachReviewParams((key) => {
    const v = rawParams[key];
    return Array.isArray(v) ? v[0] : v;
  }, defaultTeamId);

  const [teamsResult, initialResult] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name')
      .is('removed_at', null)
      .order('name', { ascending: true }),
    getCoachReviewEssays(supabase, profile.id, {
      tab: params.tab,
      teamId: teamIdForQuery(params.team),
      rocket: params.rocket,
      points: params.points,
      reply: params.reply,
      search: params.search,
      page: 1,
      pageSize: COACH_REVIEW_DEFAULT_PAGE_SIZE,
    }),
  ]);

  const teams = (teamsResult.data ?? []) as { id: string; name: string }[];

  return (
    <PageShell size="medium">
      <PageHeader
        title="Ke kontrole"
        description="Nové eseje od studujících"
      />

      <CoachReviewList
        initialEssays={initialResult.essays}
        initialUnreadCount={initialResult.unreadCount}
        initialReadCount={initialResult.readCount}
        initialHasMore={initialResult.hasMore}
        teams={teams}
        defaultTeamId={defaultTeamId}
        commentsMap={initialResult.commentsMap}
        coachReadsMap={initialResult.coachReadsMap}
        currentCoachId={profile.id}
        currentCoachName={profile.name ?? 'Kouč:ka'}
        initialParams={params}
      />
    </PageShell>
  );
}
