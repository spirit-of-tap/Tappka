/**
 * Open-loop state of a coaching session — drives the row chip. Null = done,
 * no chip.
 *
 * Sessions cannot be planned ahead: the form constrains the date to the past
 * (max = now), so there is no "planned" state by design.
 */
export type CoachingSessionLoop = "missing-notes" | "undated"

export const LOOP_LABELS: Record<CoachingSessionLoop, string> = {
  "missing-notes": "Chybí poznámky",
  undated: "Bez data",
}

interface CoachingSessionLoopInput {
  session_at: string | null
  key_takeaways: string | null
}

export function getCoachingSessionLoop(
  session: Pick<CoachingSessionLoopInput, "session_at" | "key_takeaways">,
): CoachingSessionLoop | null {
  if (!session.session_at) return "undated"
  if (!session.key_takeaways?.trim()) return "missing-notes"
  return null
}
