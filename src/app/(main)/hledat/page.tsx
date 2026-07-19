import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssays } from '@/lib/essays/queries';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import { SearchPageClient } from '@/components/search/search-page-client';

export default async function HledatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });

  const [popularEssays, categoryRows, teamRows] = await Promise.all([
    getEssays(supabase, { sort: 'week', pageSize: 8 }),
    supabase.rpc('get_best_books_per_category', { top_n: 3 }),
    supabase.rpc('get_teams_with_member_stats'),
  ]);

  type CategoryBook = { tag: string; id: string; title: string; author: string; cover_path: string | null; description: string | null; preview_link: string | null; tags: string[]; book_points: number; essay_count: number };
  const categoryBestBooks: Record<string, CategoryBook[]> = {};
  for (const row of (categoryRows.data ?? []) as CategoryBook[]) {
    if (!(row.tag in BOOK_CATEGORY_LABELS)) continue;
    (categoryBestBooks[row.tag] ??= []).push(row);
  }

  type MemberRow = { team_id: string; team_name: string; profile_id: string; profile_name: string; profile_picture: string | null; essay_count: number; book_points: number };
  type TeamWithMembers = { id: string; name: string; members: Omit<MemberRow, 'team_id' | 'team_name'>[] };
  const teamsMap = new Map<string, TeamWithMembers>();
  for (const row of (teamRows.data ?? []) as MemberRow[]) {
    if (!teamsMap.has(row.team_id)) teamsMap.set(row.team_id, { id: row.team_id, name: row.team_name, members: [] });
    teamsMap.get(row.team_id)!.members.push({ profile_id: row.profile_id, profile_name: row.profile_name, profile_picture: row.profile_picture, essay_count: row.essay_count, book_points: row.book_points });
  }
  const teamsWithMembers = Array.from(teamsMap.values());

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
      popularEssays={popularWithVoted}
      categoryBestBooks={categoryBestBooks}
      teamsWithMembers={teamsWithMembers}
    />
  );
}
