import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { listActiveFeedback, listArchivedFeedback } from '@/lib/feedback/queries';
import { FeedbackBoard } from '@/components/feedback/feedback-board';

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
    <div className="container mx-auto max-w-5xl py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Zpětná vazba</h1>
        <p className="text-sm text-muted-foreground">
          Napiš nám, co máš na srdci. Čteme všechno a snažíme se s tím pracovat.
        </p>
      </div>

      <FeedbackBoard initialActive={active} initialArchived={archived} isAdmin={isAdmin} />
    </div>
  );
}
