import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { getSemesterReflectionWithEntries } from "@/lib/tymova-reflexe/semester-queries"
import { RocnikovaReflectionDetail } from "@/components/tymova-reflexe/rocnikova-reflection-detail"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

export const metadata = {
  title: "Ročníková reflexe | Tappka",
}

export default async function RocnikovaReflexeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

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

  const result = await getSemesterReflectionWithEntries(supabase, id)
  if (!result) notFound()

  return (
    <RocnikovaReflectionDetail
      reflection={result.reflection}
      entries={result.entries}
      profileId={profile.id}
    />
  )
}
