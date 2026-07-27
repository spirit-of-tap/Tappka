import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listIndividualCoachingSessions, listCoachProfiles } from "@/lib/individual-coaching-sessions/queries"
import { IndividualCoachingSessionList } from "@/components/individual-coaching-sessions/individual-coaching-session-list"
import { InfoCard } from "@/components/individual-coaching-sessions/info-card"

export const metadata = {
  title: "Individuální koučování | Tappka",
  description: "Záznamník individuálních koučovacích sezení",
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

  return (
    <div className="container mx-auto max-w-5xl py-4 sm:py-6 px-3 sm:px-6 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Individuální koučování</h1>
          <p className="text-sm text-muted-foreground">
            Záznamník koučovacích sezení s týmovým koučem
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold tabular-nums leading-none">{sessions.length}</p>
          <p className="text-sm text-muted-foreground">sezení</p>
        </div>
      </div>
      <InfoCard />
      <IndividualCoachingSessionList sessions={sessions} profileId={profile.id} coachProfiles={coachProfiles} />
    </div>
  )
}
