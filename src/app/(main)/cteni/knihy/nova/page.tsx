import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/ui/page-shell';
import { AddBookFlow } from '@/components/books/add-book/add-book-flow';
import { createClient } from '@/lib/supabase/server';
import { getGateExemplarBooks } from '@/lib/books/queries';
import type { GateExemplar } from '@/lib/books/types';

interface NovaKnihaPageProps {
  searchParams: Promise<{ q?: string; from?: string; essayId?: string }>;
}

/**
 * Examples on the gate are illustration, not function — failing to load them is
 * never a reason to block someone from adding a book.
 */
async function loadExemplars(): Promise<GateExemplar[]> {
  try {
    const supabase = await createClient();
    return await getGateExemplarBooks(supabase);
  } catch (error) {
    console.error('[nova-kniha] gate exemplars failed to load', error);
    return [];
  }
}

export default async function NovaKnihaPage({ searchParams }: NovaKnihaPageProps) {
  const { q, from, essayId } = await searchParams;

  const cameFromEssay = from === 'esej' && Boolean(essayId);
  const backHref = cameFromEssay ? `/cteni/eseje/${essayId}/upravit` : '/cteni/hledat';
  const backLabel = cameFromEssay ? 'Zpět k eseji' : 'Zpět do hledání';

  const exemplars = await loadExemplars();

  return (
    <PageShell size="narrow">
      <Button variant="ghost" asChild className="gap-2">
        <Link href={backHref}>
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
      </Button>

      {/* No subtitle: the flow map below states the steps and who approves. */}
      <h1 className="font-heading text-2xl font-bold">Přidat knihu do BOBa</h1>

      <AddBookFlow
        initialQuery={q ?? ''}
        exemplars={exemplars}
        returnTo={cameFromEssay ? `/cteni/eseje/${essayId}/upravit` : null}
      />
    </PageShell>
  );
}
