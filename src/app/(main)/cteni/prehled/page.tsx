import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getUserBookPointsStats, getTeamBookPointsStats, getEssays } from '@/lib/essays/queries';
import { PrehledTabs } from '@/components/essays/prehled-tabs';
import { HelpDialog } from '@/components/help-dialog';
import { InfoCard } from '@/components/essays/info-card';
import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';

export const metadata = {
  title: 'Moje čtení | Tappka',
  description: 'Tvůj pokrok, eseje a srovnání s týmem',
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function PrehledPage({ searchParams }: PageProps) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) redirect('/auth/login');

  const [stats, myEssays, drafts, teamStats, votesResult] = await Promise.all([
    getUserBookPointsStats(supabase, profile.id),
    getEssays(supabase, { authorProfileId: profile.id, pageSize: 50 }),
    getEssays(supabase, { authorProfileId: profile.id, status: 'draft' }),
    profile.team_id ? getTeamBookPointsStats(supabase, profile.team_id) : Promise.resolve([]),
    supabase.from('essay_votes').select('essay_id').eq('voter_profile_id', profile.id),
  ]);

  const votedEssayIds = new Set<string>((votesResult.data ?? []).map((r) => r.essay_id));

  const defaultTab = tab === 'moje' || tab === 'tym' || tab === 'vypujcky' ? tab : 'moje';

  return (
    <PageShell size="full">
      <PageHeader
        title="Moje čtení"
        description="Tvůj pokrok, eseje a srovnání s týmem"
        action={
          <HelpDialog question="Co jsou esejbanka a BookPoints?">
            <InfoCard />
          </HelpDialog>
        }
      />

      <PrehledTabs
        defaultTab={defaultTab}
        stats={stats}
        myEssays={myEssays}
        drafts={drafts}
        teamStats={teamStats}
        hasTeam={!!profile.team_id}
        votedEssayIds={votedEssayIds}
      />
    </PageShell>
  );
}
