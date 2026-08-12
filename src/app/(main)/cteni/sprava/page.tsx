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

export default async function SpravaKnihovnyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
        description="Zařaď knihy do seznamů a spravuj výběr knih."
        action={
          <Button asChild size="sm" className="gap-2 shrink-0">
            <Link href="/cteni/knihy/nova">
              <Plus className="size-4" />
              Přidat knihu
            </Link>
          </Button>
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
