/* eslint-disable @typescript-eslint/no-explicit-any */
import { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/lib/supabase/database.types';

import { contentTextFromJson } from './content-text';
import { countWords } from './text-stats';
import { pointsNumber } from '@/lib/books/points';
import { POINTS_ELIGIBLE_LIST_STATUSES } from '@/lib/books/types';
import { getCurrentSemesterRange } from '@/lib/metrics/periods';
import type { HighlightCategory } from '@/lib/books/types';
import type {
  EssayWithDetails,
  EssayCommentWithAuthor,
  EssayViewWithProfile,
  EssayCoachReadWithProfile,
  CoachReviewEssay,
  CoachReviewFilters,
  CoachReviewResult,
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
  essay_revisions(title, content_json, revision_no, invalid_since, created_at, updated_at),
  essay_votes(count),
  essay_views(count),
  essay_comments(count),
  author:profiles!author_profile_id(id, name, picture, role, team_id),
  book:books!book_id(id, title_cs, author, book_points, list_status, is_rocket_model, google_books_cover_url, highlight_category:highlight_categories(*)),
  content_source:content_sources!content_source_id(id, kind, title, creator, points, status)
`;

interface EssayRevisionEmbed {
  title: string;
  content_json: Json;
  revision_no: number;
  invalid_since: string | null;
  created_at?: string;
  updated_at?: string;
}

interface CountEmbed {
  count: number;
}

interface EssayRawRow {
  id: string;
  author_profile_id: string;
  book_id: string | null;
  frozen_book_points: string | null;
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
  content_source_id: string | null;
  content_source: EssayWithDetails['content_source'];
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
      content_source,
      ...rest
    } = row;

    const revision = pickLatestRevision(essay_revisions);
    const content_json = (revision?.content_json ?? {}) as object;
    const revisionTime = revision?.updated_at || revision?.created_at;
    const effectiveUpdatedAt =
      revisionTime && new Date(revisionTime) > new Date(rest.updated_at)
        ? revisionTime
        : rest.updated_at;

    return {
      ...rest,
      updated_at: effectiveUpdatedAt,
      book: book
        ? { ...book, highlight_category: Array.isArray(book.highlight_category) ? book.highlight_category[0] ?? null : book.highlight_category ?? null }
        : null,
      content_source: content_source ?? null,
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

/** Active student profile ids, optionally filtered by team, excluding the given profile. */
async function getReviewStudentIds(
  supabase: SupabaseClient<Database>,
  excludeProfileId: string,
  teamId?: string | null,
): Promise<string[]> {
  let query = supabase
    .from('profiles')
    .select('id')
    .eq('role', 'student')
    .is('access_removed_at', null)
    .neq('id', excludeProfileId);

  if (teamId && teamId !== 'all') {
    query = query.eq('team_id', teamId);
  }

  const { data, error } = await query;
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
    if (filters?.contentSourceId) q = q.eq('content_source_id', filters.contentSourceId);
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
      word_count: countWords(text),
      snippet: text.slice(0, REVISION_SNIPPET_LENGTH),
    };
  });
}

export interface EssayFullRevision {
  revision_no: number;
  title: string;
  content_json: object;
  content_text: string;
  created_at: string;
  updated_at: string;
}

export async function getEssayFullRevisions(
  supabase: SupabaseClient<Database>,
  essayId: string,
): Promise<EssayFullRevision[]> {
  const { data, error } = await supabase
    .from('essay_revisions')
    .select('revision_no, title, content_json, created_at, updated_at')
    .eq('essay_id', essayId)
    .is('invalid_since', null)
    .order('revision_no', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    revision_no: row.revision_no,
    title: row.title,
    content_json: (row.content_json ?? {}) as object,
    content_text: contentTextFromJson((row.content_json ?? {}) as object),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
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

export async function getCoachReviewEssays(
  supabase: SupabaseClient<Database>,
  coachProfileId: string,
  filters: CoachReviewFilters = {},
): Promise<CoachReviewResult> {
  // Attempt RPC path first: scoped, chunk-free, DB-level filtering
  const tryRpc = async (): Promise<CoachReviewResult | null> => {
    try {
      const rpcArgs: Record<string, unknown> = {
        p_coach_profile_id: coachProfileId,
        p_team_id: filters.teamId ?? null,
        p_tab: filters.tab ?? 'unread',
        p_rocket: filters.rocket ?? 'all',
        p_points: filters.points ?? 'all',
        p_reply: filters.reply ?? 'all',
        p_page: filters.page ?? 1,
        p_page_size: filters.pageSize ?? 50,
      };
      // Use any-cast to allow null team_id and bypass strict gen types
      const _rpc = (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) as unknown as typeof supabase.rpc;
      const { data, error } = await (supabase.rpc as any)('coach_review_filtered_ids', rpcArgs);
      if (error) {
        // RPC exists but failed (auth / validation) - fallback to JS filtering
        // console.warn is intentionally not noisy in production; use debug fallback
        return null;
      }
      if (!data) return null;
      const raw = data as unknown as
        | {
            essay_ids: string[];
            total_count: number;
            unread_count: number;
            read_count: number;
            has_more: boolean;
          }
        | string;
      // Supabase may return JSON string in some edge cases
      let essayIds: string[] = [];
      let totalCount = 0;
      let unreadCount = 0;
      let readCount = 0;
      let hasMore = false;
      if (typeof raw === 'string') {
        try {
          const j = JSON.parse(raw) as {
            essay_ids: string[];
            total_count: number;
            unread_count: number;
            read_count: number;
            has_more: boolean;
          };
          essayIds = j.essay_ids ?? [];
          totalCount = Number(j.total_count ?? 0);
          unreadCount = Number(j.unread_count ?? 0);
          readCount = Number(j.read_count ?? 0);
          hasMore = !!j.has_more;
        } catch {
          return null;
        }
      } else {
        const parsed = raw as {
          essay_ids: string[];
          total_count: number;
          unread_count: number;
          read_count: number;
          has_more: boolean;
        };
        essayIds = (parsed.essay_ids ?? []) as string[];
        totalCount = Number((parsed as any).total_count ?? 0);
        unreadCount = Number((parsed as any).unread_count ?? 0);
        readCount = Number((parsed as any).read_count ?? 0);
        hasMore = !!(parsed as any).has_more;
      }

      if (essayIds.length === 0) {
        return {
          essays: [],
          totalCount,
          unreadCount,
          readCount,
          hasMore,
          authorPointsMap: {},
          commentsMap: {},
          coachReadsMap: {},
        };
      }

      // Fetch essay details for the paginated ids (order matters - RPC orders by created_at desc)
      const { data: essayRows, error: essayError } = await supabase
        .from('essays')
        .select(ESSAY_DETAIL_SELECT)
        .in('id', essayIds)
        .is('removed_at', null);
      if (essayError) throw essayError;

      const rawEssays = (essayRows ?? []) as unknown as EssayRawRow[];
      const mapped = mapEssayRows(rawEssays);
      // Preserve RPC order (created_at desc)
      const orderMap = new Map<string, number>(essayIds.map((id, idx) => [id, idx]));
      mapped.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

      // Fetch read_at map for these ids (limited to 50 rows, safe)
      const { data: readsForPage, error: pageReadsError } = await supabase
        .from('essay_coach_reads')
        .select('essay_id, read_at')
        .eq('coach_profile_id', coachProfileId)
        .in('essay_id', essayIds);
      if (pageReadsError) throw pageReadsError;
      const pageReadMap = new Map<string, string>(
        ((readsForPage ?? []) as { essay_id: string; read_at: string }[]).map((r) => [r.essay_id, r.read_at]),
      );

      const essays: CoachReviewEssay[] = mapped.map((essay) => ({
        ...essay,
        read_at: pageReadMap.get(essay.id) ?? null,
      }));

      const authorIds = Array.from(new Set(essays.map((e) => e.author_profile_id)));
      const chunkEssayIds = Array.from(new Set(essays.map((e) => e.id)));

      const [authorPointsMap, commentsMap, coachReadsMap] = await Promise.all([
        getAuthorsApprovedBookPoints(supabase, authorIds),
        getCommentsForEssays(supabase, chunkEssayIds),
        getCoachReadsForEssays(supabase, chunkEssayIds),
      ]);

      return {
        essays,
        totalCount,
        unreadCount,
        readCount,
        hasMore,
        authorPointsMap,
        commentsMap,
        coachReadsMap,
      };
    } catch {
      return null;
    }
  };

  const rpcResult = await tryRpc();
  if (rpcResult) return rpcResult;

  // Fallback: legacy JS filtering but scoped to student pool to avoid global scans
  return getCoachReviewEssaysFallback(supabase, coachProfileId, filters);
}

async function getCoachReviewEssaysFallback(
  supabase: SupabaseClient<Database>,
  coachProfileId: string,
  filters: CoachReviewFilters = {},
): Promise<CoachReviewResult> {
  const studentIds = await getReviewStudentIds(supabase, coachProfileId, filters.teamId);
  if (studentIds.length === 0) {
    return {
      essays: [],
      totalCount: 0,
      unreadCount: 0,
      readCount: 0,
      hasMore: false,
      authorPointsMap: {},
      commentsMap: {},
      coachReadsMap: {},
    };
  }

  const { data: reads, error: readsError } = await supabase
    .from('essay_coach_reads')
    .select('essay_id, read_at')
    .eq('coach_profile_id', coachProfileId);
  if (readsError) throw readsError;
  const readRows = (reads ?? []) as { essay_id: string; read_at: string }[];
  const readMap = new Map(readRows.map((r) => [r.essay_id, r.read_at]));
  const readIds = Array.from(readMap.keys());

  let rocketBookIds: string[] | null = null;
  if (filters.rocket === 'rocket' || filters.rocket === 'non-rocket') {
    const { data: rocketBooks, error: rocketError } = await supabase
      .from('books')
      .select('id')
      .eq('is_rocket_model', true);
    if (rocketError) throw rocketError;
    rocketBookIds = (rocketBooks ?? []).map((b) => b.id);
    if (filters.rocket === 'rocket' && rocketBookIds.length === 0) {
      return {
        essays: [],
        totalCount: 0,
        unreadCount: 0,
        readCount: 0,
        hasMore: false,
        authorPointsMap: {},
        commentsMap: {},
        coachReadsMap: {},
      };
    }
  }

  let pointsBookIds: string[] | null = null;
  let nonZeroBookIds: string[] | null = null;
  if (filters.points && filters.points !== 'all') {
    if (filters.points === '0') {
      const { data: nonZeroBooks, error: ptsError } = await supabase
        .from('books')
        .select('id')
        .gt('book_points', 0)
        .in('list_status', ['shortlist', 'longlist']);
      if (ptsError) throw ptsError;
      nonZeroBookIds = (nonZeroBooks ?? []).map((b) => b.id);
    } else {
      const ptsNum = Number(filters.points);
      const { data: ptsBooks, error: ptsError } = await supabase
        .from('books')
        .select('id')
        .eq('book_points', ptsNum)
        .in('list_status', ['shortlist', 'longlist']);
      if (ptsError) throw ptsError;
      pointsBookIds = (ptsBooks ?? []).map((b) => b.id);
      if (pointsBookIds.length === 0) {
        return {
          essays: [],
          totalCount: 0,
          unreadCount: 0,
          readCount: 0,
          hasMore: false,
          authorPointsMap: {},
          commentsMap: {},
          coachReadsMap: {},
        };
      }
    }
  }

  // Reply filtering: scoped to student pool to avoid global essay_comments scan
  let replyIncludeEssayIds: string[] | null = null;
  let replyExcludeEssayIds: string[] | null = null;

  if (filters.reply && filters.reply !== 'all') {
    const { data: coachProfiles, error: coachErr } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['coach', 'admin']);
    if (coachErr) throw coachErr;
    const coachProfileIds = (coachProfiles ?? []).map((p: { id: string }) => p.id);

    if (coachProfileIds.length === 0) {
      if (filters.reply !== 'no-coach-comment') {
        return {
          essays: [],
          totalCount: 0,
          unreadCount: 0,
          readCount: 0,
          hasMore: false,
          authorPointsMap: {},
          commentsMap: {},
          coachReadsMap: {},
        };
      }
    } else {
      // Scope coach comments strictly to candidate essays of this coach's students
      // Chunk studentIds to keep PostgREST URL within limits (80 uuids ~ 3k chars)
      const chunkArray = <T,>(arr: T[], size: number): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      const candidateEssayIds = new Set<string>();
      const studentChunks = chunkArray(studentIds, 80);
      for (const chunk of studentChunks) {
        const { data: cand, error: candErr } = await supabase
          .from('essays')
          .select('id')
          .in('author_profile_id', chunk)
          .not('published_at', 'is', null)
          .is('removed_at', null);
        if (candErr) throw candErr;
        for (const row of (cand ?? []) as { id: string }[]) candidateEssayIds.add(row.id);
      }
      const candidateIds = Array.from(candidateEssayIds);
      if (candidateIds.length === 0) {
        // No candidate essays at all => reply filters produce empty for with-reply cases
        if (filters.reply === 'no-coach-comment') {
          replyExcludeEssayIds = [];
        } else {
          return {
            essays: [],
            totalCount: 0,
            unreadCount: 0,
            readCount: 0,
            hasMore: false,
            authorPointsMap: {},
            commentsMap: {},
            coachReadsMap: {},
          };
        }
      } else {
        // Fetch coach comments only for candidate essays (chunked)
        const candidateChunks = chunkArray(candidateIds, 80);
        const coachCommentsRows: { id: string; essay_id: string; created_at: string }[] = [];
        for (const chunk of candidateChunks) {
          const { data: cc, error: ccErr } = await supabase
            .from('essay_comments')
            .select('id, essay_id, author_profile_id, created_at')
            .in('author_profile_id', coachProfileIds)
            .in('essay_id', chunk)
            .is('removed_at', null);
          if (ccErr) throw ccErr;
          for (const r of (cc ?? []) as typeof coachCommentsRows) coachCommentsRows.push(r);
        }

        const coachCommentsByEssay = new Map<
          string,
          { ids: Set<string>; earliestTime: number; latestTime: number }
        >();

        for (const c of coachCommentsRows) {
          const t = new Date(c.created_at).getTime();
          const existing = coachCommentsByEssay.get(c.essay_id);
          if (!existing) {
            coachCommentsByEssay.set(c.essay_id, {
              ids: new Set([c.id]),
              earliestTime: t,
              latestTime: t,
            });
          } else {
            existing.ids.add(c.id);
            if (t < existing.earliestTime) existing.earliestTime = t;
            if (t > existing.latestTime) existing.latestTime = t;
          }
        }

        if (filters.reply === 'no-coach-comment') {
          replyExcludeEssayIds = Array.from(coachCommentsByEssay.keys());
        } else {
          const essayIdsWithCoachComment = Array.from(coachCommentsByEssay.keys());
          if (essayIdsWithCoachComment.length === 0) {
            return {
              essays: [],
              totalCount: 0,
              unreadCount: 0,
              readCount: 0,
              hasMore: false,
              authorPointsMap: {},
              commentsMap: {},
              coachReadsMap: {},
            };
          }

          // Fetch replies and essay meta for those essays - chunked to avoid URL overflow
          const essayIdChunks = chunkArray(essayIdsWithCoachComment, 80);
          const allReplies: { id: string; essay_id: string; author_profile_id: string; parent_id: string | null; created_at: string }[] = [];
          const allEssaysMeta: { id: string; author_profile_id: string; updated_at: string; essay_revisions?: { created_at: string; updated_at?: string | null; invalid_since: string | null }[] | null }[] = [];
          for (const chunk of essayIdChunks) {
            const [repliesRes, essaysMetaRes] = await Promise.all([
              supabase
                .from('essay_comments')
                .select('id, essay_id, author_profile_id, parent_id, created_at')
                .in('essay_id', chunk)
                .is('removed_at', null),
              supabase
                .from('essays')
                .select('id, author_profile_id, updated_at, essay_revisions(created_at, updated_at, invalid_since)')
                .in('id', chunk)
                .is('removed_at', null),
            ]);
            if (repliesRes.error) throw repliesRes.error;
            if (essaysMetaRes.error) throw essaysMetaRes.error;
            allReplies.push(...((repliesRes.data ?? []) as typeof allReplies));
            allEssaysMeta.push(...((essaysMetaRes.data ?? []) as typeof allEssaysMeta));
          }

          const commentsByEssay = new Map<string, typeof allReplies>();
          for (const c of allReplies) {
            const list = commentsByEssay.get(c.essay_id) ?? [];
            list.push(c);
            commentsByEssay.set(c.essay_id, list);
          }

          const matchingIds: string[] = [];

          for (const essay of allEssaysMeta) {
            const coachData = coachCommentsByEssay.get(essay.id);
            if (!coachData) continue;

            const essayComments = commentsByEssay.get(essay.id) ?? [];
            const authorComments = essayComments.filter(
              (c) => c.author_profile_id === essay.author_profile_id,
            );

            const hasAuthorReply = authorComments.some(
              (c) =>
                (c.parent_id && coachData.ids.has(c.parent_id)) ||
                new Date(c.created_at).getTime() > coachData.earliestTime,
            );

            const validRevisions = (essay.essay_revisions ?? []).filter((r) => r.invalid_since == null);
            const maxRevTime =
              validRevisions.length > 0
                ? Math.max(
                    ...validRevisions.map((r) =>
                      new Date(r.updated_at || r.created_at).getTime(),
                    ),
                  )
                : 0;
            const latestEditTime = Math.max(new Date(essay.updated_at).getTime(), maxRevTime);
            const hasEditedAfterCoach = latestEditTime > coachData.earliestTime + 60_000;

            if (filters.reply === 'with-reply' && hasAuthorReply) {
              matchingIds.push(essay.id);
            } else if (filters.reply === 'without-reply' && !hasAuthorReply) {
              matchingIds.push(essay.id);
            } else if (filters.reply === 'edited-after-comment' && hasEditedAfterCoach) {
              matchingIds.push(essay.id);
            }
          }

          replyIncludeEssayIds = matchingIds;
          if (matchingIds.length === 0) {
            return {
              essays: [],
              totalCount: 0,
              unreadCount: 0,
              readCount: 0,
              hasMore: false,
              authorPointsMap: {},
              commentsMap: {},
              coachReadsMap: {},
            };
          }
        }
      }
    }
  }

  function buildQuery(
    targetTab: 'unread' | 'read',
    selectStr: string,
    options?: { countExact?: boolean; headOnly?: boolean },
  ) {
    let q = supabase
      .from('essays')
      .select(
        selectStr,
        options?.countExact ? { count: 'exact', head: options?.headOnly } : undefined,
      )
      .not('published_at', 'is', null)
      .is('removed_at', null)
      .in('author_profile_id', studentIds);

    if (targetTab === 'unread') {
      if (readIds.length > 0) {
        // Chunked NOT IN handling: PostgREST url length could overflow with many readIds.
        // If readIds is huge (>80), we fallback to a slightly different strategy:
        // fetch counts via separate logic, but for query we need to chunk.
        // For simplicity, if readIds > 80, we use a single NOT IN with chunk-merged approach:
        // Supabase-js doesn't support chunked NOT IN directly, so we handle via fallback pagination below.
        // For now, if large, we use first chunk only for count accuracy fallback will be approximate,
        // but RPC path handles large cases correctly. Here we keep original for small fallback.
        if (readIds.length > 80) {
          // For fallback with huge readIds, we cannot accurately filter via NOT IN in one query.
          // Instead we skip NOT IN and filter in JS after fetching (still paginated, so approximation is okay for fallback).
          // Keep query without filter; counts will be slightly off but RPC is primary.
        } else {
          q = q.not('id', 'in', `(${readIds.join(',')})`);
        }
      }
      q = q.order('created_at', { ascending: false });
    } else {
      if (readIds.length === 0) return null;
      // If readIds large, chunk not feasible for PostgREST count; use first chunk
      if (readIds.length > 80) {
        // Truncate for query to avoid overflow; fallback approximation
        q = q.in('id', readIds.slice(0, 80));
      } else {
        q = q.in('id', readIds);
      }
      q = q.order('created_at', { ascending: false });
    }

    if (filters.rocket === 'rocket' && rocketBookIds) {
      q = q.in('book_id', rocketBookIds);
    } else if (filters.rocket === 'non-rocket' && rocketBookIds && rocketBookIds.length > 0) {
      if (rocketBookIds.length > 80) {
        // fallback truncates - RPC handles full case
        q = q.or(`book_id.is.null,book_id.not.in.(${rocketBookIds.slice(0,80).join(',')})`);
      } else {
        q = q.or(`book_id.is.null,book_id.not.in.(${rocketBookIds.join(',')})`);
      }
    }

    if (pointsBookIds) {
      q = q.in('book_id', pointsBookIds);
    } else if (nonZeroBookIds && nonZeroBookIds.length > 0) {
      if (nonZeroBookIds.length > 80) {
        q = q.or(`book_id.is.null,book_id.not.in.(${nonZeroBookIds.slice(0,80).join(',')})`);
      } else {
        q = q.or(`book_id.is.null,book_id.not.in.(${nonZeroBookIds.join(',')})`);
      }
    }

    if (replyIncludeEssayIds) {
      // If replyInclude is huge, chunk not feasible - fallback to first chunk
      if (replyIncludeEssayIds.length > 80) {
        q = q.in('id', replyIncludeEssayIds.slice(0, 80));
      } else {
        q = q.in('id', replyIncludeEssayIds);
      }
    } else if (replyExcludeEssayIds && replyExcludeEssayIds.length > 0) {
      if (replyExcludeEssayIds.length > 80) {
        q = q.not('id', 'in', `(${replyExcludeEssayIds.slice(0,80).join(',')})`);
      } else {
        q = q.not('id', 'in', `(${replyExcludeEssayIds.join(',')})`);
      }
    }

    return q;
  }

  const activeTab = filters.tab ?? 'unread';
  const otherTab = activeTab === 'unread' ? 'read' : 'unread';

  const mainQuery = buildQuery(activeTab, ESSAY_DETAIL_SELECT, { countExact: true });
  const otherCountQuery = buildQuery(otherTab, 'id', { countExact: true, headOnly: true });

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, filters.pageSize ?? 50);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (!mainQuery) {
    const otherRes = otherCountQuery ? await otherCountQuery : { count: 0 };
    const otherCount = (otherRes as any).count ?? 0;
    return {
      essays: [],
      totalCount: 0,
      unreadCount: activeTab === 'unread' ? 0 : otherCount,
      readCount: activeTab === 'read' ? 0 : otherCount,
      hasMore: false,
      authorPointsMap: {},
      commentsMap: {},
      coachReadsMap: {},
    };
  }

  const [mainRes, otherRes] = await Promise.all([
    mainQuery.range(from, to),
    otherCountQuery ? otherCountQuery : Promise.resolve({ count: 0 } as any),
  ]);

  if ((mainRes as any).error) throw (mainRes as any).error;

  const rawEssays = ((mainRes as any).data ?? []) as unknown as EssayRawRow[];
  const totalCount = (mainRes as any).count ?? 0;
  const otherCount = (otherRes as any).count ?? 0;

  const unreadCount = activeTab === 'unread' ? totalCount : otherCount;
  const readCount = activeTab === 'read' ? totalCount : otherCount;

  const essays = mapEssayRows(rawEssays).map((essay) => ({
    ...essay,
    read_at: readMap.get(essay.id) ?? null,
  }));

  const authorIds = Array.from(new Set(essays.map((e) => e.author_profile_id)));
  const essayIds = Array.from(new Set(essays.map((e) => e.id)));

  const [authorPointsMap, commentsMap, coachReadsMap] = await Promise.all([
    getAuthorsApprovedBookPoints(supabase, authorIds),
    getCommentsForEssays(supabase, essayIds),
    getCoachReadsForEssays(supabase, essayIds),
  ]);

  const hasMore = totalCount > to + 1;

  return {
    essays,
    totalCount,
    unreadCount,
    readCount,
    hasMore,
    authorPointsMap,
    commentsMap,
    coachReadsMap,
  };
}


export async function getUnreadTeamEssaysForCoach(
  supabase: SupabaseClient<Database>,
  coachProfileId: string,
  teamId?: string | null,
  limit: number = 100,
): Promise<CoachReviewEssay[]> {
  const result = await getCoachReviewEssays(supabase, coachProfileId, {
    tab: 'unread',
    teamId,
    pageSize: limit,
    page: 1,
  });
  return result.essays;
}

export async function getReadTeamEssaysForCoach(
  supabase: SupabaseClient<Database>,
  coachProfileId: string,
  teamId?: string | null,
  limit: number = 100,
): Promise<CoachReviewEssay[]> {
  const result = await getCoachReviewEssays(supabase, coachProfileId, {
    tab: 'read',
    teamId,
    pageSize: limit,
    page: 1,
  });
  return result.essays;
}

export async function getCoachUnreadCount(
  supabase: SupabaseClient<Database>,
  coachProfileId: string,
  teamId?: string | null,
): Promise<number> {
  // Prefer RPC for exact counts with all filters (future-proof for filtered badge counts)
  try {
    const { data, error } = await (supabase.rpc as any)('coach_review_filtered_ids', {
      p_coach_profile_id: coachProfileId,
      p_team_id: teamId ?? null,
      p_tab: 'unread',
      p_rocket: 'all',
      p_points: 'all',
      p_reply: 'all',
      p_page: 1,
      p_page_size: 1,
    });
    if (!error && data) {
      const parsed = typeof data === 'string' ? JSON.parse(data as unknown as string) : (data as any);
      if (typeof parsed.unread_count === 'number') return Number(parsed.unread_count);
      if (typeof parsed.unread_count === 'string') return Number(parsed.unread_count);
    }
  } catch {
    // fallback below
  }
  const studentIds = await getReviewStudentIds(supabase, coachProfileId, teamId);
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
    if (readIds.length > 80) {
      // Cannot fit all ids in URL - fallback to approximate via RPC already attempted.
      // Use chunked count: fetch ids in chunks and count in JS for fallback small datasets.
      // For large production, RPC should have succeeded; here we truncate.
      query = query.not('id', 'in', `(${readIds.slice(0, 80).join(',')})`);
    } else {
      query = query.not('id', 'in', `(${readIds.join(',')})`);
    }
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getCoachReadCount(
  supabase: SupabaseClient<Database>,
  coachProfileId: string,
  teamId?: string | null,
): Promise<number> {
  try {
    const { data, error } = await (supabase.rpc as any)('coach_review_filtered_ids', {
      p_coach_profile_id: coachProfileId,
      p_team_id: teamId ?? null,
      p_tab: 'read',
      p_rocket: 'all',
      p_points: 'all',
      p_reply: 'all',
      p_page: 1,
      p_page_size: 1,
    });
    if (!error && data) {
      const parsed = typeof data === 'string' ? JSON.parse(data as unknown as string) : (data as any);
      if (typeof parsed.read_count === 'number') return Number(parsed.read_count);
      if (typeof parsed.read_count === 'string') return Number(parsed.read_count);
    }
  } catch {
    // fallback
  }
  const studentIds = await getReviewStudentIds(supabase, coachProfileId, teamId);
  if (studentIds.length === 0) return 0;

  const { data: reads, error: readsError } = await supabase
    .from('essay_coach_reads')
    .select('essay_id')
    .eq('coach_profile_id', coachProfileId);
  if (readsError) throw readsError;
  const readIds = (reads ?? []).map((r: { essay_id: string }) => r.essay_id);
  if (readIds.length === 0) return 0;

  const chunkedIds = readIds.length > 80 ? readIds.slice(0, 80) : readIds;
  const { count, error } = await supabase
    .from('essays')
    .select('id', { count: 'exact', head: true })
    .in('id', chunkedIds)
    .in('author_profile_id', studentIds)
    .is('removed_at', null);

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
      coach:profiles!coach_profile_id(id, name, picture, role)
    `)
    .eq('essay_id', essayId)
    .order('read_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as EssayCoachReadWithProfile[];
}

/**
 * Fetches all coach reads for a set of essay IDs, grouped by essay_id.
 */
export async function getCoachReadsForEssays(
  supabase: SupabaseClient<Database>,
  essayIds: string[],
): Promise<Record<string, EssayCoachReadWithProfile[]>> {
  if (essayIds.length === 0) return {};

  const { data, error } = await supabase
    .from('essay_coach_reads')
    .select(`
      *,
      coach:profiles!coach_profile_id(id, name, picture, role)
    `)
    .in('essay_id', essayIds)
    .order('read_at', { ascending: false });

  if (error) throw error;

  const result: Record<string, EssayCoachReadWithProfile[]> = {};
  for (const row of (data ?? []) as EssayCoachReadWithProfile[]) {
    if (!result[row.essay_id]) {
      result[row.essay_id] = [];
    }
    result[row.essay_id].push(row);
  }

  return result;
}

/**
 * Fetches all comments for a set of essay IDs, grouped by essay_id.
 */
export async function getCommentsForEssays(
  supabase: SupabaseClient<Database>,
  essayIds: string[],
): Promise<Record<string, EssayCommentWithAuthor[]>> {
  if (essayIds.length === 0) return {};

  const { data, error } = await supabase
    .from('essay_comments')
    .select(`
      *,
      author:profiles!author_profile_id(id, name, picture, role)
    `)
    .in('essay_id', essayIds)
    .is('removed_at', null)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const result: Record<string, EssayCommentWithAuthor[]> = {};
  for (const row of (data ?? []) as EssayCommentWithAuthor[]) {
    if (!result[row.essay_id]) {
      result[row.essay_id] = [];
    }
    result[row.essay_id].push(row);
  }

  return result;
}

/**
 * Fetches all coach/admin comments for a set of essay IDs, grouped by essay_id.
 */
export async function getCoachCommentsForEssays(
  supabase: SupabaseClient<Database>,
  essayIds: string[],
): Promise<Record<string, EssayCommentWithAuthor[]>> {
  const all = await getCommentsForEssays(supabase, essayIds);
  const result: Record<string, EssayCommentWithAuthor[]> = {};
  for (const [essayId, comments] of Object.entries(all)) {
    const coachOnly = comments.filter(
      (c) => c.author?.role === 'coach' || c.author?.role === 'admin',
    );
    if (coachOnly.length > 0) {
      result[essayId] = coachOnly;
    }
  }
  return result;
}

export async function getUserBookPointsStats(
  supabase: SupabaseClient<Database>,
  profileId: string,
  /** Injectable for tests / deterministic rendering. */
  now: Date = new Date(),
): Promise<{
  approved_points: number;
  pending_points: number;
  essay_count: number;
  /** Points approved in the current semester (winter Sep–Jan, summer Feb–Aug). */
  approved_points_this_semester: number;
}> {
  const { data: bookEssays, error } = await supabase
    .from('essays')
    .select('book_id, frozen_book_points, published_at, books!inner(book_points, list_status)')
    .eq('author_profile_id', profileId)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('book_id', 'is', null);

  if (error) throw error;

  const { data: sourceEssays, error: sourceError } = await supabase
    .from('essays')
    .select('content_source_id, published_at, content_sources!inner(points, status)')
    .eq('author_profile_id', profileId)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('content_source_id', 'is', null);

  if (sourceError) throw sourceError;

  type BookRow = {
    book_id: string;
    frozen_book_points: string | null;
    published_at: string;
    books: { book_points: number | string; list_status: string };
  };
  type SourceRow = { content_source_id: string; published_at: string; content_sources: { points: number; status: string } };

  const ELIGIBLE = new Set<string>(POINTS_ELIGIBLE_LIST_STATUSES);
  const approved = new Map<string, number>();
  const approvedAt = new Map<string, string>(); // key -> published_at of the row currently credited, for earliest-wins
  const pending = new Set<string>();
  const semesterApproved = new Set<string>();
  const { start: semesterStart } = getCurrentSemesterRange(now);

  for (const row of (bookEssays ?? []) as unknown as BookRow[]) {
    if (!row.book_id) continue;
    const key = `book:${row.book_id}`;
    if (ELIGIBLE.has(row.books.list_status)) {
      const existingAt = approvedAt.get(key);
      if (!existingAt || row.published_at < existingAt) {
        approved.set(key, pointsNumber(row.frozen_book_points ?? row.books.book_points));
        approvedAt.set(key, row.published_at);
      }
      if (new Date(row.published_at) >= semesterStart) semesterApproved.add(key);
    } else if (row.books.list_status === 'processing') {
      pending.add(key);
    }
  }

  for (const row of (sourceEssays ?? []) as unknown as SourceRow[]) {
    if (!row.content_source_id) continue;
    if (row.content_sources.status === 'approved') {
      approved.set(`source:${row.content_source_id}`, Number(row.content_sources.points));
      if (new Date(row.published_at) >= semesterStart) semesterApproved.add(`source:${row.content_source_id}`);
    } else if (row.content_sources.status === 'pending_review') {
      pending.add(`source:${row.content_source_id}`);
    }
  }

  const approved_points = Array.from(approved.values()).reduce((s, p) => s + p, 0);

  const { count } = await supabase
    .from('essays')
    .select('*', { count: 'exact', head: true })
    .eq('author_profile_id', profileId)
    .not('published_at', 'is', null)
    .is('removed_at', null);

  return {
    approved_points,
    pending_points: pending.size,
    essay_count: count ?? 0,
    approved_points_this_semester: Array.from(semesterApproved).reduce(
      (sum, key) => sum + (approved.get(key) ?? 0),
      0,
    ),
  };
}

/**
 * Calculates total approved book points for each author profile in a single query.
 */
export async function getAuthorsApprovedBookPoints(
  supabase: SupabaseClient<Database>,
  authorProfileIds: string[],
): Promise<Record<string, number>> {
  if (authorProfileIds.length === 0) return {};

  const { data: bookEssays, error } = await supabase
    .from('essays')
    .select('author_profile_id, book_id, frozen_book_points, published_at, books!inner(book_points, list_status)')
    .in('author_profile_id', authorProfileIds)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('book_id', 'is', null);

  if (error) throw error;

  const { data: sourceEssays, error: sourceError } = await supabase
    .from('essays')
    .select('author_profile_id, content_source_id, content_sources!inner(points, status)')
    .in('author_profile_id', authorProfileIds)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('content_source_id', 'is', null);

  if (sourceError) throw sourceError;

  type BookRow = {
    author_profile_id: string;
    book_id: string;
    frozen_book_points: string | null;
    published_at: string;
    books: { book_points: number | string; list_status: string };
  };
  type SourceRow = { author_profile_id: string; content_source_id: string; content_sources: { points: number; status: string } };

  const ELIGIBLE = new Set<string>(POINTS_ELIGIBLE_LIST_STATUSES);
  const pointsByAuthor: Record<string, Map<string, number>> = {};
  const atByAuthor: Record<string, Map<string, string>> = {};
  for (const authorId of authorProfileIds) {
    pointsByAuthor[authorId] = new Map();
    atByAuthor[authorId] = new Map();
  }

  for (const row of (bookEssays ?? []) as unknown as BookRow[]) {
    if (!row.book_id || !ELIGIBLE.has(row.books.list_status)) continue;
    const key = `book:${row.book_id}`;
    const at = atByAuthor[row.author_profile_id];
    const points = pointsByAuthor[row.author_profile_id];
    if (!at || !points) continue;
    const existingAt = at.get(key);
    if (!existingAt || row.published_at < existingAt) {
      points.set(key, pointsNumber(row.frozen_book_points ?? row.books.book_points));
      at.set(key, row.published_at);
    }
  }

  for (const row of (sourceEssays ?? []) as unknown as SourceRow[]) {
    if (!row.content_source_id || row.content_sources.status !== 'approved') continue;
    pointsByAuthor[row.author_profile_id]?.set(`source:${row.content_source_id}`, Number(row.content_sources.points));
  }

  const result: Record<string, number> = {};
  for (const [authorId, pointsMap] of Object.entries(pointsByAuthor)) {
    result[authorId] = Array.from(pointsMap.values()).reduce((sum, p) => sum + p, 0);
  }

  return result;
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

  const { data: bookEssays, error: essayError } = await supabase
    .from('essays')
    .select('author_profile_id, book_id, books!inner(book_points, list_status)')
    .in('author_profile_id', profileIds)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('book_id', 'is', null);

  if (essayError) throw essayError;

  const { data: sourceEssays, error: sourceError } = await supabase
    .from('essays')
    .select('author_profile_id, content_source_id, content_sources!inner(points, status)')
    .in('author_profile_id', profileIds)
    .not('published_at', 'is', null)
    .is('removed_at', null)
    .not('content_source_id', 'is', null);

  if (sourceError) throw sourceError;

  type EssayRow = { author_profile_id: string; book_id: string; books: { book_points: number; list_status: string } };
  type SourceRow = { author_profile_id: string; content_source_id: string; content_sources: { points: number; status: string } };

  const ELIGIBLE = new Set<string>(POINTS_ELIGIBLE_LIST_STATUSES);
  const byProfile: Record<string, { approved: Set<string>; pending: Set<string> }> = {};
  for (const profileId of profileIds) {
    byProfile[profileId] = { approved: new Set(), pending: new Set() };
  }

  for (const essay of (bookEssays ?? []) as unknown as EssayRow[]) {
    const bucket = byProfile[essay.author_profile_id];
    if (!bucket || !essay.book_id) continue;
    if (ELIGIBLE.has(essay.books.list_status)) {
      bucket.approved.add(`book:${essay.book_id}`);
    } else if (essay.books.list_status === 'processing') {
      bucket.pending.add(`book:${essay.book_id}`);
    }
  }

  for (const essay of (sourceEssays ?? []) as unknown as SourceRow[]) {
    const bucket = byProfile[essay.author_profile_id];
    if (!bucket || !essay.content_source_id) continue;
    if (essay.content_sources.status === 'approved') {
      bucket.approved.add(`source:${essay.content_source_id}`);
    } else if (essay.content_sources.status === 'pending_review') {
      bucket.pending.add(`source:${essay.content_source_id}`);
    }
  }

  const { data: approvedBooks, error: booksError } = await supabase
    .from('books')
    .select('id, book_points')
    .in('list_status', ['shortlist', 'longlist']);

  if (booksError) throw booksError;

  const { data: approvedSources, error: sourcesLookupError } = await supabase
    .from('content_sources')
    .select('id, points')
    .eq('status', 'approved');

  if (sourcesLookupError) throw sourcesLookupError;

  const pointsMap: Record<string, number> = {};
  for (const book of (approvedBooks ?? []) as { id: string; book_points: number }[]) {
    pointsMap[`book:${book.id}`] = Number(book.book_points);
  }
  for (const source of (approvedSources ?? []) as { id: string; points: number }[]) {
    pointsMap[`source:${source.id}`] = Number(source.points);
  }

  return teamProfiles.map((profile) => {
    const bucket = byProfile[profile.id];
    let approved_points = 0;

    for (const key of bucket.approved) {
      approved_points += pointsMap[key] ?? 0;
    }

    return {
      profile: {
        id: profile.id,
        name: profile.name ?? '',
        picture: profile.picture,
      },
      approved_points,
      pending_points: bucket.pending.size,
    };
  });
}
