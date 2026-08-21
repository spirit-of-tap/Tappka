import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { NotificationPreferencesForm } from '@/components/settings/notification-preferences-form';
import { PageHeader } from '@/components/ui/page-header';

export const metadata = {
  title: 'Notifikace | Tappka',
  description: 'Vyber si, o čem tě budeme informovat e-mailem',
};

export default async function NotificationSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) redirect('/');

  const { data: preferences } = await supabase
    .from('notification_preferences')
    .select('essay_coach_read_email, essay_comment_email, essay_vote_email, book_submitted_email')
    .eq('profile_id', profile.id)
    .maybeSingle();

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <PageHeader
        title="Notifikace"
        description="Vyber si, o čem tě budeme informovat e-mailem"
      />
      <NotificationPreferencesForm
        initialCoachReadEmail={preferences?.essay_coach_read_email ?? true}
        initialCommentEmail={preferences?.essay_comment_email ?? true}
        initialVoteEmail={preferences?.essay_vote_email ?? true}
        initialBookSubmittedEmail={preferences?.book_submitted_email ?? false}
        hasBetaAccess={Boolean(profile.beta_access_granted_at)}
      />
    </div>
  );
}
