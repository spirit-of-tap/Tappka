import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import {
  getUnreadTeamEssaysForCoach,
  getReadTeamEssaysForCoach,
  getAuthorsApprovedBookPoints,
  getCommentsForEssays,
  getCoachReadsForEssays,
} from '@/lib/essays/queries';
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

  const [teamsResult, unread, read] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name')
      .is('removed_at', null)
      .order('name', { ascending: true }),
    getUnreadTeamEssaysForCoach(supabase, profile.id, null),
    getReadTeamEssaysForCoach(supabase, profile.id, null),
  ]);

  const teams = (teamsResult.data ?? []) as { id: string; name: string }[];
  const authorIds = Array.from(new Set([...unread, ...read].map((e) => e.author_profile_id)));
  const essayIds = Array.from(new Set([...unread, ...read].map((e) => e.id)));

  const [authorPointsMap, commentsMap, coachReadsMap] = await Promise.all([
    getAuthorsApprovedBookPoints(supabase, authorIds),
    getCommentsForEssays(supabase, essayIds),
    getCoachReadsForEssays(supabase, essayIds),
  ]);

  return (
    <PageShell size="medium">
      <PageHeader
        title="Ke kontrole"
        description="Nové eseje od studujících"
      />

      <CoachReviewList
        initialUnread={unread}
        initialRead={read}
        teams={teams}
        defaultTeamId={profile.team_id ?? 'all'}
        authorPointsMap={authorPointsMap}
        commentsMap={commentsMap}
        coachReadsMap={coachReadsMap}
        currentCoachId={profile.id}
        currentCoachName={profile.name ?? 'Kouč:ka'}
      />
    </PageShell>
  );
}
