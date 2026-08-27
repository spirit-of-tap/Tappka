import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listPersonalityTests } from "@/lib/personality-tests/queries"
import { PersonalityTestsView } from "@/components/personality-tests/personality-tests-view"
import { PageShell } from "@/components/ui/page-shell"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

export const metadata = {
  title: "Osobnostní testy | Tappka",
  description: "Výsledky osobnostních testů a jejich vývoj v čase",
}

export default async function OsobnostniTestyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
      "personalityTests",
    )
  ) {
    return <FeatureComingSoon featureName="Osobnostní testy" />
  }

  const tests = await listPersonalityTests(supabase, profile.id)

  return (
    <PageShell className="max-w-5xl">
      <PersonalityTestsView
        tests={tests}
        profileId={profile.id}
        onboardingYear={profile.team?.onboardingYear ?? null}
      />
    </PageShell>
  )
}
