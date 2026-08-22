import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listIndividualCoachingSessions, listCoachProfiles } from "@/lib/individual-coaching-sessions/queries"
import { getCurrentSemesterRange } from "@/lib/metrics/periods"
import { IndividualCoachingSessionList } from "@/components/individual-coaching-sessions/individual-coaching-session-list"
import { InfoCard } from "@/components/individual-coaching-sessions/info-card"
import { HelpDialog } from "@/components/help-dialog"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"
import { Badge } from "@/components/ui/badge"
import type { IndividualCoachingSessionWithCoach } from "@/lib/individual-coaching-sessions/types"

export const metadata = {
  title: "Individuální koučování | Tappka",
  description: "Záznamník koučovacích sezení s týmovým:ou koučem:kou",
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
    <PageShell className="max-w-5xl">
      <PageHeader
        title="Individuální koučování"
        description="Záznamník koučovacích sezení s týmovým:ou koučem:kou"
        count={{ value: sessions.length, label: pluralizeCz(sessions.length, ["sezení", "sezení", "sezení"]) }}
        action={
          <div className="flex items-center gap-2">
            <HelpDialog question="Co je individuální koučování?">
              <InfoCard />
            </HelpDialog>
            <Badge variant={sessionsThisSemester > 0 ? "secondary" : "outline"}>
              {sessionsThisSemester} tento semestr
            </Badge>
          </div>
        }
      />
      <IndividualCoachingSessionList sessions={sessions} profileId={profile.id} coachProfiles={coachProfiles} />
    </PageShell>
  )
}
