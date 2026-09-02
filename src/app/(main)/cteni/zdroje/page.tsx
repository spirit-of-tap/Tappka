import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, Inbox } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getContentSources } from '@/lib/content-sources/queries';
import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { ContentSourceCard } from '@/components/content-sources/content-source-card';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty';

export default async function ZdrojePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const sources = await getContentSources(supabase, { pageSize: 60 });

  return (
    <PageShell size="narrow">
      <PageHeader
        title="Ostatní zdroje"
        description="Podcasty, konference a programy, o kterých můžeš napsat esej."
        action={
          <Button asChild size="sm" className="gap-2 shrink-0">
            <Link href="/cteni/zdroje/nova">
              <Plus className="size-4" />
              Přidat zdroj
            </Link>
          </Button>
        }
      />
      {sources.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Inbox className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Zatím žádné zdroje</EmptyTitle>
            <EmptyDescription>Buď první, kdo přidá podcast, konferenci nebo program.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => <ContentSourceCard key={source.id} source={source} />)}
        </div>
      )}
    </PageShell>
  );
}
