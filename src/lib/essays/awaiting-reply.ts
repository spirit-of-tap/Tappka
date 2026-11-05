import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

/** Comment authors whose comments ask the essay author for a response. */
const COACH_ROLES = new Set(['coach']);

export interface CommentActivity {
  essay_id: string;
  author_profile_id: string;
  created_at: string;
  author_role: string | null;
}

/**
 * Essays where a coach has the last word: the newest coach comment is newer
 * than the author's newest comment on that essay. A fresh coach comment
 * re-flags an essay even if the author answered an earlier one.
 */
export function essayIdsAwaitingReply(
  comments: CommentActivity[],
  authorProfileId: string,
): Set<string> {
  const latestCoach = new Map<string, string>();
  const latestAuthor = new Map<string, string>();

  for (const comment of comments) {
    const target = COACH_ROLES.has(comment.author_role ?? '')
      ? latestCoach
      : comment.author_profile_id === authorProfileId
        ? latestAuthor
        : null;
    if (!target) continue;

    const previous = target.get(comment.essay_id);
    if (!previous || comment.created_at > previous) target.set(comment.essay_id, comment.created_at);
  }

  const awaiting = new Set<string>();
  for (const [essayId, coachAt] of latestCoach) {
    const authorAt = latestAuthor.get(essayId);
    if (!authorAt || coachAt > authorAt) awaiting.add(essayId);
  }
  return awaiting;
}

/** Loads comment activity for the given essays and returns those awaiting the author's reply. */
export async function getEssaysAwaitingReply(
  supabase: SupabaseClient<Database>,
  authorProfileId: string,
  essayIds: string[],
): Promise<Set<string>> {
  if (essayIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from('essay_comments')
    .select('essay_id, author_profile_id, created_at, author:profiles!author_profile_id(role)')
    .in('essay_id', essayIds)
    .is('removed_at', null);

  if (error) throw error;

  const activity: CommentActivity[] = (data ?? []).map((row) => ({
    essay_id: row.essay_id,
    author_profile_id: row.author_profile_id,
    created_at: row.created_at,
    author_role: (row.author as { role: string | null } | null)?.role ?? null,
  }));

  return essayIdsAwaitingReply(activity, authorProfileId);
}
