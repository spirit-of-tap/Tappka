import { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/lib/supabase/database.types';

import { contentTextFromJson } from './content-text';
import type {
  EssayWithDetails,
  EssayCommentWithAuthor,
  EssayViewWithProfile,
  EssayCoachReadWithProfile,
  CoachReviewEssay,
  EssayFilters,
} from './types';

const PAGE_SIZE_DEFAULT = 20;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

const ESSAY_DETAIL_SELECT = `
  *,
  essay_revisions(title, content_json, revision_no, invalid_since),
  essay_votes(count),
  essay_views(count),
  essay_comments(count),
  author:profiles!author_profile_id(id, name, picture, role),
  book:books!book_id(id, title_cs, author, book_points, status, google_books_cover_url)
`;

interface EssayRevisionEmbed {
  title: string;
  content_json: Json;
  revision_no: number;
  invalid_since: string | null;
}

interface CountEmbed {
  count: number;
}

interface EssayRawRow {
  id: string;
  author_profile_id: string;
  book_id: string | null;
  published_at: string | null;
  pinned_at: string | null;
  pinned_by_profile_id: string | null;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
  created_by_profile_id: string;
  updated_by_profile_id: string;
  essay_revisions?: EssayRevisionEmbed[] | null;
  essay_votes?: CountEmbed[] | null;
  essay_views?: CountEmbed[] | null;
  essay_comments?: CountEmbed[] | null;
  author: EssayWithDetails['author'];
  book: EssayWithDetails['book'];
}

/**
 * Picks the latest non-invalid essay revision (highest revision_no).
 */
export function pickLatestRevision(
  revisions: EssayRevisionEmbed[] | null | undefined,
): EssayRevisionEmbed | null {
  const valid = (revisions ?? []).filter((r) => r.invalid_since == null);
  if (valid.length === 0) return null;

  return valid.reduce((best, row) => (row.revision_no > best.revision_no ? row : best));
}

/**
 * Maps raw PostgREST essay rows (with revision + count embeds) to EssayWithDetails.
 */
function mapEssayRows(rows: EssayRawRow[]): EssayWithDetails[] {
  return rows.map((row) => {
    const {
      essay_revisions,
      essay_votes,
      essay_views,
      essay_comments,
      created_by_profile_id: _createdBy,
      updated_by_profile_id: _updatedBy,
      ...rest
    } = row;

    const revision = pickLatestRevision(essay_revisions);
    const content_json = (revision?.content_json ?? {}) as object;

    return {
      ...rest,
      title: revision?.title ?? '',
      content_json,
      content_text: contentTextFromJson(content_json),
      vote_count: Number(essay_votes?.[0]?.count ?? 0),
      view_count: Number(essay_views?.[0]?.count ?? 0),
      comment_count: Number(essay_comments?.[0]?.count ?? 0),
    };
  });
}

/**
 * Sorts essays by vote_count desc, then created_at desc (within current page).
 */
function sortByVotesThenCreated(essays: EssayWithDetails[]): EssayWithDetails[] {
  return [...essays].sort((a, b) => {
    if (b.vote_count !== a.vote_count) return b.vote_count - a.vote_count;
    return b.created_at.localeCompare(a.created_at);
  });
}

/**
 * Resolves essay IDs whose latest-ish revisions match a title search.
 * Searches all non-invalid revisions (may match older titles).
 */
async function findEssayIdsByTitleSearch(
  supabase: SupabaseClient<Database>,
  search: string,
): Promise<string[]> {
  const safe = search.replace(/[%_]/g, '\\$&');
  const { data, error } = await supabase
    .from('essay_revisions')
    .select('essay_id')
    .ilike('title', `%${safe}%`)
    .is('invalid_since', null);

  if (error) throw error;

  return [...new Set((data ?? []).map((row: { essay_id: string }) => row.essay_id))];
}

/** Active student profile ids in a team, excluding the given profile. */
async function getTeamStudentIds(
  supabase: SupabaseClient<Database>,
  teamId: string,
  excludeProfileId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('team_id', teamId)
    .eq('role', 'student')
    .is('access_removed_at', null)
    .neq('id', excludeProfileId);

  if (error) throw error;
  return (data ?? []).map((p: { id: string }) => p.id);
}

export async function getEssays(
  supabase: SupabaseClient<Database>,
  filters?: EssayFilters,
): Promise<EssayWithDetails[]> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? PAGE_SIZE_DEFAULT;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sort = filters?.sort ?? 'recent';

  let tagBookIds: string[] | null = null;
  if (filters?.tag) {
    const { data: tagRow, error: tagLookupError } = await supabase
      .from('tags')
      .select('id')
      .eq('name', filters.tag)
      .maybeSingle();
    if (tagLookupError) throw tagLookupError;
    if (!tagRow) return [];

    const { data: taggedBooks, error: tagError } = await supabase
      .from('book_tags')
      .select('book_id')
      .eq('tag_id', tagRow.id);
    if (tagError) throw tagError;
    tagBookIds = [...new Set((taggedBooks ?? []).map((b: { book_id: string }) => b.book_id))];
    if (tagBookIds.length === 0) return [];
  }

  let searchEssayIds: string[] | null = null;
  if (filters?.search?.trim()) {
    searchEssayIds = await findEssayIdsByTitleSearch(supabase, filters.search.trim());
    if (searchEssayIds.length === 0) return [];
  }

  let query = supabase
    .from('essays')
    .select(ESSAY_DETAIL_SELECT)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .range(from, to);

  if (sort === 'week') {
    const oneWeekAgo = new Date(Date.now() - MS_PER_WEEK).toISOString();
    query = query
      .gte('created_at', oneWeekAgo)
      .order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  if (filters?.authorProfileId) {
    query = query.eq('author_profile_id', filters.authorProfileId);
  }

  if (filters?.bookId) {
    query = query.eq('book_id', filters.bookId);
  }

  if (tagBookIds) {
    query = query.in('book_id', tagBookIds);
  }

  if (searchEssayIds) {
    query = query.in('id', searchEssayIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const essays = mapEssayRows((data ?? []) as unknown as EssayRawRow[]);

  if (sort === 'best' || sort === 'week') {
    return sortByVotesThenCreated(essays);
  }

  return essays;
}

export async function getEssaysByTeam(
  supabase: SupabaseClient<Database>,
  teamId: string,
  filters?: Pick<EssayFilters, 'page' | 'pageSize' | 'search'>,
): Promise<EssayWithDetails[]> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? PAGE_SIZE_DEFAULT;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: teamProfiles, error: teamError } = await supabase
    .from('profiles')
    .select('id')
    .eq('team_id', teamId)
    .is('access_removed_at', null);

  if (teamError) throw teamError;

  const profileIds = (teamProfiles ?? []).map((p: { id: string }) => p.id);
  if (profileIds.length === 0) return [];

  let searchEssayIds: string[] | null = null;
  if (filters?.search?.trim()) {
    searchEssayIds = await findEssayIdsByTitleSearch(supabase, filters.search.trim());
    if (searchEssayIds.length === 0) return [];
  }

  let teamQuery = supabase
    .from('essays')
    .select(ESSAY_DETAIL_SELECT)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .in('author_profile_id', profileIds)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchEssayIds) {
    teamQuery = teamQuery.in('id', searchEssayIds);
  }

  const { data, error } = await teamQuery;
  if (error) throw error;

  return mapEssayRows((data ?? []) as unknown as EssayRawRow[]);
}

