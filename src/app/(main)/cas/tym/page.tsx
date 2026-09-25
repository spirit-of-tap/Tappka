import { CalendarClock, Users } from "lucide-react"
import { redirect } from "next/navigation"

import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { TEAM_PARAM, WEEK_PARAM, resolveWeekParam } from "@/components/time-tracking/cas-query"
import { TeamSelect, type TeamOption } from "@/components/time-tracking/team-select"
import { TeamTimeTable } from "@/components/time-tracking/team-time-table"
import { WeekNav } from "@/components/time-tracking/week-nav"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { canAccessFeature } from "@/lib/feature-access"
import { createClient } from "@/lib/supabase/server"
import { WEEKLY_TARGET_HOURS } from "@/lib/time-tracking/constants"
import { listTeamMemberEntries } from "@/lib/time-tracking/queries"
import { getWeekRange } from "@/lib/time-tracking/week"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"

export const metadata = {
  title: "Čas týmu",
  description: "Kolik času tým tento týden věnuje Training, Reading a Practise",
}

const PAGE_TITLE = "Tým"
const TEAM_WIDE_ROLES: readonly string[] = ["coach", "admin"]

interface CasTymPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function NoTeamState({ title, description }: { title: string; description: string }) {
  return (
    <Empty>
      <EmptyMedia variant="icon">
        <Users className="size-6" />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export default async function CasTymPage({ searchParams }: CasTymPageProps) {
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
  const week = resolveWeekParam(params[WEEK_PARAM], now)

  const canPickTeam = TEAM_WIDE_ROLES.includes(profile.role)
  let teams: TeamOption[] = []
  let team: TeamOption | null = null

  if (canPickTeam) {
    const { data, error } = await supabase
      .from("teams")
      .select("id, name")
      .is("removed_at", null)
      .order("name", { ascending: true })
    if (error) throw error
    teams = data ?? []
    const requestedTeamId = firstParam(params[TEAM_PARAM])
    team = teams.find((candidate) => candidate.id === requestedTeamId) ?? teams[0] ?? null
  } else if (profile.team_id) {
    team = { id: profile.team_id, name: profile.team?.name ?? "" }
  }

  if (!team) {
    return (
      <PageShell size="wide">
        <PageHeader title={PAGE_TITLE} />
        {canPickTeam ? (
          <NoTeamState title="Zatím tu nejsou žádné týmy" description="Jakmile nějaký tým vznikne, uvidíš tady jeho čas." />
        ) : (
          <NoTeamState
            title="Nejsi v žádném týmu"
            description="Týmový přehled času se ti ukáže, až tě někdo zařadí do týmu."
          />
        )}
      </PageShell>
    )
  }

  const { members, entries } = await listTeamMemberEntries(supabase, team.id, week)
  const isCurrentWeek = week.from.getTime() === getWeekRange(now).from.getTime()

  return (
    <PageShell size="wide">
      <PageHeader
        title={PAGE_TITLE}
        description={team.name || undefined}
        count={{ value: members.length, label: pluralizeCz(members.length, ["osoba", "osoby", "osob"]) }}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {canPickTeam && <TeamSelect teams={teams} value={team.id} />}
        <WeekNav week={week} now={now} className="sm:ml-auto" />
      </div>

      {entries.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <CalendarClock className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Zatím prázdno</EmptyTitle>
            <EmptyDescription>
              {isCurrentWeek
                ? "Tento týden zatím nikdo z týmu nic nezapsal."
                : "V tomhle týdnu nikdo z týmu nic nezapsal."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <TeamTimeTable
          members={members}
          entries={entries}
          week={week}
          now={now}
          weeklyTargetHours={WEEKLY_TARGET_HOURS}
        />
      )}
    </PageShell>
  )
}
