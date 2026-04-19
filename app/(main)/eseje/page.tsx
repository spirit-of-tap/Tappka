import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssays, getEssaysByTeam } from '@/lib/essays/queries';
import { EssayCard } from '@/components/essays/essay-card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ESSAY_LIST_VIEW_LABELS } from '@/lib/essays/types';
import type { EssayListView } from '@/lib/essays/types';

interface PageProps {
  searchParams: Promise<{ view?: EssayListView; page?: string }>;
}

export default async function EsejePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const view = params.view ?? 'vse';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const profile = user ? await getCurrentUserProfile(supabase, { user }) : null;

  let essays;
  if (view === 'moje' && profile) {
    essays = await getEssays(supabase, { authorProfileId: profile.id });
  } else if (view === 'tym' && profile?.team_id) {
    essays = await getEssaysByTeam(supabase, profile.team_id);
  } else {
    essays = await getEssays(supabase);
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Eseje</h1>
          <p className="text-muted-foreground">Čti a piš eseje o přečtených knihách</p>
        </div>
        <Button asChild>
          <Link href="/eseje/nova">
            <Plus className="size-4 mr-2" />
            Napsat esej
          </Link>
        </Button>
      </div>

      <Tabs defaultValue={view} className="w-full">
        <TabsList>
          {(['vse', 'moje', 'tym'] as const).map((v) => (
            <TabsTrigger key={v} value={v} asChild>
              <Link href={`/eseje?view=${v}`}>{ESSAY_LIST_VIEW_LABELS[v]}</Link>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={view} className="mt-4">
          {essays.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <FileText className="size-12 mx-auto text-muted-foreground" />
              <h3 className="font-semibold text-lg">Žádné eseje</h3>
              <p className="text-sm text-muted-foreground">Buď první, kdo napíše esej</p>
              <Button asChild>
                <Link href="/eseje/nova">Napsat první esej</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {essays.map((essay) => (
                <EssayCard key={essay.id} essay={essay} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
