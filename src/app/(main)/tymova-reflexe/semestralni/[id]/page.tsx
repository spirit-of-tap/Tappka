import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

export default async function SemestralniReflexeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
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

  const { id } = await params
  redirect(`/tymova-reflexe/rocnikova/${id}`)
}
