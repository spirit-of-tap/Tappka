import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listBirthGivingEvents, listBirthGivingOrganizerProfiles } from "@/lib/birth-giving/queries"
import { BirthGivingIndex } from "@/components/birth-giving/birth-giving-index"
import { PageShell } from "@/components/ui/page-shell"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

export const metadata = {
  title: "Birth Giving",
  description: "Přehled hackathonů, týmových řešení a odevzdaných výstupů",
}

export default async function BirthGivingIndexPage() {
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

  const [events, organizerProfiles] = await Promise.all([
    listBirthGivingEvents(supabase),
    listBirthGivingOrganizerProfiles(supabase),
  ])

  return (
    <PageShell>
      <BirthGivingIndex
        events={events}
        profileId={profile.id}
        now={new Date().toISOString()}
        organizerProfiles={organizerProfiles}
      />
    </PageShell>
  )
}