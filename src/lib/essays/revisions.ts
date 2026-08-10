/**
 * How long a single revision keeps absorbing edits before autosave cuts a new
 * one. Measured from `created_at` (not `updated_at`) so the window is a hard
 * cap: a long writing session yields one history entry per half hour rather
 * than one entry for the whole session or one per keystroke.
 *
 * Kept in sync by hand with the interval in the `essay_revisions` UPDATE
 * policy in `db/schema/essays.ts` — RLS is the boundary, this is the precision.
 */
export const REVISION_COALESCE_WINDOW_MINUTES = 30;

export interface CoalesceCandidate {
  revision_no: number;
  created_at: string;
  created_by_profile_id: string;
}

/**
 * Decides whether an autosave should overwrite the newest revision or cut a
 * new one. Callers must pass the highest-numbered revision for the essay.
 */
export function shouldCoalesceRevision(
  latest: CoalesceCandidate | null,
  profileId: string,
  nowIso: string,
): boolean {
  if (!latest) return false;
  if (latest.created_by_profile_id !== profileId) return false;

  const ageMs = new Date(nowIso).getTime() - new Date(latest.created_at).getTime();
  if (Number.isNaN(ageMs)) return false;

  return ageMs >= 0 && ageMs < REVISION_COALESCE_WINDOW_MINUTES * 60_000;
}