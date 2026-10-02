import { redirect } from "next/navigation"

import { SessionForm } from "@/components/training-sessions/session-form"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { pragueDateKey } from "@/lib/training-sessions/format"
import { listRooms, listTeamSlotSources } from "@/lib/training-sessions/queries"
import { getUpcomingTeamSlots } from "@/lib/training-sessions/slots"
import { listTeamMembers } from "@/lib/tymovy-denik/queries"

const PAGE_DESCRIPTION = "Naplánuj tréninkovou session svého týmu"

export const metadata = {
  title: "Nové TS",
  description: PAGE_DESCRIPTION,
}

const DEFAULT_START = "08:00"
const DEFAULT_END = "12:00"

export default async function NewTsPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.team_id) redirect(TS_ROUTES.overview)
  const supabase = await createClient()
  const [sources, rooms, teamMembers] = await Promise.all([
    listTeamSlotSources(supabase, profile.team_id),
    listRooms(supabase),
    listTeamMembers(supabase, profile.team_id),
  ])
  const now = new Date()
  const slots = getUpcomingTeamSlots({
    schedules: sources.schedules,
    breaks: sources.breaks,
    takenDateKeys: sources.takenStarts.map(pragueDateKey),
    now,
  })

  return (
    <PageShell size="medium">
      <PageHeader title="Nové TS" description={PAGE_DESCRIPTION} back={{ href: TS_ROUTES.overview, label: "Přehled" }} />
      <SessionForm
        mode={{ kind: "create" }}
        initial={{
          topic: "",
          description: "",
          date: pragueDateKey(now),
          startTime: DEFAULT_START,
          endTime: DEFAULT_END,
          roomId: null,
          locationNote: "",
          guestCapacity: 0,
          facilitatorIds: [],
        }}
        rooms={rooms}
        teamMembers={teamMembers}
        slots={slots}
      />
    </PageShell>
  )
}
