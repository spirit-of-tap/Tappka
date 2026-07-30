import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { redirect } from 'next/navigation';
import { LibraryImportScanner } from '@/components/library/library-import-scanner';
import { PageShell } from '@/components/ui/page-shell';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Import knih do TAP Knihovny',
};

export default async function LibraryImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  const isCoachOrAdmin = profile?.role === 'coach' || profile?.role === 'admin';

  if (!isCoachOrAdmin) redirect('/hledat');

  return (
    <PageShell size="narrow" className="space-y-6">
      <Button variant="ghost" asChild className="gap-2 -ml-2">
        <Link href="/hledat">
          <ArrowLeft className="size-4" />
          Zpět do hledání
        </Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Import knih do TAP Knihovny</h1>
        <p className="text-sm text-muted-foreground">
          Naskenujte ISBN nebo vyhledejte knihu v katalogu pro přidání fyzických kopií.
        </p>
      </div>
      <LibraryImportScanner />
    </PageShell>
  );
}
