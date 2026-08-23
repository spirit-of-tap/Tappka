import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssays, getEssaysByTeam } from '@/lib/essays/queries';
import { getBooks, getRocketModelBooks, getHighlightedBooks, getHighlightCategories } from '@/lib/books/queries';
import { getBookIdsInLibrary } from '@/lib/library/book-ids';
import { groupHighlightedBooks } from '@/lib/books/highlight-groups';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import type { BookListStatus, HighlightCategory } from '@/lib/books/types';
import type { EssayWithDetails } from '@/lib/essays/types';
import { SearchPageClient } from '@/components/search/search-page-client';

export default async function HledatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });

  const [
    books,
    libraryBookIdsSet,
    popularEssays,
    recentEssays,
    teamEssays,
    categoryRows,
    teamRows,
    rocketModelBooks,
    highlightedBooks,
    highlightCategories,
  ] = await Promise.all([
    getBooks(supabase, { listStatus: 'shortlist', minEssayCount: 2, sortBy: 'popular', pageSize: 60 }),
    getBookIdsInLibrary(supabase),
    getEssays(supabase, { sort: 'month', pageSize: 40 }),
    getEssays(supabase, { sort: 'recent', pageSize: 40 }),
    (profile?.team_id ? getEssaysByTeam(supabase, profile.team_id, { pageSize: 40 }) : Promise.resolve([])) as Promise<EssayWithDetails[]>,
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
  const teamNamesById: Record<string, string> = {};
  const authorStatsById: Record<string, { bookPoints: number; essayCount: number; isTeamTopReader: boolean }> = {};

  const teamMembersByTeam = new Map<string, MemberRow[]>();
  for (const row of (teamRows.data ?? []) as MemberRow[]) {
    teamNamesById[row.team_id] = row.team_name;
    if (!teamMembersByTeam.has(row.team_id)) teamMembersByTeam.set(row.team_id, []);
    teamMembersByTeam.get(row.team_id)!.push(row);
  }

  for (const members of teamMembersByTeam.values()) {
    const maxPoints = Math.max(...members.map((m) => m.book_points));
    for (const m of members) {
      authorStatsById[m.profile_id] = {
        bookPoints: m.book_points,
        essayCount: m.essay_count,
        isTeamTopReader: maxPoints > 0 && m.book_points === maxPoints,
      };
    }
  }

  const allEssayIds = Array.from(
    new Set([...popularEssays, ...recentEssays, ...teamEssays].map((e) => e.id)),
  );
  const votedIds = new Set<string>();
  if (profile && allEssayIds.length > 0) {
    const { data } = await supabase
      .from('essay_votes')
      .select('essay_id')
      .in('essay_id', allEssayIds)
      .eq('voter_profile_id', profile.id);
    data?.forEach((v: { essay_id: string }) => votedIds.add(v.essay_id));
  }

  // Extract latest essays for books
  const essaysByBookId: Record<string, Array<{ id: string; title: string; author: { id: string; name: string | null; picture: string | null; team_id?: string | null } | null }>> = {};
  for (const essay of [...recentEssays, ...popularEssays, ...teamEssays]) {
    if (!essay.book_id) continue;
    const list = (essaysByBookId[essay.book_id] ??= []);
    if (list.length < 4 && !list.some((e) => e.id === essay.id)) {
      list.push({
        id: essay.id,
        title: essay.title,
        author: essay.author ? {
          id: essay.author.id,
          name: essay.author.name,
          picture: essay.author.picture,
          team_id: essay.author.team_id,
        } : null,
      });
    }
  }

  const popularWithVoted = popularEssays.map((e) => ({ ...e, user_has_voted: votedIds.has(e.id) }));
  const recentWithVoted = recentEssays.map((e) => ({ ...e, user_has_voted: votedIds.has(e.id) }));
  const teamWithVoted = teamEssays.map((e) => ({ ...e, user_has_voted: votedIds.has(e.id) }));

  const userTeamName = profile?.team_id ? teamNamesById[profile.team_id] ?? null : null;

  return (
    <SearchPageClient
      books={books}
      libraryBookIds={Array.from(libraryBookIdsSet)}
      essaysByBookId={essaysByBookId}
      popularEssays={popularWithVoted}
      recentEssays={recentWithVoted}
      teamEssays={teamWithVoted}
      teamNamesById={teamNamesById}
      authorStatsById={authorStatsById}
      userTeamName={userTeamName}
      userTeamId={profile?.team_id ?? null}
      categoryBestBooks={categoryBestBooks}
      rocketModelBooks={rocketModelBooks}
      highlightedByCategory={highlightedByCategory}
    />
  );
}
