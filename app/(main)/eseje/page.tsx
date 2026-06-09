import Link from 'next/link';
import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssays } from '@/lib/essays/queries';
import { EssayCard } from '@/components/essays/essay-card';
import { LoadMoreEssays } from '@/components/essays/load-more-essays';
import { EssaySearch } from '@/components/essays/essay-search';
import { TopicPills } from '@/components/essays/topic-pills';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EssaySortOrder } from '@/lib/essays/types';

interface PageProps {
  searchParams: Promise<{ q?: string; sort?: string; tag?: string }>;
}

const SORT_OPTIONS: { value: EssaySortOrder; label: string }[] = [
  { value: 'recent', label: 'Nejnovější' },
  { value: 'week',   label: 'Tento týden' },
  { value: 'best',   label: 'Nejlepší' },
];

export default async function EsejePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sort = (params.sort ?? 'recent') as EssaySortOrder;
  const tag = params.tag;
  const search = params.q;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getCurrentUserProfile(supabase, { user }) : null;

  const [essays, votesResult] = await Promise.all([
    getEssays(supabase, { sort, tag, search }),
    profile
      ? supabase.from('essay_votes').select('essay_id').eq('voter_profile_id', profile.id)
      : Promise.resolve({ data: [] as { essay_id: string }[] }),
  ]);

  const votedIds = new Set(
    (votesResult.data ?? []).map((v) => v.essay_id),
  );

  return (
    <div className="container mx-auto py-6 space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Eseje</h1>
          <p className="text-muted-foreground">Praktické znalosti z přečtených knih</p>
        </div>
        <Button asChild>
          <Link href="/eseje/nova">
            <Plus className="size-4 mr-2" />
            Napsat
          </Link>
        </Button>
      </div>

      <Suspense>
        <EssaySearch />
      </Suspense>

      <Suspense>
        <TopicPills />
      </Suspense>

      <div className="flex items-center gap-1">
        {SORT_OPTIONS.map(({ value, label }) => {
          const newParams = new URLSearchParams();
          if (search) newParams.set('q', search);
          if (tag) newParams.set('tag', tag);
          if (value !== 'recent') newParams.set('sort', value);
          const href = `?${newParams.toString()}`;
          return (
            <Link
              key={value}
              href={href}
              className={cn(
                'text-sm px-3 py-1 rounded-full transition-colors',
                sort === value
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {essays.map((essay) => (
          <EssayCard
            key={essay.id}
            essay={essay}
            showVoteButton={!!profile}
            initialVoted={votedIds.has(essay.id)}
          />
        ))}
        <Suspense>
          <LoadMoreEssays
            initialPage={1}
            view="vse"
            q={search}
            sort={sort}
            tag={tag}
            showVoteButton={!!profile}
          />
        </Suspense>
      </div>
    </div>
  );
}
