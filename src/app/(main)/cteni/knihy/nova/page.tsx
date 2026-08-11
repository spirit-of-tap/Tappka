import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/ui/page-shell';
import { AddBookFlow } from '@/components/books/add-book/add-book-flow';

interface NovaKnihaPageProps {
  searchParams: Promise<{ q?: string; from?: string; essayId?: string }>;
}

export default async function NovaKnihaPage({ searchParams }: NovaKnihaPageProps) {
  const { q, from, essayId } = await searchParams;

  const cameFromEssay = from === 'esej' && Boolean(essayId);
  const backHref = cameFromEssay ? `/cteni/eseje/${essayId}/upravit` : '/cteni/hledat';
  const backLabel = cameFromEssay ? 'Zpět k eseji' : 'Zpět do hledání';

  return (
    <PageShell size="narrow">
      <Button variant="ghost" asChild className="gap-2">
        <Link href={backHref}>
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Přidat knihu do BOBa</h1>
        <p className="text-sm text-muted-foreground">
          Projdeme to spolu ve čtyřech krocích. Kouč knihu nakonec schválí a přidělí body.
        </p>
      </div>

      <AddBookFlow
        initialQuery={q ?? ''}
        returnTo={cameFromEssay ? `/cteni/eseje/${essayId}/upravit` : null}
      />
    </PageShell>
  );
}
