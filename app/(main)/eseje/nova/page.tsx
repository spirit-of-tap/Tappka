import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EssayEditorForm } from '@/components/essays/essay-editor-form';

export default function NovaEsejPage() {
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-3xl">
      <Button variant="ghost" asChild className="gap-2">
        <Link href="/eseje">
          <ArrowLeft className="size-4" />
          Zpět na eseje
        </Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Napsat esej</h1>
        <p className="text-sm text-muted-foreground">Popiš, co tě kniha naučila nebo jak tě ovlivnila.</p>
      </div>
      <EssayEditorForm />
    </div>
  );
}