export async function getEssayById(
  supabase: SupabaseClient<Database>,
  essayId: string,
): Promise<EssayWithDetails | null> {
  const { data, error } = await supabase
    .from('essays')
    .select(ESSAY_DETAIL_SELECT)
    .eq('id', essayId)
    .is('removed_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const rows = mapEssayRows([data as unknown as EssayRawRow]);
  return rows[0] ?? null;
}

export async function getEssayComments(
  supabase: SupabaseClient<Database>,
  essayId: string,
): Promise<EssayCommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('essay_comments')
    .select(`
      *,
      author:profiles!author_profile_id(id, name, picture, role)
    `)
    .eq('essay_id', essayId)
    .is('removed_at', null)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as EssayCommentWithAuthor[];
}

export async function getEssayCoachViewers(
  supabase: SupabaseClient<Database>,
  essayId: string,
): Promise<EssayViewWithProfile[]> {
  const { data, error } = await supabase
    .from('essay_views')
    .select(`
      *,
      viewer:profiles!viewer_profile_id(id, name, role)
    `)
    .eq('essay_id', essayId);

  if (error) throw error;

  return ((data ?? []) as EssayViewWithProfile[]).filter(
    (v) => v.viewer?.role === 'coach' || v.viewer?.role === 'admin',
  );
}

