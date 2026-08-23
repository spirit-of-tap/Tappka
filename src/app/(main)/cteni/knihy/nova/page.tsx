import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';
import { AddBookFlow } from '@/components/books/add-book/add-book-flow';

export const metadata = {
  title: 'Přidat knihu do BOBa | Tappka',
};

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
      {/* No subtitle: the flow map below states the steps and who approves. */}
      <PageHeader title="Přidat knihu do BOBa" back={{ href: backHref, label: backLabel }} />

      <AddBookFlow
        initialQuery={q ?? ''}
        returnTo={cameFromEssay ? `/cteni/eseje/${essayId}/upravit` : null}
        discardHref={backHref}
      />
    </PageShell>
  );
}
