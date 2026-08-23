/**
 * Open-loop state of a team activity — drives the row chip. Null = done,
 * no chip.
 *
 * There is no undated state: occurred_at is NOT NULL.
 */
export type TeamActivityLoop = "missing-reflection"

export const LOOP_LABELS: Record<TeamActivityLoop, string> = {
  "missing-reflection": "Chybí reflexe",
}

export function getTeamActivityLoop(activity: {
  reflection: string | null
}): TeamActivityLoop | null {
  if (!activity.reflection?.trim()) return "missing-reflection"
  return null
}
