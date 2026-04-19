import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getUserBookPointsStats, getTeamBookPointsStats, getEssays } from '@/lib/essays/queries';
import { PrehledTabs } from '@/components/essays/prehled-tabs';

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

  const [stats, myEssays, teamStats] = await Promise.all([
    getUserBookPointsStats(supabase, profile.id),
    getEssays(supabase, { authorProfileId: profile.id, pageSize: 50 }),
    profile.team_id ? getTeamBookPointsStats(supabase, profile.team_id) : Promise.resolve([]),
  ]);

  const defaultTab = tab ?? 'moje';

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Přehled</h1>
        <p className="text-muted-foreground">Tvůj pokrok, eseje a srovnání s týmem</p>
      </div>

      <PrehledTabs
        defaultTab={defaultTab}
        stats={stats}
        myEssays={myEssays}
        teamStats={teamStats}
        hasTeam={!!profile.team_id}
      />
    </div>
  );
}
