import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import {
  getUnreadTeamEssaysForCoach,
  getReadTeamEssaysForCoach,
} from '@/lib/essays/queries';
import { CoachReviewList } from '@/components/essays/coach-review-list';
import { PageShell } from '@/components/ui/page-shell';

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
        <h1 className="text-2xl font-bold mb-2">Ke kontrole</h1>
        <p className="text-sm text-muted-foreground">
          Nemáte přiřazený tým, takže zde nejsou žádné eseje ke kontrole.
        </p>
      </PageShell>
    );
  }

  const [unread, read] = await Promise.all([
    getUnreadTeamEssaysForCoach(supabase, profile.id, profile.team_id),
    getReadTeamEssaysForCoach(supabase, profile.id, profile.team_id),
  ]);

  return (
    <PageShell size="medium">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ke kontrole</h1>
        <p className="text-sm text-muted-foreground">
          Nové eseje od studujících ve vašem týmu. Označte je jako přečtené, jakmile je zkontrolujete.
        </p>
      </div>

      <CoachReviewList initialUnread={unread} initialRead={read} />
    </PageShell>
  );
}
