import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listTeamActivities } from "@/lib/tymovy-denik/queries"
import { TeamActivityList } from "@/components/tymovy-denik/team-activity-list"
import { InfoCard } from "@/components/tymovy-denik/info-card"
import { PageHeader } from "@/components/ui/page-header"

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
    <div className="container mx-auto max-w-5xl py-4 sm:py-6 px-3 sm:px-6 space-y-4 sm:space-y-6">
      <PageHeader
        title="Týmový deník"
        description="Chronologický záznam týmových akcí mimo pracovní prostředí"
        count={{ value: activities.length, label: "akcí" }}
      />
      <InfoCard />
      <TeamActivityList activities={activities} teamId={profile.team_id} profileId={profile.id} />
    </div>
  )
}
