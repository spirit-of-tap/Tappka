import { EssayEditorForm } from '@/components/essays/essay-editor-form';
import { PageShell } from '@/components/ui/page-shell';

export default function NovaEsejPage() {
  return (
    <PageShell size="wide">
      {/* The visible document title is the editor's own title field, so the
          page heading only needs to exist for assistive technology. */}
      <h1 className="sr-only">Napsat esej</h1>
      <EssayEditorForm />
    </PageShell>
  );
}
