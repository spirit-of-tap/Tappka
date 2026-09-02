import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { getSemesterReflectionForTeamMonth } from "@/lib/tymova-reflexe/semester-queries"
import { RocnikovaInfoCard } from "@/components/tymova-reflexe/rocnikova-info-card"
import { RocnikovaReflectionCreate } from "@/components/tymova-reflexe/rocnikova-reflection-create"
import { HelpDialog } from "@/components/help-dialog"
import { PageHeader } from "@/components/ui/page-header"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

function defaultMayMonth(): string {
  const now = new Date()
  const year = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear()
  return `${year}-05-01`
}

function rocnikovaLabel(monthStr: string): string {
  const [year] = monthStr.split("-")
  return `ročník ${year}`
}

export const metadata = {
  title: "Nová ročníková reflexe | Tappka",
}

export default async function NovaRocnikovaReflexePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; semester?: string }>
}) {
  const params = await searchParams
  const rawMonth = params.month ?? params.semester
  let semesterMonth = defaultMayMonth()

  if (rawMonth && /^\d{4}-05-01$/.test(rawMonth)) {
    semesterMonth = rawMonth
  } else if (rawMonth && /^\d{4}$/.test(rawMonth)) {
    semesterMonth = `${rawMonth}-05-01`
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
      "teamReflection",
    )
  ) {
    return <FeatureComingSoon featureName="Týmová reflexe" />
  }
  if (!profile.team_id) redirect("/")

  const existing = await getSemesterReflectionForTeamMonth(supabase, profile.team_id, semesterMonth)
  if (existing) redirect(`/tymova-reflexe/rocnikova/${existing.id}`)

  return (
    <div className="container mx-auto max-w-3xl py-4 sm:py-6 px-3 sm:px-6 space-y-6">
      <PageHeader
        title="Nová ročníková reflexe"
        description={`Vytvoří reflexi za ${rocnikovaLabel(semesterMonth)} se všemi 11 tématy pro celý tým`}
        back={{ href: "/tymova-reflexe", label: "Zpět na přehled" }}
        action={
          <HelpDialog question="Co je ročníková reflexe?">
            <RocnikovaInfoCard />
          </HelpDialog>
        }
      />
      <RocnikovaReflectionCreate
        teamId={profile.team_id}
        profileId={profile.id}
        semesterMonth={semesterMonth}
        label={rocnikovaLabel(semesterMonth)}
      />
    </div>
  )
}
