import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getContentSourceById } from '@/lib/content-sources/queries';
import { getEssays } from '@/lib/essays/queries';
import { ContentSourceIllustration } from '@/components/content-sources/content-source-illustration';
import { BookDescription } from '@/components/books/book-description';
import { BookEssaysList } from '@/components/books/book-essays-list';
import { Button } from '@/components/ui/button';
import { PageBack } from '@/components/ui/page-back';
import { PageShell } from '@/components/ui/page-shell';
import { CONTENT_SOURCE_KIND_LABELS } from '@/lib/content-sources/types';
import { formatPointsWithLabel } from '@/lib/books/points';

export const metadata = {
  title: 'Detail zdroje',
};

const ALL_ESSAYS_PAGE_SIZE = 500;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContentSourceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [source, essays] = await Promise.all([
    getContentSourceById(supabase, id),
    getEssays(supabase, { contentSourceId: id, pageSize: ALL_ESSAYS_PAGE_SIZE, sort: 'best' }),
  ]);

  if (!source) notFound();

  return (
    <PageShell size="wide" className="space-y-8">
      <PageBack href="/cteni/zdroje" label="Zpět na zdroje" />

      {/* Hero */}
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <div className="mx-auto shrink-0 sm:mx-0">
          <ContentSourceIllustration kind={source.kind} className="size-44 rounded-xl" />
          {source.external_url && (
            <Button asChild variant="outline" className="w-44 mt-3">
              <a
                href={source.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-2"
              >
                Otevřít
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold leading-tight tracking-tight">{source.title}</h1>
            <p className="text-lg text-muted-foreground">
              {CONTENT_SOURCE_KIND_LABELS[source.kind]}
              {source.creator ? ` · ${source.creator}` : ''}
            </p>
          </div>

          {source.points != null && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">
                {formatPointsWithLabel(source.points)}
              </span>
            </div>
          )}

          {source.description && (
            <div className="border-t border-border/60 pt-4">
              <BookDescription text={source.description} />
            </div>
          )}
        </div>
      </div>

      {/* Essays */}
      {essays.length > 0 && (
        <div className="border-t border-border/60 pt-6">
          <h2 className="text-base font-bold mb-4">Co o zdroji napsali ostatní ({essays.length})</h2>
          <BookEssaysList essays={essays} />
        </div>
      )}
    </PageShell>
  );
}
