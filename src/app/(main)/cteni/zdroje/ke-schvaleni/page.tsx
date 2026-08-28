import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getPendingContentSources } from '@/lib/content-sources/queries';
import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/ui/page-header';
import { ContentSourceReviewList } from '@/components/content-sources/content-source-review-list';

export default async function ZdrojeKeSchvaleniPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
    redirect('/');
  }

  const pending = await getPendingContentSources(supabase);

  return (
    <PageShell size="narrow">
      <PageHeader title="Zdroje ke schválení" description="Podcasty, konference a programy čekající na kontrolu." />
      <ContentSourceReviewList initialPending={pending} />
    </PageShell>
  );
}
