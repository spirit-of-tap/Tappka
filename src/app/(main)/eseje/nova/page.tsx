import { BackButton } from '@/components/essays/back-button';
import { EssayEditorForm } from '@/components/essays/essay-editor-form';

export default function NovaEsejPage() {
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-3xl">
      <BackButton />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Napsat esej</h1>
        <p className="text-sm text-muted-foreground">Popiš, co tě kniha naučila nebo jak tě ovlivnila.</p>
      </div>
      <EssayEditorForm />
    </div>
  );
}
