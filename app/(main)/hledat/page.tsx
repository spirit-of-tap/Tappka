import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getTeamReadingLists } from '@/lib/books/team-lists';
import { getEssays } from '@/lib/essays/queries';
import { getBooks } from '@/lib/books/queries';
import { SearchPageClient } from '@/components/search/search-page-client';

export default async function HledatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });

  const [teamLists, popularEssays, topBooks] = await Promise.all([
    getTeamReadingLists(supabase),
    getEssays(supabase, { sort: 'week', pageSize: 8 }),
    getBooks(supabase, { sortBy: 'popular', status: 'approved', pageSize: 10 }),
  ]);

  const votedIds = new Set<string>();
  if (profile && popularEssays.length > 0) {
    const { data } = await supabase
      .from('essay_votes')
      .select('essay_id')
      .in('essay_id', popularEssays.map((e) => e.id))
      .eq('voter_profile_id', profile.id);
    data?.forEach((v: { essay_id: string }) => votedIds.add(v.essay_id));
  }

  const popularWithVoted = popularEssays.map((e) => ({ ...e, user_has_voted: votedIds.has(e.id) }));

  return (
    <SearchPageClient
      teamLists={teamLists}
      popularEssays={popularWithVoted}
      topBooks={topBooks}
      hasTeam={!!profile?.team_id}
    />
  );
}
