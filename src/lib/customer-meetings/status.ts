/** Open-loop state of a meeting — drives the card chip. Null = done, no chip. */
export type MeetingLoop = "planned" | "missing-follow-up" | "undated"

export const LOOP_LABELS: Record<MeetingLoop, string> = {
  planned: "Naplánováno",
  "missing-follow-up": "Chybí follow-up",
  undated: "Bez data",
}

interface MeetingLoopInput {
  meeting_at: string | null
  post_mortem: string | null
}

export function getMeetingLoop(
  meeting: Pick<MeetingLoopInput, "meeting_at" | "post_mortem">,
  now: Date = new Date(),
): MeetingLoop | null {
  if (!meeting.meeting_at) return "undated"
  if (new Date(meeting.meeting_at).getTime() > now.getTime()) return "planned"
  if (!meeting.post_mortem?.trim()) return "missing-follow-up"
  return null
}
