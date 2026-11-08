/** Who may write a session's příprava (and its attachments). Mirrors the RLS policies. */

/** Admins may edit any session's preparation, e.g. to fix or complete it for a team. */
export const PREPARATION_ADMIN_ROLE = "admin"

export function canEditPreparation(viewer: { profileId: string; role: string }, facilitatorIds: readonly string[]): boolean {
  return viewer.role === PREPARATION_ADMIN_ROLE || facilitatorIds.includes(viewer.profileId)
}
