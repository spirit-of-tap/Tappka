import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';
import { AddBookFlow } from '@/components/books/add-book/add-book-flow';
import { parseLibraryLabelCode } from '@/lib/library/label-code';

export const metadata = {
  title: 'Přidat knihu do BOBa | Tappka',
};

interface NovaKnihaPageProps {
  searchParams: Promise<{
    q?: string;
    from?: string;
    essayId?: string;
    label?: string;
  }>;
}

export default async function NovaKnihaPage({ searchParams }: NovaKnihaPageProps) {
  const { q, from, essayId, label } = await searchParams;

  const cameFromEssay = from === 'esej' && Boolean(essayId);
  const labelCode = from === 'knihovna-stitky' && label
    ? parseLibraryLabelCode(label)
    : null;
  const libraryReturnTo = labelCode == null ? null : `/knihovna/stitky?label=${labelCode}`;
  const essayReturnTo = cameFromEssay ? `/cteni/eseje/${essayId}/upravit` : null;
  const returnTo = libraryReturnTo ?? essayReturnTo;
  const backHref = returnTo ?? '/cteni/hledat';
  const backLabel = libraryReturnTo
    ? 'Zpět ke štítku'
    : cameFromEssay
      ? 'Zpět k eseji'
      : 'Zpět do hledání';

  return (
    <PageShell size="narrow">
      {/* No subtitle: the flow map below states the steps and who approves. */}
      <PageHeader title="Přidat knihu do BOBa" back={{ href: backHref, label: backLabel }} />

      <AddBookFlow
        initialQuery={q ?? ''}
        returnTo={returnTo}
        discardHref={backHref}
      />
    </PageShell>
  );
}
