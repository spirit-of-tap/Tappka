import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getCoachUnreadCount } from '@/lib/essays/queries';
import { getMyWishlistBookIds } from '@/lib/books/wishlist';
import { serverLogger } from '@/lib/server-logger';
import { CteniTabBar } from '@/components/cteni/cteni-tab-bar';
import { WishlistProvider } from '@/components/books/wishlist-provider';

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
    // A failing badge count must not take down the whole reading section.
    reviewCount = await getCoachUnreadCount(supabase, profile.id, profile.team_id ?? undefined).catch(
      (err) => {
        serverLogger.console.error('getCoachUnreadCount failed:', err);
        return 0;
      },
    );
  }

  // One query for the whole section; cards read this through WishlistProvider
  // instead of each issuing its own request.
  const wishlistIds = await getMyWishlistBookIds(supabase, profile.id).catch((err) => {
    serverLogger.console.error('getMyWishlistBookIds failed:', err);
    return new Set<string>();
  });

  return (
    <WishlistProvider initialSavedIds={[...wishlistIds]}>
      <CteniTabBar isCoachOrAdmin={isCoachOrAdmin} reviewCount={reviewCount} />
      {children}
    </WishlistProvider>
  );
}
