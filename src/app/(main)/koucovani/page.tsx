import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listIndividualCoachingSessions, listCoachProfiles } from "@/lib/individual-coaching-sessions/queries"
import { IndividualCoachingSessionsView } from "@/components/individual-coaching-sessions/individual-coaching-sessions-view"
import { PageShell } from "@/components/ui/page-shell"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

export const metadata = {
  title: "Individuální koučování",
  description: "Záznamník koučovacích sezení s týmovým:ou koučem:kou",
}

export default async function KoucovaniPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (
    !canAccessFeature(
      {
        role: profile.role,
        beta_access_granted_at: profile.beta_access_granted_at,
        beta_cohort: ((profile as unknown as { beta_cohort: BetaCohort }).beta_cohort ?? "A") as BetaCohort,
      },
      "coaching",
    )
  ) {
    return <FeatureComingSoon featureName="Koučování" />
  }

  const [sessions, coachProfiles] = await Promise.all([
    listIndividualCoachingSessions(supabase, profile.id),
    listCoachProfiles(supabase),
  ])

  // Computed once on the server and passed down so client-side month grouping
  // hydrates against the exact same reference time (no TZ/boundary drift).
  const now = new Date()

  return (
    <PageShell className="max-w-5xl">
      <IndividualCoachingSessionsView
        sessions={sessions}
        profileId={profile.id}
        coachProfiles={coachProfiles}
        now={now}
        onboardingYear={profile.team?.onboardingYear ?? null}
      />
    </PageShell>
  )
}
