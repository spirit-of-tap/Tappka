import { BackButton } from '@/components/essays/back-button';
import { EssayEditorForm } from '@/components/essays/essay-editor-form';
import { PageShell } from '@/components/ui/page-shell';

export default function NovaEsejPage() {
  return (
    <PageShell size="wide" className="space-y-3 sm:space-y-4">
      {/* The visible document title is the editor's own title field, so the
          page heading only needs to exist for assistive technology. */}
      <h1 className="sr-only">Napsat esej</h1>
      <BackButton />
      <EssayEditorForm />
    </PageShell>
  );
}
