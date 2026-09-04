import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getProcessingBooks, getArchivedBooks, getHighlightedBooks, getShortlistedBooks, getLonglistedBooks, getHighlightCategories, getBooks } from '@/lib/books/queries';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { CoachDashboard } from '@/components/books/coach-dashboard';
import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: "Správa knihovny",
  description: "Zařaď knihy do seznamů a spravuj výběr",
};

export default async function SpravaKnihovnyPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
    redirect('/');
  }

  const [processingBooks, archivedBooks, highlightedBooks, shortlistedBooks, longlistedBooks, highlightCategories, rocketModelBooks] = await Promise.all([
    getProcessingBooks(supabase),
    getArchivedBooks(supabase),
    getHighlightedBooks(supabase),
    getShortlistedBooks(supabase),
    getLonglistedBooks(supabase),
    getHighlightCategories(supabase),
    getBooks(supabase, { isRocketModel: true, pageSize: 500 }),
  ]);

  return (
    <PageShell size="full">
      <PageHeader
        title="Správa knihovny"
        description="Zařaď knihy do seznamů a spravuj výběr"
        action={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="gap-2 shrink-0">
              <Link href="/cteni/zdroje/ke-schvaleni">
                Zdroje ke schválení
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-2 shrink-0">
              <Link href="/cteni/knihy/nova">
                <Plus className="size-4" />
                Přidat knihu
              </Link>
            </Button>
          </div>
        }
      />
      <CoachDashboard
        initialProcessing={processingBooks}
        initialArchived={archivedBooks}
        initialHighlighted={highlightedBooks}
        initialShortlisted={shortlistedBooks}
        initialLonglisted={longlistedBooks}
        initialCategories={highlightCategories}
        initialRocketModel={rocketModelBooks}
      />
    </PageShell>
  );
}
