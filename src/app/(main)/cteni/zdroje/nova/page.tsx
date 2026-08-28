import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/ui/page-header';
import { ContentSourceForm } from '@/components/content-sources/content-source-form';

interface NovyZdrojPageProps {
  searchParams: Promise<{ q?: string; from?: string; essayId?: string }>;
}

export default async function NovyZdrojPage({ searchParams }: NovyZdrojPageProps) {
  const { q, from, essayId } = await searchParams;

  const cameFromEssay = from === 'esej' && Boolean(essayId);
  const backHref = cameFromEssay ? `/cteni/eseje/${essayId}/upravit` : '/cteni/hledat';
  const backLabel = cameFromEssay ? 'Zpět k eseji' : 'Zpět do hledání';

  return (
    <PageShell size="narrow">
      <PageHeader
        title="Přidat zdroj"
        description="Podcast, konference, program a další zdroje mimo knihy."
        back={{ href: backHref, label: backLabel }}
      />
      <ContentSourceForm
        initialTitle={q ?? ''}
        returnTo={cameFromEssay ? `/cteni/eseje/${essayId}/upravit` : null}
      />
    </PageShell>
  );
}
