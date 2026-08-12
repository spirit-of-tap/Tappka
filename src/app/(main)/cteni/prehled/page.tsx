import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getUserBookPointsStats, getTeamBookPointsStats, getEssays } from '@/lib/essays/queries';
import { PrehledTabs } from '@/components/essays/prehled-tabs';
import { PageShell } from '@/components/ui/page-shell';

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
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Přehled</h1>
        <p className="text-muted-foreground">Tvůj pokrok, eseje a srovnání s týmem</p>
      </div>

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
