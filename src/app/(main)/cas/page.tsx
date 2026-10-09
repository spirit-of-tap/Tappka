import { redirect } from "next/navigation"

import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { resolveRangeParams } from "@/components/time-tracking/cas-query"
import { TimePageView } from "@/components/time-tracking/time-page-view"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { canAccessFeature } from "@/lib/feature-access"
import { createClient } from "@/lib/supabase/server"
import { listEntries, listTags } from "@/lib/time-tracking/queries"

export const metadata = {
  title: "Čas",
  description: "Kolik času věnuješ Training, Reading, Practise a Projektu",
}

interface CasPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CasPage({ searchParams }: CasPageProps) {
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
        beta_cohort: profile.beta_cohort ?? "A",
      },
      "timeTracking",
    )
  ) {
    return <FeatureComingSoon featureName="Čas" />
  }

  const params = await searchParams
  // One reference time for the whole render so running timers add up consistently.
  const now = new Date()
  const { range, instants, todayKey } = resolveRangeParams(params, now)

  const [entries, tags] = await Promise.all([
    listEntries(supabase, { profileIds: [profile.id], from: instants.from, to: instants.to }),
    listTags(supabase, profile.id),
  ])

  return (
    <PageShell size="wide">
      <TimePageView
        entries={entries}
        tags={tags}
        range={range}
        instants={instants}
        todayKey={todayKey}
        now={now}
        profileId={profile.id}
      />
    </PageShell>
  )
}
