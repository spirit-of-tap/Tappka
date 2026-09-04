import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listToolsTechniques } from "@/lib/nastroje-techniky/queries"
import { ToolsTechniquesView } from "@/components/nastroje-techniky/tools-techniques-view"
import { PageShell } from "@/components/ui/page-shell"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

export const metadata = {
  title: "Nástroje a techniky",
  description: "Katalog modelů, technik a nástrojů, které umíš používat pro efektivní práci",
}

export default async function NastrojeTechnikyPage() {
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
      "toolsTechniques",
    )
  ) {
    return <FeatureComingSoon featureName="Nástroje a techniky" />
  }

  const items = await listToolsTechniques(supabase, profile.id)

  return (
    <PageShell className="max-w-5xl">
      <ToolsTechniquesView items={items} profileId={profile.id} />
    </PageShell>
  )
}
