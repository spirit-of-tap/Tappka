import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listTeamReflections } from "@/lib/tymova-reflexe/queries"
import { listTeamSemesterReflectionsWithProgress } from "@/lib/tymova-reflexe/semester-queries"
import { listTeamMembers } from "@/lib/tymovy-denik/queries"
import { TeamReflectionView } from "@/components/tymova-reflexe/team-reflection-view"
import { PageShell } from "@/components/ui/page-shell"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

export const metadata = {
  title: "Týmová reflexe",
  description: "Pravidelné ohlédnutí za týmovou spoluprací a rozvojem",
}

export default async function TymovaReflexePage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
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
      "teamReflection",
    )
  ) {
    return <FeatureComingSoon featureName="Týmová reflexe" />
  }
  if (!profile.team_id) redirect("/")

  const [reflections, rocnikovaReflections, teamMembers] = await Promise.all([
    listTeamReflections(supabase, profile.team_id),
    listTeamSemesterReflectionsWithProgress(supabase, profile.team_id),
    listTeamMembers(supabase, profile.team_id),
  ])

  return (
    <PageShell className="max-w-5xl">
      <TeamReflectionView
        reflections={reflections}
        rocnikovaReflections={rocnikovaReflections}
        teamMembers={teamMembers}
        onboardingYear={profile.team?.onboardingYear ?? null}
      />
    </PageShell>
  )
}
