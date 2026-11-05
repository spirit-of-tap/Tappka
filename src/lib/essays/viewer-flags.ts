import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';
import type { EssayWithDetails } from './types';

export interface ViewerEssayFlags {
  votedIds: Set<string>;
  viewedIds: Set<string>;
}

/** Which of `essayIds` the viewer already liked or opened (RLS limits both tables to the viewer's own rows here). */
export async function getViewerEssayFlags(
  supabase: SupabaseClient<Database>,
  profileId: string | null | undefined,
  essayIds: string[],
): Promise<ViewerEssayFlags> {
  const flags: ViewerEssayFlags = { votedIds: new Set(), viewedIds: new Set() };
  if (!profileId || essayIds.length === 0) return flags;

  const [votes, views] = await Promise.all([
    supabase.from('essay_votes').select('essay_id').eq('voter_profile_id', profileId).in('essay_id', essayIds),
    supabase.from('essay_views').select('essay_id').eq('viewer_profile_id', profileId).in('essay_id', essayIds),
  ]);
  votes.data?.forEach((row) => flags.votedIds.add(row.essay_id));
  views.data?.forEach((row) => flags.viewedIds.add(row.essay_id));
  return flags;
}

export function annotateViewerFlags<T extends EssayWithDetails>(
  essays: T[],
  flags: ViewerEssayFlags,
): Array<T & { user_has_voted: boolean; user_has_viewed: boolean }> {
  return essays.map((essay) => ({
    ...essay,
    user_has_voted: flags.votedIds.has(essay.id),
    user_has_viewed: flags.viewedIds.has(essay.id),
  }));
}
