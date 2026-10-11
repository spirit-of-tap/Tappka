import { redirect } from "next/navigation"

import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { resolveRangeParams } from "@/components/time-tracking/cas-query"
import { TimeCalendar } from "@/components/time-tracking/time-calendar"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { canAccessFeature } from "@/lib/feature-access"
import { createClient } from "@/lib/supabase/server"
import { rangeToInstants, weekRangeOf } from "@/lib/time-tracking/date-range"
import { getTagCatalog, listEntries } from "@/lib/time-tracking/queries"

export const metadata = {
  title: "Kalendář času",
  description: "Tvoje záznamy času v týdenním kalendáři",
}

interface CasKalendarPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CasKalendarPage({ searchParams }: CasKalendarPageProps) {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims?.sub) redirect("/auth/login")

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
  // One reference time for the whole render so the running timer and the now line agree.
  const now = new Date()
  const { range, todayKey } = resolveRangeParams(params, now)
  // The calendar always shows a whole Monday–Sunday week: the one the period starts in.
  const week = weekRangeOf(range.from)
  const instants = rangeToInstants(week)

  const [entries, { tags, selectedTagIds, newTagCount }] = await Promise.all([
    listEntries(supabase, { profileIds: [profile.id], from: instants.from, to: instants.to }),
    getTagCatalog(supabase, profile),
  ])

  return (
    <PageShell size="full">
      <TimeCalendar
        entries={entries}
        tagCatalog={{ tags, selectedTagIds, newTagCount }}
        weekStartKey={week.from}
        todayKey={todayKey}
        now={now}
      />
    </PageShell>
  )
}
