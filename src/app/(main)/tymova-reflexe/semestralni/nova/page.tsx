import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

export default async function SemestralniNovaPage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string; month?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

  const params = await searchParams
  const query = params.semester ? `?month=${params.semester}` : params.month ? `?month=${params.month}` : ""
  redirect(`/tymova-reflexe/rocnikova/nova${query}`)
}
