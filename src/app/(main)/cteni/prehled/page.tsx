import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getUserBookPointsStats, getTeamBookPointsStats, getEssays } from '@/lib/essays/queries';
import { getMyLoans } from '@/lib/library/queries';
import { PrehledContent } from '@/components/essays/prehled-content';
import { CteniViewTracker } from '@/components/cteni/cteni-view-tracker';
import { HelpDialog } from '@/components/help-dialog';
import { InfoCard } from '@/components/essays/info-card';
import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';

export const metadata = {
  title: 'Moje čtení',
  description: 'Tvůj pokrok, eseje a srovnání s týmem',
};

export default async function PrehledPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) redirect('/auth/login');

  const [stats, myEssays, teamStats, votesResult, loans] = await Promise.all([
    getUserBookPointsStats(supabase, profile.id),
    getEssays(supabase, { authorProfileId: profile.id, pageSize: 50 }),
    profile.team_id ? getTeamBookPointsStats(supabase, profile.team_id) : Promise.resolve([]),
    supabase.from('essay_votes').select('essay_id').eq('voter_profile_id', profile.id),
    getMyLoans(supabase, profile.id).catch(() => []),
  ]);

  const votedEssayIds = new Set<string>((votesResult.data ?? []).map((r) => r.essay_id));

  return (
    <PageShell size="full">
      <CteniViewTracker />
      <PageHeader
        title="Moje čtení"
        description="Tvůj pokrok, eseje a srovnání s týmem"
        action={
          <HelpDialog question="Co jsou esejbanka a knižní body?">
            <InfoCard />
          </HelpDialog>
        }
      />

      <PrehledContent
        stats={stats}
        myEssays={myEssays}
        teamStats={teamStats}
        hasTeam={!!profile.team_id}
        teamId={profile.team_id}
        votedEssayIds={votedEssayIds}
        loans={loans}
      />
    </PageShell>
  );
}
