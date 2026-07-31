import Link from 'next/link';
import { ArrowLeft, Medal } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getHighlightedBooks, getHighlightCategories } from '@/lib/books/queries';
import { groupHighlightedBooks } from '@/lib/books/highlight-groups';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/ui/page-shell';
import { TopBobBrowser } from '@/components/books/top-bob-browser';

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
      <Button variant="ghost" asChild className="-ml-2 gap-2">
        <Link href="/hledat">
          <ArrowLeft className="size-4" />
          Zpět do hledání
        </Link>
      </Button>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-background to-background p-8 dark:border-amber-900/40 dark:from-amber-950/20">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Medal className="size-5" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Doporučení koučů a komunity
          </span>
        </div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight">TOP BOB</h1>
        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          Zlato celé knihovny — {totalBooks} knih, na kterých se shodli kouči i komunita. Nejde o povinný
          seznam, ale o mapu: když nevíš, co číst dál, tady nešlápneš vedle.
        </p>
      </div>

      <TopBobBrowser groups={groups} />
    </PageShell>
  );
}
