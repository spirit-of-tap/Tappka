import { redirect } from "next/navigation"

import { TeamCalendarSettings, type TeamCalendarConnection } from "@/components/settings/team-calendar-settings"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { PageHeader } from "@/components/ui/page-header"
import { getSessionProfile } from "@/lib/auth/session"
import { readServiceAccount } from "@/lib/google-calendar/client"
import { canSeeSettingsSection, SETTINGS_ROUTES } from "@/lib/settings/sections"
import { createClient } from "@/lib/supabase/server"
import { CALENDAR_ADMIN_ROLES } from "@/lib/training-sessions/calendar-sync-events"

const DEFAULT_BETA_COHORT = "A" as const
const PAGE_TITLE = "Google Kalendář týmu"
const PAGE_DESCRIPTION = "Training Sessions se samy propisují do sdíleného kalendáře týmu"

export const metadata = { title: PAGE_TITLE, description: PAGE_DESCRIPTION }

interface PageProps {
  searchParams: Promise<{ tym?: string }>
}

export default async function TeamCalendarSettingsPage({ searchParams }: PageProps) {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  const access = {
    role: profile.role,
    beta_access_granted_at: profile.beta_access_granted_at,
    beta_cohort: profile.beta_cohort ?? DEFAULT_BETA_COHORT,
    teamId: profile.team_id,
  }
  if (!canSeeSettingsSection(access, "ts")) redirect(SETTINGS_ROUTES.root)

  const supabase = await createClient()
  const isCoach = CALENDAR_ADMIN_ROLES.includes(profile.role)
  const { tym } = await searchParams

  let teams: { id: string; name: string }[] = []
  if (isCoach) {
    const { data } = await supabase.from("teams").select("id, name").order("name")
    teams = data ?? []
  } else if (profile.team_id) {
    const { data } = await supabase.from("teams").select("id, name").eq("id", profile.team_id).maybeSingle()
    teams = data ? [data] : []
  }
  const team = teams.find((t) => t.id === tym) ?? teams.find((t) => t.id === profile.team_id) ?? teams[0]

  const header = <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
  if (!team) {
    return (
      <div className="space-y-6">
        {header}
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyTitle>Zatím tu není žádný tým</EmptyTitle>
            <EmptyDescription>Kalendář se propojuje vždy pro konkrétní tým.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const [{ data: calendar }, { data: failures }] = await Promise.all([
    supabase.from("team_google_calendars").select("calendar_id, calendar_name, last_synced_at").eq("team_id", team.id).maybeSingle(),
    supabase
      .from("training_session_calendar_events")
      .select("training_session_id, error_message, session:training_sessions(topic, starts_at)")
      .eq("team_id", team.id)
      .eq("status", "failed")
      .order("attempted_at", { ascending: false }),
  ])

  const connection: TeamCalendarConnection | null = calendar
    ? {
        calendarId: calendar.calendar_id,
        calendarName: calendar.calendar_name,
        lastSyncedAt: calendar.last_synced_at,
        failures: (failures ?? []).flatMap((row) =>
          row.session
            ? [{ sessionId: row.training_session_id, topic: row.session.topic, startsAt: row.session.starts_at, errorMessage: row.error_message }]
            : [],
        ),
      }
    : null

  return (
    <div className="max-w-2xl space-y-6">
      {header}
      <TeamCalendarSettings
        team={team}
        teams={isCoach ? teams : null}
        robotEmail={readServiceAccount()?.email ?? null}
        connection={connection}
      />
    </div>
  )
}
