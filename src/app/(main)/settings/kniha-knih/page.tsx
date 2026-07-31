import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getProcessingBooks, getArchivedBooks, getHighlightedBooks, getShortlistedBooks, getLonglistedBooks, getHighlightCategories, getBooks } from '@/lib/books/queries';
import { CoachDashboard } from '@/components/books/coach-dashboard';
import { PageShell } from '@/components/ui/page-shell';

export default async function KnihaKnihSettingsPage() {
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
    <PageShell size="wide">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Správa knihovny</h1>
        <p className="text-muted-foreground text-sm">Zařaď knihy do seznamů a spravuj výběr knih.</p>
      </div>
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
