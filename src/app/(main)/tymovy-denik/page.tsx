import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listTeamActivities } from "@/lib/tymovy-denik/queries"
import { TeamActivityList } from "@/components/tymovy-denik/team-activity-list"
import { PageShell } from "@/components/ui/page-shell"

export const metadata = {
  title: "Týmový deník | Tappka",
  description: "Chronologický záznam týmových akcí mimo pracovní prostředí",
}

export default async function TymovyDenikPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")
  if (!profile.team_id) redirect("/")

  const activities = await listTeamActivities(supabase, profile.team_id)

  return (
    <PageShell className="max-w-5xl">
      <TeamActivityList activities={activities} />
    </PageShell>
  )
}
