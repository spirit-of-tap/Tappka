import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listTeamActivities, listTeamMembers } from "@/lib/tymovy-denik/queries"
import { TeamActivityList } from "@/components/tymovy-denik/team-activity-list"
import { PageShell } from "@/components/ui/page-shell"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

export const metadata = {
  title: "Týmový deník",
  description: "Chronologický záznam týmových akcí mimo pracovní prostředí",
}

export default async function TymovyDenikPage() {
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
      "teamDiary",
    )
  ) {
    return <FeatureComingSoon featureName="Týmový deník" />
  }
  if (!profile.team_id) redirect("/")

  const [activities, teamMembers] = await Promise.all([
    listTeamActivities(supabase, profile.team_id),
    listTeamMembers(supabase, profile.team_id),
  ])

  return (
    <PageShell className="max-w-5xl">
      <TeamActivityList
        activities={activities}
        teamMembers={teamMembers}
        onboardingYear={profile.team?.onboardingYear ?? null}
      />
    </PageShell>
  )
}
