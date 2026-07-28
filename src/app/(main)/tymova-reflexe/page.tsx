import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listTeamReflections } from "@/lib/tymova-reflexe/queries"
import { listTeamSemesterReflectionsWithProgress } from "@/lib/tymova-reflexe/semester-queries"
import { TeamReflectionList } from "@/components/tymova-reflexe/team-reflection-list"
import { InfoCard } from "@/components/tymova-reflexe/info-card"

export const metadata = {
  title: "Týmová reflexe | Tappka",
  description: "Měsíční reflexe týmové spolupráce",
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
    <div className="container mx-auto max-w-5xl py-4 sm:py-6 px-3 sm:px-6 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Týmová reflexe</h1>
          <p className="text-sm text-muted-foreground">
            Měsíční ohlédnutí za týmovou spoluprací
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold tabular-nums leading-none">
            {reflections.length + semesterReflections.length}
          </p>
          <p className="text-sm text-muted-foreground">reflexí</p>
        </div>
      </div>
      <InfoCard />
      <TeamReflectionList
        reflections={reflections}
        semesterReflections={semesterReflections}
        onboardingYear={profile.team?.onboardingYear ?? null}
      />
    </div>
  )
}
