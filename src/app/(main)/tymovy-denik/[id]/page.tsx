import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listTeamActivities, listTeamMembers } from "@/lib/tymovy-denik/queries"
import { TeamActivityDetail } from "@/components/tymovy-denik/team-activity-detail"
import { PageBack } from "@/components/ui/page-back"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

interface TeamActivityDetailPageProps {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: "Detail akce",
}

export default async function TeamActivityDetailPage({ params }: TeamActivityDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (
    !canAccessFeature(
      {
        role: profile.role,
        beta_access_granted_at: profile.beta_access_granted_at,
        beta_cohort: ((profile as unknown as { beta_cohort: BetaCohort }).beta_cohort ?? "A") as BetaCohort,
      },
      "teamDiary",
    )
  ) {
    return <FeatureComingSoon featureName="Týmový deník" />
  }
  if (!profile.team_id) redirect("/")

  const [activities, teamMembers] = await Promise.all([
    listTeamActivities(supabase, profile.team_id),
    listTeamMembers(supabase, profile.team_id),
  ])
  const activity = activities.find((a) => a.id === id && a.removed_at === null)
  if (!activity) notFound()

  return (
    <div className="container mx-auto max-w-3xl py-4 sm:py-6 px-3 sm:px-6 space-y-4 sm:space-y-6">
      <PageBack href="/tymovy-denik" label="Zpět na deník" />
      <TeamActivityDetail activity={activity} teamMembers={teamMembers} />
    </div>
  )
}
