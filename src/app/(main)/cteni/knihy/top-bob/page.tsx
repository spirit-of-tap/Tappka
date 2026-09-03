import { Medal } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getHighlightedBooks, getHighlightCategories } from '@/lib/books/queries';
import { groupHighlightedBooks } from '@/lib/books/highlight-groups';
import { PageBack } from '@/components/ui/page-back';
import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';
import { TopBobBrowser } from '@/components/books/top-bob-browser';

export const metadata = {
  title: 'TOP BOB | Tappka',
  description: 'Zlato celé knihovny — knihy, na kterých se shodli kouči:ky i komunita',
};

export default async function TopBobPage() {
  const supabase = await createClient();

  const [highlightedBooks, highlightCategories] = await Promise.all([
    getHighlightedBooks(supabase),
    getHighlightCategories(supabase),
  ]);

  const groups = groupHighlightedBooks(highlightedBooks, highlightCategories);
  const totalBooks = highlightedBooks.length;

  return (
    <PageShell size="wide" className="space-y-8">
      <PageBack href="/cteni/hledat" label="Zpět do hledání" />

      <PageHeader
        title="TOP BOB"
        description="Zlato celé knihovny — když nevíš, co číst dál, tady nešlápneš vedle"
        count={{ value: totalBooks, label: 'knih' }}
        icon={
          <span className="flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
            <Medal className="size-5 sm:size-6" />
          </span>
        }
      />

      <TopBobBrowser groups={groups} />
    </PageShell>
  );
}
