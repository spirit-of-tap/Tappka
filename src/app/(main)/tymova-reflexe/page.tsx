import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listTeamReflections } from "@/lib/tymova-reflexe/queries"
import { listTeamSemesterReflectionsWithProgress } from "@/lib/tymova-reflexe/semester-queries"
import { TeamReflectionList } from "@/components/tymova-reflexe/team-reflection-list"
import { InfoCard } from "@/components/tymova-reflexe/info-card"
import { HelpDialog } from "@/components/help-dialog"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"

export const metadata = {
  title: "Týmová reflexe | Tappka",
  description: "Měsíční ohlédnutí za týmovou spoluprací",
}

export default async function TymovaReflexePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")
  if (!profile.team_id) redirect("/")

  const [reflections, semesterReflections] = await Promise.all([
    listTeamReflections(supabase, profile.team_id),
    listTeamSemesterReflectionsWithProgress(supabase, profile.team_id),
  ])

  return (
    <PageShell className="max-w-5xl">
      <PageHeader
        title="Týmová reflexe"
        description="Měsíční ohlédnutí za týmovou spoluprací"
        count={{ value: reflections.length + semesterReflections.length, label: "reflexí" }}
        action={
          <HelpDialog question="Co je týmová reflexe?">
            <InfoCard />
          </HelpDialog>
        }
      />
      <TeamReflectionList
        reflections={reflections}
        semesterReflections={semesterReflections}
        onboardingYear={profile.team?.onboardingYear ?? null}
      />
    </PageShell>
  )
}
