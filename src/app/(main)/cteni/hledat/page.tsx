import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssays } from '@/lib/essays/queries';
import { getRocketModelBooks, getHighlightedBooks, getHighlightCategories } from '@/lib/books/queries';
import { groupHighlightedBooks } from '@/lib/books/highlight-groups';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import type { BookListStatus, HighlightCategory } from '@/lib/books/types';
import { SearchPageClient } from '@/components/search/search-page-client';

export default async function HledatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });

  const [popularEssays, categoryRows, teamRows, rocketModelBooks, highlightedBooks, highlightCategories] = await Promise.all([
    getEssays(supabase, { sort: 'month', pageSize: 8 }),
    supabase.rpc('get_best_books_per_category', { top_n: 3 }),
    supabase.rpc('get_teams_with_member_stats'),
    getRocketModelBooks(supabase),
    getHighlightedBooks(supabase),
    getHighlightCategories(supabase),
  ]);

  type CategoryBook = { tag: string; id: string; title: string; author: string; cover_path: string | null; description: string | null; preview_link: string | null; tags: string[]; book_points: number; essay_count: number; list_status: BookListStatus; is_rocket_model: boolean; highlight_category: HighlightCategory | null };
  const categoryBestBooks: Record<string, CategoryBook[]> = {};
  for (const row of (categoryRows.data ?? []) as unknown as CategoryBook[]) {
    if (!(row.tag in BOOK_CATEGORY_LABELS)) continue;
    (categoryBestBooks[row.tag] ??= []).push(row);
  }

  const categoryBookIds = Array.from(new Set(Object.values(categoryBestBooks).flat().map((b) => b.id)));
  const { data: statusRows } = categoryBookIds.length > 0
    ? await supabase
        .from('books')
        .select('id, list_status, is_rocket_model, highlight_category:highlight_categories(*)')
        .in('id', categoryBookIds)
    : { data: [] };
  const statusById = new Map<string, Pick<CategoryBook, 'list_status' | 'is_rocket_model' | 'highlight_category'>>();
  for (const row of (statusRows ?? []) as unknown as Array<{ id: string; list_status: BookListStatus; is_rocket_model: boolean; highlight_category: HighlightCategory | HighlightCategory[] | null }>) {
    statusById.set(row.id, {
      list_status: row.list_status,
      is_rocket_model: row.is_rocket_model,
      highlight_category: Array.isArray(row.highlight_category) ? (row.highlight_category[0] ?? null) : (row.highlight_category ?? null),
    });
  }
  for (const tag of Object.keys(categoryBestBooks)) {
    categoryBestBooks[tag] = categoryBestBooks[tag].map((book) => ({
      ...book,
      ...(statusById.get(book.id) ?? { list_status: 'shortlist', is_rocket_model: false, highlight_category: null }),
    }));
  }

  const highlightedByCategory = groupHighlightedBooks(highlightedBooks, highlightCategories);

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
      rocketModelBooks={rocketModelBooks}
      highlightedByCategory={highlightedByCategory}
    />
  );
}
