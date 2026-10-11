import { ChartColumn, Users } from "lucide-react"
import { redirect } from "next/navigation"

import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { TEAM_PARAM, resolveRangeParams } from "@/components/time-tracking/cas-query"
import { resolveCasTeam } from "@/components/time-tracking/cas-team"
import { DateRangeNav } from "@/components/time-tracking/date-range-nav"
import { ReportingView } from "@/components/time-tracking/reporting-view"
import { TeamSelect } from "@/components/time-tracking/team-select"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { canAccessFeature } from "@/lib/feature-access"
import { createClient } from "@/lib/supabase/server"
import { listTags, listTeamMemberEntries } from "@/lib/time-tracking/queries"

const PAGE_TITLE = "Reporting"

export const metadata = {
  title: "Reporting času",
  description: "Grafy času týmu podle směrů a tagů s exportem do PNG a CSV",
}

interface CasReportingPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function CasReportingPage({ searchParams }: CasReportingPageProps) {
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
  // One reference time for the whole render so running timers add up consistently.
  const now = new Date()
  const { range, instants, todayKey } = resolveRangeParams(params, now)
  const { canPickTeam, teams, team } = await resolveCasTeam(supabase, profile, firstParam(params[TEAM_PARAM]))

  if (!team) {
    return (
      <PageShell size="wide">
        <PageHeader title={PAGE_TITLE} />
        <Empty>
          <EmptyMedia variant="icon">
            <Users className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>{canPickTeam ? "Zatím tu nejsou žádné týmy" : "Nejsi v žádném týmu"}</EmptyTitle>
            <EmptyDescription>Reporting ukazuje čas týmu, takže se objeví, až bude s kým počítat.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </PageShell>
    )
  }

  const [{ members, entries }, tags] = await Promise.all([
    listTeamMemberEntries(supabase, team.id, instants),
    listTags(supabase, team.id),
  ])

  return (
    <PageShell size="wide">
      <PageHeader title={PAGE_TITLE} description={team.name || undefined} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {canPickTeam && <TeamSelect teams={teams} value={team.id} />}
        <DateRangeNav range={range} todayKey={todayKey} align="end" className="sm:ml-auto" />
      </div>

      {entries.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <ChartColumn className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Zatím není co kreslit</EmptyTitle>
            <EmptyDescription>V tomhle období zatím nikdo z týmu nic nezapsal. Zkus delší období.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ReportingView
          teamName={team.name}
          members={members}
          entries={entries}
          tags={tags}
          range={range}
          instants={instants}
          now={now}
        />
      )}
    </PageShell>
  )
}
