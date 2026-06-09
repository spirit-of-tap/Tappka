import { SupabaseClient } from '@supabase/supabase-js';
import type {
  Essay,
  EssayWithDetails,
  EssayComment,
  EssayCommentWithAuthor,
  EssayViewWithProfile,
  EssayFilters,
} from './types';

const PAGE_SIZE_DEFAULT = 20;

export async function getEssays(
  supabase: SupabaseClient,
  filters?: EssayFilters,
): Promise<EssayWithDetails[]> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? PAGE_SIZE_DEFAULT;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('essays')
    .select(`
      *,
      author:profiles!author_profile_id(id, name, picture, role),
      book:books!book_id(id, title, author, book_points, status, cover_path)
    `)
    .eq('published', true)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters?.authorProfileId) {
    query = query.eq('author_profile_id', filters.authorProfileId);
  }

  if (filters?.bookId) {
    query = query.eq('book_id', filters.bookId);
  }

  if (filters?.search?.trim()) {
    const q = filters.search.trim();
    const safe = q.replace(/[%_]/g, '\\$&');
    query = query.or(`title.ilike.%${safe}%,content_text.plfts(simple).${q}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as EssayWithDetails[];
}

export async function getEssaysByTeam(
  supabase: SupabaseClient,
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
    .is('removed_access', null);

  if (teamError) throw teamError;

  const profileIds = (teamProfiles ?? []).map((p: { id: string }) => p.id);
  if (profileIds.length === 0) return [];

  let teamQuery = supabase
    .from('essays')
    .select(`
      *,
      author:profiles!author_profile_id(id, name, picture, role),
      book:books!book_id(id, title, author, book_points, status, cover_path)
    `)
    .eq('published', true)
    .in('author_profile_id', profileIds)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters?.search?.trim()) {
    const q = filters.search.trim();
    const safe = q.replace(/[%_]/g, '\\$&');
    teamQuery = teamQuery.or(`title.ilike.%${safe}%,content_text.plfts(simple).${q}`);
  }

  const { data, error } = await teamQuery;
  if (error) throw error;
  return data as EssayWithDetails[];
}

export async function getEssayById(
  supabase: SupabaseClient,
  essayId: string,
): Promise<EssayWithDetails | null> {
  const { data, error } = await supabase
    .from('essays')
    .select(`
      *,
      author:profiles!author_profile_id(id, name, picture, role),
      book:books!book_id(id, title, author, book_points, status, cover_path)
    `)
    .eq('id', essayId)
    .maybeSingle();

  if (error) throw error;
  return data as EssayWithDetails | null;
}

export async function getEssayComments(
  supabase: SupabaseClient,
  essayId: string,
): Promise<EssayCommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('essay_comments')
    .select(`
      *,
      author:profiles!author_profile_id(id, name, picture, role)
    `)
    .eq('essay_id', essayId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as EssayCommentWithAuthor[];
}

export async function getEssayCoachViewers(
  supabase: SupabaseClient,
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

export async function getUserBookPointsStats(
  supabase: SupabaseClient,
  profileId: string,
): Promise<{ approved_points: number; pending_points: number; essay_count: number }> {
  const { data: essays, error } = await supabase
    .from('essays')
    .select('book_id, books!inner(book_points, status)')
    .eq('author_profile_id', profileId)
    .not('book_id', 'is', null);

  if (error) throw error;

  type Row = { book_id: string; books: { book_points: number; status: string } };

  const approved = new Map<string, number>();
  const pending = new Set<string>();

  for (const row of (essays ?? []) as unknown as Row[]) {
    if (!row.book_id) continue;
    if (row.books.status === 'approved') {
      approved.set(row.book_id, row.books.book_points);
    } else if (row.books.status === 'pending') {
      pending.add(row.book_id);
    }
  }

  const approved_points = Array.from(approved.values()).reduce((s, p) => s + p, 0);

  const { count } = await supabase
    .from('essays')
    .select('*', { count: 'exact', head: true })
    .eq('author_profile_id', profileId)
    .eq('published', true);

  return { approved_points, pending_points: pending.size, essay_count: count ?? 0 };
}

export async function getTeamBookPointsStats(
  supabase: SupabaseClient,
  teamId: string,
): Promise<{ profile: { id: string; name: string; picture: string | null }; approved_points: number; pending_points: number }[]> {
  const { data: teamProfiles, error: teamError } = await supabase
    .from('profiles')
    .select('id, name, picture')
    .eq('team_id', teamId)
    .is('removed_access', null);

  if (teamError) throw teamError;
  if (!teamProfiles || teamProfiles.length === 0) return [];

  const profileIds = teamProfiles.map((p: { id: string }) => p.id);

  const { data: essays, error: essayError } = await supabase
    .from('essays')
    .select('author_profile_id, book_id, books!inner(book_points, status)')
    .in('author_profile_id', profileIds)
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
    pointsMap[book.id] = book.book_points;
  }

  return teamProfiles.map((profile: { id: string; name: string; picture: string | null }) => {
    const bucket = byProfile[profile.id];
    let approved_points = 0;
    let pending_points = 0;

    for (const bookId of bucket.approved) {
      approved_points += pointsMap[bookId] ?? 0;
    }
    pending_points = bucket.pending.size;

    return { profile, approved_points, pending_points };
  });
}
