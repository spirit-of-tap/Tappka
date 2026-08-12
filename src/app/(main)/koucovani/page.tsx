import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listIndividualCoachingSessions, listCoachProfiles } from "@/lib/individual-coaching-sessions/queries"
import { IndividualCoachingSessionList } from "@/components/individual-coaching-sessions/individual-coaching-session-list"
import { InfoCard } from "@/components/individual-coaching-sessions/info-card"
import { PageHeader } from "@/components/ui/page-header"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"
import { Badge } from "@/components/ui/badge"
import type { IndividualCoachingSessionWithCoach } from "@/lib/individual-coaching-sessions/types"

export const metadata = {
  title: "Individuální koučování | Tappka",
  description: "Záznamník individuálních koučovacích sezení",
}

// Czech academic year splits roughly into a winter semester (September–January)
// and a summer semester (February–August, which absorbs the summer break).
// This mirrors the school-year convention used elsewhere in the app
// (see src/lib/tymova-reflexe/month-grid.ts), but there's no existing shared
// helper for this "which semester are we in right now" check, so it's kept
// local to this page rather than promoted to a shared module.
const WINTER_SEMESTER_START_MONTH = 9 // September (1-indexed month)
const SUMMER_SEMESTER_START_MONTH = 2 // February (1-indexed month)

function getCurrentSemesterRange(now: Date): { start: Date; end: Date } {
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  if (month >= WINTER_SEMESTER_START_MONTH) {
    // September–December: winter semester runs into January of next year.
    return { start: new Date(year, 8, 1), end: new Date(year + 1, 1, 1) }
  }
  if (month < SUMMER_SEMESTER_START_MONTH) {
    // January: still the winter semester that started last September.
    return { start: new Date(year - 1, 8, 1), end: new Date(year, 1, 1) }
  }
  // February–August: summer semester.
  return { start: new Date(year, 1, 1), end: new Date(year, 8, 1) }
}

function countSessionsInCurrentSemester(sessions: IndividualCoachingSessionWithCoach[]): number {
  const { start, end } = getCurrentSemesterRange(new Date())
  return sessions.filter((session) => {
    if (!session.session_at) return false
    const sessionDate = new Date(session.session_at)
    return sessionDate >= start && sessionDate < end
  }).length
}

export default async function KoucovaniPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")

  const [sessions, coachProfiles] = await Promise.all([
    listIndividualCoachingSessions(supabase, profile.id),
    listCoachProfiles(supabase),
  ])

  const sessionsThisSemester = countSessionsInCurrentSemester(sessions)

  return (
    <div className="container mx-auto max-w-5xl py-4 sm:py-6 px-3 sm:px-6 space-y-4 sm:space-y-6">
      <PageHeader
        title="Individuální koučování"
        description="Záznamník koučovacích sezení s týmovým:ou koučem:kou"
        count={{ value: sessions.length, label: pluralizeCz(sessions.length, ["sezení", "sezení", "sezení"]) }}
        action={
          <Badge variant={sessionsThisSemester > 0 ? "secondary" : "outline"}>
            {sessionsThisSemester} tento semestr
          </Badge>
        }
      />
      <InfoCard />
      <IndividualCoachingSessionList sessions={sessions} profileId={profile.id} coachProfiles={coachProfiles} />
    </div>
  )
}
