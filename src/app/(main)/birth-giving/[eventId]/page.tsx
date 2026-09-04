import { notFound, redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { getBirthGivingEvent, listBirthGivingOrganizerProfiles } from "@/lib/birth-giving/queries"
import { BirthGivingEventDetail } from "@/components/birth-giving/event-detail"
import { PageShell } from "@/components/ui/page-shell"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

interface BirthGivingEventPageProps {
  params: Promise<{ eventId: string }>
}

export const metadata = {
  title: "Birth Giving",
  description: "Detail Birth Giving události, týmů a výsledků",
}

export default async function BirthGivingEventPage({ params }: BirthGivingEventPageProps) {
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

  const { eventId } = await params
  const [event, organizerProfiles] = await Promise.all([
    getBirthGivingEvent(supabase, eventId),
    listBirthGivingOrganizerProfiles(supabase),
  ])
  if (!event) notFound()

  return (
    <PageShell>
      <BirthGivingEventDetail
        event={event}
        profileId={profile.id}
        organizerProfiles={organizerProfiles}
        now={new Date().toISOString()}
      />
    </PageShell>
  )
}