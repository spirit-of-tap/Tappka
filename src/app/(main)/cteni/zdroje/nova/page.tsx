import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/ui/page-header';
import { ContentSourceForm } from '@/components/content-sources/content-source-form';

export default function NovyZdrojPage() {
  return (
    <PageShell size="narrow">
      <PageHeader title="Přidat zdroj" description="Podcast, konference, program a další zdroje mimo knihy." />
      <ContentSourceForm />
    </PageShell>
  );
}
