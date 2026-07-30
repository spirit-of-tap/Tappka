import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { MyLoansList } from '@/components/library/my-loans-list';
import { PageShell } from '@/components/ui/page-shell';

export const metadata = {
  title: 'Moje výpůjčky',
};

export default async function MyLoansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <PageShell size="narrow" className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Moje výpůjčky</h1>
      <MyLoansList />
    </PageShell>
  );
}
