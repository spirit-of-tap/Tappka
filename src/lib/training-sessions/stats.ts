/**
 * Pure statistics for the TS "Statistiky" tab: facilitation counts, how early the
 * příprava was published, and attendance. Callers pass only sessions that already
 * started and were not cancelled (see `startedSessions`).
 */

export type RecordedAttendanceStatus = "present" | "late" | "excused"
/** The app never stores `absent`: a member missing from a recorded TS is absent. */
export type AttendanceStatsStatus = RecordedAttendanceStatus | "absent"

export const ATTENDANCE_STATS_STATUSES = ["present", "late", "excused", "absent"] as const satisfies readonly AttendanceStatsStatus[]

export interface StatsPerson {
  id: string
  name: string | null
}

export interface StatsSession {
  id: string
  topic: string
  startsAt: string
  facilitators: StatsPerson[]
  preparationPublishedAt: string | null
  attendance: { profileId: string; status: RecordedAttendanceStatus }[]
}

export const PREP_LEAD_BUCKETS = ["3plus", "1to3", "under1", "late", "missing"] as const
export type PrepLeadBucket = (typeof PREP_LEAD_BUCKETS)[number]

export const PREP_LEAD_BUCKET_LABELS: Record<PrepLeadBucket, string> = {
  "3plus": "3+ dny předem",
  "1to3": "1–3 dny předem",
  under1: "Méně než den předem",
  late: "Až po začátku",
  missing: "Bez přípravy",
}

/** Lower bounds (inclusive) of the lead-time buckets, in hours. */
export const PREP_LEAD_HOURS = { threePlus: 72, oneToThree: 24 } as const

export interface FacilitationRow {
  person: StatsPerson
  count: number
  isFormerMember: boolean
}

export interface PreparationRow {
  session: StatsSession
  leadHours: number | null
  bucket: PrepLeadBucket
}

export interface PreparationSummary {
  rows: PreparationRow[]
  buckets: Record<PrepLeadBucket, number>
  averageLeadHours: number | null
}

export interface MemberAttendanceRow {
  person: StatsPerson
  counts: Record<AttendanceStatsStatus, number>
  recorded: number
  rate: number | null
}

export interface SessionAttendancePoint {
  session: StatsSession
  rate: number
}

export interface TeamAttendanceSummary {
  perMember: MemberAttendanceRow[]
  overTime: SessionAttendancePoint[]
  unrecordedCount: number
}

const HOUR_MS = 60 * 60 * 1000
const HOURS_PER_DAY = 24
const ATTENDING: ReadonlySet<AttendanceStatsStatus> = new Set(["present", "late"])
const NUMBER_FORMAT = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 })

function compareNames(a: StatsPerson, b: StatsPerson): number {
  if (a.name === null) return b.name === null ? 0 : 1
  if (b.name === null) return -1
  return a.name.localeCompare(b.name, "cs")
}

function byStart(a: StatsSession, b: StatsSession): number {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
}

export function startedSessions(sessions: StatsSession[], now: Date): StatsSession[] {
  return sessions.filter((session) => new Date(session.startsAt).getTime() <= now.getTime())
}

export function countFacilitations(sessions: StatsSession[], members: StatsPerson[]): FacilitationRow[] {
  const memberIds = new Set(members.map((member) => member.id))
  const counts = new Map<string, number>()
  const former = new Map<string, StatsPerson>()
  for (const session of sessions) {
    for (const facilitator of session.facilitators) {
      counts.set(facilitator.id, (counts.get(facilitator.id) ?? 0) + 1)
      if (!memberIds.has(facilitator.id)) former.set(facilitator.id, facilitator)
    }
  }
  const byCount = (a: FacilitationRow, b: FacilitationRow) => b.count - a.count || compareNames(a.person, b.person)
  const current = members.map((person) => ({ person, count: counts.get(person.id) ?? 0, isFormerMember: false })).sort(byCount)
  const formerRows = [...former.values()]
    .map((person) => ({ person, count: counts.get(person.id) ?? 0, isFormerMember: true }))
    .sort(byCount)
  return [...current, ...formerRows]
}

function leadBucket(leadHours: number | null): PrepLeadBucket {
  if (leadHours === null) return "missing"
  if (leadHours >= PREP_LEAD_HOURS.threePlus) return "3plus"
  if (leadHours >= PREP_LEAD_HOURS.oneToThree) return "1to3"
  if (leadHours > 0) return "under1"
  return "late"
}

export function summarizePreparation(sessions: StatsSession[]): PreparationSummary {
  const buckets = Object.fromEntries(PREP_LEAD_BUCKETS.map((bucket) => [bucket, 0])) as Record<PrepLeadBucket, number>
  const rows = [...sessions].sort(byStart).map((session) => {
    const leadHours =
      session.preparationPublishedAt === null
        ? null
        : (new Date(session.startsAt).getTime() - new Date(session.preparationPublishedAt).getTime()) / HOUR_MS
    const bucket = leadBucket(leadHours)
    buckets[bucket] += 1
    return { session, leadHours, bucket }
  })
  const published = rows.flatMap((row) => (row.leadHours === null ? [] : [row.leadHours]))
  const averageLeadHours = published.length === 0 ? null : published.reduce((sum, hours) => sum + hours, 0) / published.length
  return { rows, buckets, averageLeadHours }
}

function emptyCounts(): Record<AttendanceStatsStatus, number> {
  return { present: 0, late: 0, excused: 0, absent: 0 }
}

export function summarizeTeamAttendance(sessions: StatsSession[], members: StatsPerson[]): TeamAttendanceSummary {
  const memberIds = new Set(members.map((member) => member.id))
  const perMemberCounts = new Map(members.map((member) => [member.id, emptyCounts()]))
  const overTime: SessionAttendancePoint[] = []
  let unrecordedCount = 0

  for (const session of [...sessions].sort(byStart)) {
    const statuses = new Map(
      session.attendance.filter((row) => memberIds.has(row.profileId)).map((row) => [row.profileId, row.status]),
    )
    if (statuses.size === 0) {
      unrecordedCount += 1
      continue
    }
    let attending = 0
    for (const member of members) {
      const status: AttendanceStatsStatus = statuses.get(member.id) ?? "absent"
      const counts = perMemberCounts.get(member.id)
      if (counts) counts[status] += 1
      if (ATTENDING.has(status)) attending += 1
    }
    overTime.push({ session, rate: attending / members.length })
  }

  const recorded = overTime.length
  const perMember = members
    .map((person) => {
      const counts = perMemberCounts.get(person.id) ?? emptyCounts()
      const rate = recorded === 0 ? null : (counts.present + counts.late) / recorded
      return { person, counts, recorded, rate }
    })
    .sort((a, b) => {
      if (a.rate === null) return b.rate === null ? compareNames(a.person, b.person) : 1
      if (b.rate === null) return -1
      return a.rate - b.rate || compareNames(a.person, b.person)
    })

  return { perMember, overTime, unrecordedCount }
}

function dayWord(days: number): string {
  if (!Number.isInteger(days)) return "dne"
  if (days === 1) return "den"
  if (days >= 2 && days <= 4) return "dny"
  return "dní"
}

/** "5 h", "1 den", "2 dny", "2,4 dne", "5 dní" — by size, the caller words the direction. */
export function formatLeadTime(hours: number): string {
  const absolute = Math.abs(hours)
  if (absolute < HOURS_PER_DAY) return `${Math.round(absolute)} h`
  const days = Math.round((absolute / HOURS_PER_DAY) * 10) / 10
  return `${NUMBER_FORMAT.format(days)} ${dayWord(days)}`
}
