import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getCoachReviewEssays } from '@/lib/essays/queries';
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
    redirect('/');
  }

  const rawParams = await searchParams;
  const getParam = (key: string): string | undefined => {
    const v = rawParams[key];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const tabParam = getParam('tab');
  const teamParam = getParam('team_id');
  const rocketParam = getParam('rocket');
  const pointsParam = getParam('points');
  const replyParam = getParam('reply');

  const defaultTeamId = profile.team_id ?? 'all';
  // Validate and normalize search params - fall back to defaults if invalid
  const activeTab = tabParam === 'read' ? 'read' : 'unread';
  // If teamParam is explicitly provided (including 'all'), use it; otherwise use default
  const effectiveTeamId = teamParam !== undefined ? (teamParam === 'all' ? null : teamParam) : defaultTeamId === 'all' ? null : defaultTeamId;
  const rocket = (['all', 'rocket', 'non-rocket'].includes(rocketParam ?? '') ? rocketParam : 'all') as 'all' | 'rocket' | 'non-rocket';
  const points = (['all', '1', '2', '3', '0'].includes(pointsParam ?? '') ? pointsParam : 'all') as 'all' | '1' | '2' | '3' | '0';
  const reply = (['all', 'with-reply', 'without-reply', 'edited-after-comment', 'no-coach-comment'].includes(replyParam ?? '') ? replyParam : 'all') as 'all' | 'with-reply' | 'without-reply' | 'edited-after-comment' | 'no-coach-comment';

  const [teamsResult, initialResult] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name')
      .is('removed_at', null)
      .order('name', { ascending: true }),
    getCoachReviewEssays(supabase, profile.id, {
      tab: activeTab as 'unread' | 'read',
      teamId: effectiveTeamId,
      rocket,
      points,
      reply,
      page: 1,
      pageSize: 50,
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
        initialUnread={activeTab === 'unread' ? initialResult.essays : []}
        initialRead={activeTab === 'read' ? initialResult.essays : []}
        initialUnreadCount={initialResult.unreadCount}
        initialReadCount={initialResult.readCount}
        initialHasMore={initialResult.hasMore}
        teams={teams}
        defaultTeamId={defaultTeamId}
        authorPointsMap={initialResult.authorPointsMap}
        commentsMap={initialResult.commentsMap}
        coachReadsMap={initialResult.coachReadsMap}
        currentCoachId={profile.id}
        currentCoachName={profile.name ?? 'Kouč:ka'}
        initialTab={activeTab as 'unread' | 'read'}
        initialTeamId={effectiveTeamId}
        initialRocket={rocket}
        initialPoints={points}
        initialReply={reply}
      />
    </PageShell>
  );
}
