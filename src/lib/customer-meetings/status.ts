/**
 * Open-loop state of a meeting — drives the card/detail chip. Null = done,
 * no chip.
 *
 * Meetings cannot be planned ahead: the form constrains the date to the past
 * (max = now), so there is no "planned" state by design.
 */
export type MeetingLoop = "missing-follow-up" | "undated"

export const LOOP_LABELS: Record<MeetingLoop, string> = {
  "missing-follow-up": "Chybí follow-up",
  undated: "Bez data",
}

interface MeetingLoopInput {
  meeting_at: string | null
  post_mortem: string | null
}

export function getMeetingLoop(meeting: Pick<MeetingLoopInput, "meeting_at" | "post_mortem">): MeetingLoop | null {
  if (!meeting.meeting_at) return "undated"
  if (!meeting.post_mortem?.trim()) return "missing-follow-up"
  return null
}
