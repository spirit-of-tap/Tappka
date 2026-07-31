import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/ui/page-shell';
import { AddBookWizard } from '@/components/books/add-book-wizard';

export default function NovaKnihaPage() {
  return (
    <PageShell size="narrow">
      <Button variant="ghost" asChild className="gap-2">
        <Link href="/cteni/hledat">
          <ArrowLeft className="size-4" />
          Zpět do hledání
        </Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Přidat knihu</h1>
        <p className="text-muted-foreground text-sm">
          Najdi knihu v katalogu nebo externích zdrojích, nebo ji zadej ručně.
          Kouč ji schválí a přidělí body.
        </p>
      </div>
      <AddBookWizard />
    </PageShell>
  );
}
