import { Users } from "lucide-react"
import { redirect } from "next/navigation"

import { TEAM_PARAM, formatRangeLabel, resolveRangeParams } from "@/components/time-tracking/cas-query"
import { TEAM_WIDE_ROLES, resolveCasTeam } from "@/components/time-tracking/cas-team"
import { slugify } from "@/components/time-tracking/chart-export"
import { DateRangeNav } from "@/components/time-tracking/date-range-nav"
import { TeamSelect } from "@/components/time-tracking/team-select"
import { TsStatsView } from "@/components/training-sessions/stats/ts-stats-view"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { semesterRange } from "@/lib/time-tracking/date-range"
import { listStatsSessions } from "@/lib/training-sessions/queries"
import { startedSessions } from "@/lib/training-sessions/stats"
import { listTeamMembers } from "@/lib/tymovy-denik/queries"

const PAGE_TITLE = "Statistiky"

export const metadata = {
  title: "Statistiky TS",
  description: "Facilitace, příprava a docházka týmu na TS",
}

interface TsStatsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

// Feature access is checked by the /ts layout.
export default async function TsStatsPage({ searchParams }: TsStatsPageProps) {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  const supabase = await createClient()

  const params = await searchParams
  // One reference time for the whole render: the period and "already started" agree.
  const now = new Date()
  const { range, instants, todayKey } = resolveRangeParams(params, now, semesterRange)
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
            <EmptyDescription>Statistiky ukazují TS týmu, takže se objeví, až bude s kým počítat.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </PageShell>
    )
  }

  // Attendance is team-only under RLS, coaches included; don't even ask for it.
  const showAttendance = !TEAM_WIDE_ROLES.includes(profile.role)
  const [members, sessions] = await Promise.all([
    listTeamMembers(supabase, team.id),
    listStatsSessions(supabase, team.id, instants, { includeAttendance: showAttendance }),
  ])
  const rangeLabel = formatRangeLabel(range)

  return (
    <PageShell size="wide">
      <PageHeader title={PAGE_TITLE} description={team.name || undefined} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {canPickTeam && <TeamSelect teams={teams} value={team.id} />}
        <DateRangeNav range={range} todayKey={todayKey} defaultRange={semesterRange(todayKey)} align="end" className="sm:ml-auto" />
      </div>

      <TsStatsView
        teamName={team.name}
        rangeLabel={rangeLabel}
        fileNamePrefix={["ts", slugify(team.name), range.from, range.to].filter(Boolean).join("-")}
        members={members.map((member) => ({ id: member.id, name: member.name }))}
        sessions={startedSessions(sessions, now)}
        showAttendance={showAttendance}
      />
    </PageShell>
  )
}
