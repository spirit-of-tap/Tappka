import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddBookWizard } from '@/components/books/add-book-wizard';

export default function NovaKnihaPage() {
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-2xl">
      <Button variant="ghost" asChild className="gap-2">
        <Link href="/hledat">
          <ArrowLeft className="size-4" />
          Zpět do knihovny
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
    </div>
  );
}
