import type { SessionTiming } from "./types"

export interface SessionConflict<T extends SessionTiming> {
  commitment: T
  overlapStart: string
  overlapEnd: string
}

export function findConflicts<T extends SessionTiming>(candidate: SessionTiming, commitments: T[]): SessionConflict<T>[] {
  if (candidate.cancelledAt) return []
  const start = new Date(candidate.startsAt).getTime()
  const end = new Date(candidate.endsAt).getTime()
  return commitments.flatMap((commitment) => {
    if (commitment.id === candidate.id || commitment.cancelledAt) return []
    const cStart = new Date(commitment.startsAt).getTime()
    const cEnd = new Date(commitment.endsAt).getTime()
    if (!(start < cEnd && end > cStart)) return []
    return [
      {
        commitment,
        overlapStart: start > cStart ? candidate.startsAt : commitment.startsAt,
        overlapEnd: end < cEnd ? candidate.endsAt : commitment.endsAt,
      },
    ]
  })
}
