import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getUserBookPointsStats, getTeamBookPointsStats, getAllEssays } from '@/lib/essays/queries';
import { getMyLoans } from '@/lib/library/queries';
import { getEssaysAwaitingReply } from '@/lib/essays/awaiting-reply';
import { Button } from '@/components/ui/button';
import { PrehledContent } from '@/components/essays/prehled-content';
import { CteniViewTracker } from '@/components/cteni/cteni-view-tracker';
import { HelpDialog } from '@/components/help-dialog';
import { InfoCard } from '@/components/essays/info-card';
import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';

export const metadata = {
  title: 'Moje čtení',
  description: 'Tvůj pokrok, knihy a eseje',
};

export default async function PrehledPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user, includeTeam: true });
  if (!profile) redirect('/auth/login');

  const [stats, myEssays, teamStats, votesResult, loans] = await Promise.all([
    getUserBookPointsStats(supabase, profile.id),
    getAllEssays(supabase, { authorProfileId: profile.id }),
    profile.team_id ? getTeamBookPointsStats(supabase, profile.team_id) : Promise.resolve([]),
    supabase.from('essay_votes').select('essay_id').eq('voter_profile_id', profile.id),
    getMyLoans(supabase, profile.id).catch(() => []),
  ]);

  const votedEssayIds = new Set<string>((votesResult.data ?? []).map((r) => r.essay_id));
  // Only essays that have comments can be waiting on a reply.
  const awaitingReplyIds = await getEssaysAwaitingReply(
    supabase,
    profile.id,
    myEssays.filter((e) => e.comment_count > 0).map((e) => e.id),
  ).catch(() => new Set<string>());

  return (
    <PageShell size="full" className="max-w-6xl">
      <CteniViewTracker />
      <PageHeader
        title="Moje čtení"
        description="Tvůj pokrok, knihy a eseje"
        action={
          <>
            <Button asChild className="hidden sm:inline-flex">
              <Link href="/cteni/eseje/nova">
                <Plus />
                Napsat esej
              </Link>
            </Button>
            <HelpDialog question="Co jsou esejbanka a knižní body?">
              <InfoCard />
            </HelpDialog>
          </>
        }
      />

      <PrehledContent
        stats={stats}
        myEssays={myEssays}
        onboardingYear={profile.team?.onboardingYear}
        votedEssayIds={votedEssayIds}
        awaitingReplyIds={awaitingReplyIds}
        loans={loans}
        teamStats={teamStats}
        currentProfileId={profile.id}
        teamName={profile.team?.name}
      />
    </PageShell>
  );
}
