import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { listActiveFeedback, listArchivedFeedback } from '@/lib/feedback/queries';
import { FeedbackBoard } from '@/components/feedback/feedback-board';
import { PageShell } from '@/components/ui/page-shell';

export default async function ZpetnaVazbaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  const isAdmin = profile?.role === 'admin';

  const [active, archived] = await Promise.all([
    listActiveFeedback(supabase),
    listArchivedFeedback(supabase),
  ]);

  return (
    <PageShell size="wide">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Zpětná vazba</h1>
        <p className="text-sm text-muted-foreground">
          Napiš nám, co máš na srdci. Čteme všechno a snažíme se s tím pracovat.
        </p>
      </div>

      <FeedbackBoard initialActive={active} initialArchived={archived} isAdmin={isAdmin} />
    </PageShell>
  );
}
