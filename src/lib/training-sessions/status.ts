import type { SessionTiming, TsStatus } from "./types"

export function getSessionStatus(timing: Pick<SessionTiming, "startsAt" | "endsAt" | "cancelledAt">, now: Date): TsStatus {
  if (timing.cancelledAt) return "cancelled"
  const nowMs = now.getTime()
  if (nowMs >= new Date(timing.endsAt).getTime()) return "past"
  if (nowMs >= new Date(timing.startsAt).getTime()) return "ongoing"
  return "upcoming"
}
