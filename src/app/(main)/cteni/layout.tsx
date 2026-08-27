import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getCoachUnreadCount } from '@/lib/essays/queries';
import { CteniTabBar } from '@/components/cteni/cteni-tab-bar';
import { FeatureComingSoon } from '@/components/beta/feature-coming-soon';
import { canAccessFeature, type BetaCohort } from '@/lib/feature-access';

export default async function CteniLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) redirect('/auth/login');
  if (
    !canAccessFeature(
      {
        role: profile.role,
        beta_access_granted_at: profile.beta_access_granted_at,
        beta_cohort: ((profile as unknown as { beta_cohort: BetaCohort }).beta_cohort ?? "A") as BetaCohort,
      },
      "reading",
    )
  ) {
    return <FeatureComingSoon featureName="Čtení" />
  }

  const isCoachOrAdmin = profile.role === 'coach' || profile.role === 'admin';
  let reviewCount = 0;
  if (isCoachOrAdmin) {
    reviewCount = await getCoachUnreadCount(supabase, profile.id, profile.team_id ?? undefined);
  }

  return (
    <>
      <CteniTabBar isCoachOrAdmin={isCoachOrAdmin} reviewCount={reviewCount} />
      {children}
    </>
  );
}
