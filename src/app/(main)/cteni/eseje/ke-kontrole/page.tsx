import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getCoachReviewEssays } from '@/lib/essays/queries';
import { CoachReviewList } from '@/components/essays/coach-review-list';
import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';

export const metadata = {
  title: 'Ke kontrole | Tappka',
  description: 'Nové eseje od studujících',
};

export default async function CoachReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
    redirect('/');
  }

  const defaultTeamId = profile.team_id ?? 'all';
  const [teamsResult, initialResult] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name')
      .is('removed_at', null)
      .order('name', { ascending: true }),
    getCoachReviewEssays(supabase, profile.id, {
      tab: 'unread',
      teamId: defaultTeamId === 'all' ? null : defaultTeamId,
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
        initialUnread={initialResult.essays}
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
      />
    </PageShell>
  );
}
