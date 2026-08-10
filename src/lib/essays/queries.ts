import { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/lib/supabase/database.types';

import { contentTextFromJson } from './content-text';
import { POINTS_ELIGIBLE_LIST_STATUSES } from '@/lib/books/types';
import type { HighlightCategory } from '@/lib/books/types';
import type {
  EssayWithDetails,
  EssayCommentWithAuthor,
  EssayViewWithProfile,
  EssayCoachReadWithProfile,
  CoachReviewEssay,
  EssayFilters,
  EssayRevisionSummary,
} from './types';

const PAGE_SIZE_DEFAULT = 20;
/** How many revisions the history panel shows. Older ones are reachable only by scrolling the DB. */
const REVISION_HISTORY_LIMIT = 50;
const REVISION_SNIPPET_LENGTH = 160;
/** Candidate pool size for popularity ranking — big enough to rank properly, small enough to stay cheap. */
const POPULAR_CANDIDATE_LIMIT = 200;
const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;

const ESSAY_DETAIL_SELECT = `
  *,
  essay_revisions(title, content_json, revision_no, invalid_since),
  essay_votes(count),
  essay_views(count),
  essay_comments(count),
  author:profiles!author_profile_id(id, name, picture, role),
  book:books!book_id(id, title_cs, author, book_points, list_status, is_rocket_model, google_books_cover_url, highlight_category:highlight_categories(*))
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
  book: (Omit<NonNullable<EssayWithDetails['book']>, 'highlight_category'> & {
    highlight_category?: HighlightCategory | HighlightCategory[] | null;
  }) | null;
}

/**
 * Picks the latest non-invalid essay revision (highest revision_no).
 */
export function pickLatestRevision<
  T extends { revision_no: number; invalid_since: string | null },
>(revisions: T[] | null | undefined): T | null {
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
      book,
      ...rest
    } = row;

    const revision = pickLatestRevision(essay_revisions);
    const content_json = (revision?.content_json ?? {}) as object;

    return {
      ...rest,
      book: book
        ? { ...book, highlight_category: Array.isArray(book.highlight_category) ? book.highlight_category[0] ?? null : book.highlight_category ?? null }
        : null,
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
 * Popularity score: votes are the stronger quality signal, so they're
 * weighted 3x over views (mirrors the essay_count*3 + book_points weighting
 * used for book rankings elsewhere). Ties break to the newer essay.
 */
function sortByPopularity(essays: EssayWithDetails[]): EssayWithDetails[] {
  return [...essays].sort((a, b) => {
    const scoreA = a.vote_count * 3 + a.view_count;
    const scoreB = b.vote_count * 3 + b.view_count;
    if (scoreB !== scoreA) return scoreB - scoreA;
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

  const isPopularSort = sort === 'best' || sort === 'month';

  // Popularity ranking needs its own candidate pool: pagination by recency
  // has to happen *after* ranking by votes/views, not before, or the ranking
  // only ever reorders whatever page of recent rows happened to be fetched.
  const buildQuery = (sinceIso?: string) => {
    let q = supabase
      .from('essays')
      .select(ESSAY_DETAIL_SELECT)
      .not('published_at', 'is', null)
      .is('removed_at', null)
      .order('created_at', { ascending: false });

    if (isPopularSort) {
      if (sinceIso) q = q.gte('created_at', sinceIso);
      q = q.limit(POPULAR_CANDIDATE_LIMIT);
    } else {
      q = q.range(from, to);
    }

    if (filters?.authorProfileId) q = q.eq('author_profile_id', filters.authorProfileId);
    if (filters?.bookId) q = q.eq('book_id', filters.bookId);
    if (tagBookIds) q = q.in('book_id', tagBookIds);
    if (searchEssayIds) q = q.in('id', searchEssayIds);

    return q;
  };

  const monthAgo = new Date(Date.now() - MS_PER_MONTH).toISOString();
  const { data, error } = await buildQuery(sort === 'month' ? monthAgo : undefined);
  if (error) throw error;

  let essays = mapEssayRows((data ?? []) as unknown as EssayRawRow[]);

  // A quiet month shouldn't leave the section empty — widen to the most
  // recent candidates regardless of date if the month's pool is too thin.
  if (sort === 'month' && essays.length < pageSize) {
    const { data: fallbackData, error: fallbackError } = await buildQuery();
    if (fallbackError) throw fallbackError;
    essays = mapEssayRows((fallbackData ?? []) as unknown as EssayRawRow[]);
  }

  if (isPopularSort) {
    return sortByPopularity(essays).slice(from, to + 1);
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

export async function getEssayRevisions(
  supabase: SupabaseClient<Database>,
  essayId: string,
  limit: number = REVISION_HISTORY_LIMIT,
): Promise<EssayRevisionSummary[]> {
  const { data, error } = await supabase
    .from('essay_revisions')
    .select('revision_no, title, content_json, created_at, updated_at')
    .eq('essay_id', essayId)
    .is('invalid_since', null)
    .order('revision_no', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const text = contentTextFromJson(row.content_json);
    return {
      revision_no: row.revision_no,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at,
      word_count: text ? text.split(/\s+/).length : 0,
      snippet: text.slice(0, REVISION_SNIPPET_LENGTH),
    };
  });
}

export async function getEssayAuthorInfo(
  supabase: SupabaseClient<Database>,
  essayId: string,
): Promise<{ id: string; title: string; authorProfileId: string } | null> {
  const { data, error } = await supabase
    .from('essays')
    .select('id, author_profile_id, essay_revisions(title, revision_no, invalid_since)')
    .eq('id', essayId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const revision = pickLatestRevision(
    data.essay_revisions as { title: string; revision_no: number; invalid_since: string | null }[] | null,
  );

  return {
    id: data.id as string,
    title: revision?.title ?? '',
    authorProfileId: data.author_profile_id as string,
  };
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
    .select('book_id, books!inner(book_points, list_status)')
    .eq('author_profile_id', profileId)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('book_id', 'is', null);

  if (error) throw error;

  type Row = { book_id: string; books: { book_points: number; list_status: string } };

  const ELIGIBLE = new Set<string>(POINTS_ELIGIBLE_LIST_STATUSES);
  const approved = new Map<string, number>();
  const pending = new Set<string>();

  for (const row of (essays ?? []) as unknown as Row[]) {
    if (!row.book_id) continue;
    if (ELIGIBLE.has(row.books.list_status)) {
      approved.set(row.book_id, Number(row.books.book_points));
    } else if (row.books.list_status === 'processing') {
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
    .select('author_profile_id, book_id, books!inner(book_points, list_status)')
    .in('author_profile_id', profileIds)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('book_id', 'is', null);

  if (essayError) throw essayError;

  type EssayRow = {
    author_profile_id: string;
    book_id: string;
    books: { book_points: number; list_status: string };
  };

  const ELIGIBLE = new Set<string>(POINTS_ELIGIBLE_LIST_STATUSES);
  const byProfile: Record<string, { approved: Set<string>; pending: Set<string> }> = {};
  for (const profileId of profileIds) {
    byProfile[profileId] = { approved: new Set(), pending: new Set() };
  }

  for (const essay of (essays ?? []) as unknown as EssayRow[]) {
    const bucket = byProfile[essay.author_profile_id];
    if (!bucket || !essay.book_id) continue;
    if (ELIGIBLE.has(essay.books.list_status)) {
      bucket.approved.add(essay.book_id);
    } else if (essay.books.list_status === 'processing') {
      bucket.pending.add(essay.book_id);
    }
  }

  const { data: approvedBooks, error: booksError } = await supabase
    .from('books')
    .select('id, book_points')
    .in('list_status', ['shortlist', 'longlist']);

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
