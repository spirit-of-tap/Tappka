import { redirect } from "next/navigation"

import { RocketModelScreen } from "@/components/rocket-model/rocket-model-screen"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"
import {
  listOwnRocketHistory,
  listRocketContent,
  listRocketIndividualStates,
  listRocketTeamChecks,
} from "@/lib/rocket-model/queries"
import { createClient } from "@/lib/supabase/server"
import { listTeamMembers } from "@/lib/tymovy-denik/queries"

export const metadata = {
  title: "Rocket Model",
  description: "Osobní a týmové hodnocení podle Rocket Modelu",
}

export default async function RocketModelPage() {
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
        beta_cohort: ((profile as unknown as { beta_cohort: BetaCohort }).beta_cohort ??
          "A") as BetaCohort,
        teamName: profile.team?.name ?? null,
      },
      "rocketModel",
    )
  ) {
    return <FeatureComingSoon featureName="Rocket Model" />
  }
  if (!profile.team_id) redirect("/")

  const [categories, teamMembers] = await Promise.all([
    listRocketContent(supabase),
    listTeamMembers(supabase, profile.team_id),
  ])
  const [states, teamChecks, history] = await Promise.all([
    listRocketIndividualStates(
      supabase,
      teamMembers.map((member) => member.id),
    ),
    listRocketTeamChecks(supabase, profile.team_id),
    listOwnRocketHistory(supabase, profile.id),
  ])

  return (
    <PageShell className="max-w-5xl">
      <PageHeader
        title="Rocket Model"
        description="Osobní a týmové hodnocení podle Rocket Modelu"
      />
      <RocketModelScreen
        initialCategories={categories}
        teamMembers={teamMembers}
        initialStates={states}
        initialTeamChecks={teamChecks}
        history={history}
        profileId={profile.id}
        teamId={profile.team_id}
      />
    </PageShell>
  )
}
