import { notFound, redirect } from "next/navigation"

import { SessionForm } from "@/components/training-sessions/session-form"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { pragueDateKey, toTimeInputValue } from "@/lib/training-sessions/format"
import { getSessionDetail, listRooms } from "@/lib/training-sessions/queries"
import { listTeamMembers } from "@/lib/tymovy-denik/queries"

const PAGE_DESCRIPTION = "Uprav termín, místo, facilitaci a místa pro hosty"

export const metadata = {
  title: "Upravit TS",
  description: PAGE_DESCRIPTION,
}

export default async function EditTsPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  const { id } = await params
  const supabase = await createClient()
  const session = await getSessionDetail(supabase, id)
  if (!session) notFound()
  if (session.team_id !== profile.team_id) redirect(TS_ROUTES.detail(id))
  const [rooms, teamMembers] = await Promise.all([listRooms(supabase), listTeamMembers(supabase, session.team_id)])

  const teamMemberIds = new Set(teamMembers.map((m) => m.id))

  return (
    <PageShell size="medium">
      <PageHeader title="Upravit TS" description={PAGE_DESCRIPTION} back={{ href: TS_ROUTES.detail(id), label: session.topic }} />
      <SessionForm
        mode={{ kind: "edit", id }}
        initial={{
          topic: session.topic,
          description: session.description ?? "",
          date: pragueDateKey(session.starts_at),
          startTime: toTimeInputValue(session.starts_at),
          endTime: toTimeInputValue(session.ends_at),
          roomId: session.room_id,
          locationNote: session.location_note ?? "",
          guestCapacity: session.guest_capacity,
          facilitatorIds: session.facilitators.flatMap((f) => (f.profile && teamMemberIds.has(f.profile.id) ? [f.profile.id] : [])),
        }}
        rooms={rooms}
        teamMembers={teamMembers}
        slots={[]}
      />
    </PageShell>
  )
}
