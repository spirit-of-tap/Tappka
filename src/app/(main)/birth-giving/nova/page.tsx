import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listBirthGivingOrganizerProfiles } from "@/lib/birth-giving/queries"
import { BirthGivingUpcomingCreate } from "@/components/birth-giving/upcoming-create"
import { PageShell } from "@/components/ui/page-shell"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

export const metadata = {
  title: "Nová Birth Giving událost",
  description: "Nastav termín, místo a organizátory nadcházející události",
}

export default async function BirthGivingNovaPage() {
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
      "birthGiving",
    )
  ) {
    return <FeatureComingSoon featureName="Birth Giving" />
  }

  const organizerProfiles = await listBirthGivingOrganizerProfiles(supabase)

  return (
    <PageShell>
      <PageHeader
        title="Nová Birth Giving událost"
        description="Nastav termín, místo a organizátory nadcházející události"
        back={{ href: "/birth-giving", label: "Zpět na přehled" }}
      />
      <Card className="p-3 sm:p-5">
        <BirthGivingUpcomingCreate
          profileId={profile.id}
          organizerProfiles={organizerProfiles}
        />
      </Card>
    </PageShell>
  )
}