import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listBirthGivingOrganizerProfiles } from "@/lib/birth-giving/queries"
import { BirthGivingRetrospectiveWizard } from "@/components/birth-giving/retrospektiva/birth-giving-retrospective-wizard"
import { PageShell } from "@/components/ui/page-shell"
import { PageHeader } from "@/components/ui/page-header"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

export const metadata = {
  title: "Historická Birth Giving událost",
  description: "Zapiš proběhlou událost po krocích — změny se ukládají průběžně",
}

export default async function BirthGivingHistorieNovaPage() {
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
        title="Nová historická událost"
        description="Zapiš proběhlou událost po krocích — změny se ukládají průběžně"
        back={{ href: "/birth-giving", label: "Zpět na přehled" }}
      />
      <BirthGivingRetrospectiveWizard
        profileId={profile.id}
        organizerProfiles={organizerProfiles}
      />
    </PageShell>
  )
}