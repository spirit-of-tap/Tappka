import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookOpen, ChevronDown, Plus, Radio } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import {
  getProcessingBooks,
  getArchivedBooks,
  getHighlightedBooks,
  getShortlistedBooks,
  getLonglistedBooks,
  getHighlightCategories,
} from '@/lib/books/queries';
import { getContentSources, getPendingContentSources } from '@/lib/content-sources/queries';
import { getPhysicalLibraryInventory } from '@/lib/library/queries';
import { cn } from '@/lib/utils';
import { CoachDashboard } from '@/components/books/coach-dashboard';
import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/ui/page-header';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const metadata = {
  title: 'Správa knihovny',
  description: 'Zařaď knihy a zdroje do seznamů a spravuj výběr',
};

interface SpravaKnihovnyPageProps {
  searchParams?: Promise<{ tab?: string; sub?: string }>;
}

export default async function SpravaKnihovnyPage({ searchParams }: SpravaKnihovnyPageProps) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
    redirect('/');
  }

  const { tab, sub } = (await searchParams) ?? {};

  const [
    processingBooks,
    pendingSources,
    archivedBooks,
    highlightedBooks,
    shortlistedBooks,
    longlistedBooks,
    highlightCategories,
    contentSources,
    libraryInventory,
  ] = await Promise.all([
    getProcessingBooks(supabase),
    getPendingContentSources(supabase),
    getArchivedBooks(supabase),
    getHighlightedBooks(supabase),
    getShortlistedBooks(supabase),
    getLonglistedBooks(supabase),
    getHighlightCategories(supabase),
    getContentSources(supabase, { status: 'all', pageSize: 300 }),
    getPhysicalLibraryInventory(supabase),
  ]);

  return (
    <PageShell size="full">
      <PageHeader
        title="Správa knihovny"
        description="Zařaď knihy a zdroje do seznamů a spravuj výběr"
        action={
          <DropdownMenu>
            {/*
              No `asChild` + `Button` here: cloning the trigger via Radix Slot
              causes a known React 19 hydration mismatch (radix-ui/primitives#3700).
            */}
            <DropdownMenuTrigger className={cn(buttonVariants({ size: 'sm' }), 'shrink-0 gap-1.5')}>
              <Plus className="size-4" />
              <span>Přidat</span>
              <ChevronDown className="size-3.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href="/cteni/knihy/nova" className="flex items-center gap-2 cursor-pointer">
                  <BookOpen className="size-4" />
                  <span>Kniha</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/cteni/zdroje/nova" className="flex items-center gap-2 cursor-pointer">
                  <Radio className="size-4" />
                  <span>Jiný zdroj</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <CoachDashboard
        initialProcessing={processingBooks}
        initialPendingSources={pendingSources}
        initialShortlisted={shortlistedBooks}
        initialLonglisted={longlistedBooks}
        initialArchived={archivedBooks}
        initialCategories={highlightCategories}
        initialHighlighted={highlightedBooks}
        initialContentSources={contentSources}
        initialLibraryInventory={libraryInventory}
        initialTab={tab}
        initialSub={sub}
      />
    </PageShell>
  );
}
