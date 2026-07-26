import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getPendingBooks, getRejectedBooks } from '@/lib/books/queries';
import { CoachDashboard } from '@/components/books/coach-dashboard';

export default async function KnihaKnihSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile || (profile.role !== 'coach' && profile.role !== 'admin')) {
    redirect('/');
  }

  const [pendingBooks, rejectedBooks] = await Promise.all([
    getPendingBooks(supabase),
    getRejectedBooks(supabase),
  ]);

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Správa knihovny</h1>
        <p className="text-muted-foreground text-sm">Schvaluj nebo zamítej knihy navržené studenty.</p>
      </div>
      <CoachDashboard initialPending={pendingBooks} initialRejected={rejectedBooks} />
    </div>
  );
}
