import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getCoachUnreadCount } from '@/lib/essays/queries';
import { CteniTabBar } from '@/components/cteni/cteni-tab-bar';

export default async function CteniLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) redirect('/auth/login');

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
