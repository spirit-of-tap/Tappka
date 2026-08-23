import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import {
  getUnreadTeamEssaysForCoach,
  getReadTeamEssaysForCoach,
} from '@/lib/essays/queries';
import { CoachReviewList } from '@/components/essays/coach-review-list';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';

export const metadata = {
  title: 'Ke kontrole | Tappka',
  description: 'Nové eseje od studujících ve tvém týmu',
};

export default async function CoachReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
    redirect('/');
  }

  if (!profile.team_id) {
    return (
      <PageShell size="medium">
        <PageHeader title="Ke kontrole" />
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Žádný tým</EmptyTitle>
            <EmptyDescription>Nemáš přiřazený tým, takže tu nejsou žádné eseje ke kontrole.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </PageShell>
    );
  }

  const [unread, read] = await Promise.all([
    getUnreadTeamEssaysForCoach(supabase, profile.id, profile.team_id),
    getReadTeamEssaysForCoach(supabase, profile.id, profile.team_id),
  ]);

  return (
    <PageShell size="medium">
      <PageHeader
        title="Ke kontrole"
        description="Nové eseje od studujících ve tvém týmu"
      />

      <CoachReviewList initialUnread={unread} initialRead={read} />
    </PageShell>
  );
}