export async function getUnreadTeamEssaysForCoach(
  supabase: SupabaseClient<Database>,
  coachProfileId: string,
  teamId: string,
): Promise<CoachReviewEssay[]> {
  const studentIds = await getTeamStudentIds(supabase, teamId, coachProfileId);
  if (studentIds.length === 0) return [];

  const { data: reads, error: readsError } = await supabase
    .from('essay_coach_reads')
    .select('essay_id')
    .eq('coach_profile_id', coachProfileId);
  if (readsError) throw readsError;
  const readIds = (reads ?? []).map((r: { essay_id: string }) => r.essay_id);

  let query = supabase
    .from('essays')
    .select(ESSAY_DETAIL_SELECT)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .in('author_profile_id', studentIds)
    .order('created_at', { ascending: false });

  if (readIds.length > 0) {
    query = query.not('id', 'in', `(${readIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return mapEssayRows((data ?? []) as unknown as EssayRawRow[]).map((essay) => ({
    ...essay,
    read_at: null,
  }));
}

export async function getReadTeamEssaysForCoach(
  supabase: SupabaseClient<Database>,
  coachProfileId: string,
  teamId: string,
): Promise<CoachReviewEssay[]> {
  const studentIds = await getTeamStudentIds(supabase, teamId, coachProfileId);
  if (studentIds.length === 0) return [];

  const { data: reads, error: readsError } = await supabase
    .from('essay_coach_reads')
    .select('essay_id, read_at')
    .eq('coach_profile_id', coachProfileId)
    .order('read_at', { ascending: false });
  if (readsError) throw readsError;

  const readRows = (reads ?? []) as { essay_id: string; read_at: string }[];
  if (readRows.length === 0) return [];

  const readAtById = new Map(readRows.map((r) => [r.essay_id, r.read_at]));

  const { data, error } = await supabase
    .from('essays')
    .select(ESSAY_DETAIL_SELECT)
    .in('id', readRows.map((r) => r.essay_id))
    .in('author_profile_id', studentIds)
    .is('removed_at', null);
  if (error) throw error;

  return mapEssayRows((data ?? []) as unknown as EssayRawRow[])
    .map((essay) => ({ ...essay, read_at: readAtById.get(essay.id) ?? null }))
    .sort((a, b) => (b.read_at ?? '').localeCompare(a.read_at ?? ''));
}

export async function getCoachUnreadCount(
  supabase: SupabaseClient<Database>,
  coachProfileId: string,
  teamId: string,
): Promise<number> {
  const studentIds = await getTeamStudentIds(supabase, teamId, coachProfileId);
  if (studentIds.length === 0) return 0;

  const { data: reads, error: readsError } = await supabase
    .from('essay_coach_reads')
    .select('essay_id')
    .eq('coach_profile_id', coachProfileId);
  if (readsError) throw readsError;
  const readIds = (reads ?? []).map((r: { essay_id: string }) => r.essay_id);

  let query = supabase
    .from('essays')
    .select('id', { count: 'exact', head: true })
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .in('author_profile_id', studentIds);

  if (readIds.length > 0) {
    query = query.not('id', 'in', `(${readIds.join(',')})`);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getEssayCoachReads(
  supabase: SupabaseClient<Database>,
  essayId: string,
): Promise<EssayCoachReadWithProfile[]> {
  const { data, error } = await supabase
    .from('essay_coach_reads')
    .select(`
      *,
      coach:profiles!coach_profile_id(id, name, role)
    `)
    .eq('essay_id', essayId)
    .order('read_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as EssayCoachReadWithProfile[];
}

export async function getUserBookPointsStats(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<{ approved_points: number; pending_points: number; essay_count: number }> {
  const { data: essays, error } = await supabase
    .from('essays')
    .select('book_id, books!inner(book_points, status)')
    .eq('author_profile_id', profileId)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('book_id', 'is', null);

  if (error) throw error;

  type Row = { book_id: string; books: { book_points: number; status: string } };

  const approved = new Map<string, number>();
  const pending = new Set<string>();

  for (const row of (essays ?? []) as unknown as Row[]) {
    if (!row.book_id) continue;
    if (row.books.status === 'approved') {
      approved.set(row.book_id, Number(row.books.book_points));
    } else if (row.books.status === 'pending') {
      pending.add(row.book_id);
    }
  }

  const approved_points = Array.from(approved.values()).reduce((s, p) => s + p, 0);

  const { count } = await supabase
    .from('essays')
    .select('*', { count: 'exact', head: true })
    .eq('author_profile_id', profileId)
    .not('published_at', 'is', null)
    .is('removed_at', null);

  return { approved_points, pending_points: pending.size, essay_count: count ?? 0 };
}

export async function getTeamBookPointsStats(
  supabase: SupabaseClient<Database>,
  teamId: string,
): Promise<{ profile: { id: string; name: string; picture: string | null }; approved_points: number; pending_points: number }[]> {
  const { data: teamProfiles, error: teamError } = await supabase
    .from('profiles')
    .select('id, name, picture')
    .eq('team_id', teamId)
    .is('access_removed_at', null);

  if (teamError) throw teamError;
  if (!teamProfiles || teamProfiles.length === 0) return [];

  const profileIds = teamProfiles.map((p: { id: string }) => p.id);

  const { data: essays, error: essayError } = await supabase
    .from('essays')
    .select('author_profile_id, book_id, books!inner(book_points, status)')
    .in('author_profile_id', profileIds)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('book_id', 'is', null);

  if (essayError) throw essayError;

  type EssayRow = {
    author_profile_id: string;
    book_id: string;
    books: { book_points: number; status: string };
  };

  const byProfile: Record<string, { approved: Set<string>; pending: Set<string> }> = {};
  for (const profileId of profileIds) {
    byProfile[profileId] = { approved: new Set(), pending: new Set() };
  }

  for (const essay of (essays ?? []) as unknown as EssayRow[]) {
    const bucket = byProfile[essay.author_profile_id];
    if (!bucket || !essay.book_id) continue;
    if (essay.books.status === 'approved') {
      bucket.approved.add(essay.book_id);
    } else if (essay.books.status === 'pending') {
      bucket.pending.add(essay.book_id);
    }
  }

  const { data: approvedBooks, error: booksError } = await supabase
    .from('books')
    .select('id, book_points')
    .eq('status', 'approved');

  if (booksError) throw booksError;

  const pointsMap: Record<string, number> = {};
  for (const book of (approvedBooks ?? []) as { id: string; book_points: number }[]) {
    pointsMap[book.id] = Number(book.book_points);
  }

  return teamProfiles.map((profile) => {
    const bucket = byProfile[profile.id];
    let approved_points = 0;
    let pending_points = 0;

    for (const bookId of bucket.approved) {
      approved_points += pointsMap[bookId] ?? 0;
    }
    pending_points = bucket.pending.size;

    return {
      profile: {
        id: profile.id,
        name: profile.name ?? '',
        picture: profile.picture,
      },
      approved_points,
      pending_points,
    };
  });
}
