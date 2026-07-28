import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { getTeamReflectionForMonth } from "@/lib/tymova-reflexe/queries"
import { TeamReflectionCreate } from "@/components/tymova-reflexe/team-reflection-create"

const MONTH_PATTERN = /^\d{4}-\d{2}-01$/

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function monthLabel(monthStr: string): string {
  const m = Number(monthStr.slice(5, 7))
  return `${MONTH_LABELS[m - 1]} ${monthStr.slice(0, 4)}`
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

export const metadata = {
  title: "Nová reflexe | Tappka",
}

export default async function NovaReflexePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month: monthParam } = await searchParams
  const month = monthParam && MONTH_PATTERN.test(monthParam) ? monthParam : getCurrentMonth()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")
  if (!profile.team_id) redirect("/")

  const existing = await getTeamReflectionForMonth(supabase, profile.team_id, month)
  if (existing) redirect(`/tymova-reflexe/${existing.id}`)

  return (
    <div className="container mx-auto max-w-3xl py-4 sm:py-6 px-3 sm:px-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Nová týmová reflexe</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Založí prázdnou reflexi za {monthLabel(month)} — vyplňovat ji pak můžete přímo na stránce,
          změny se ukládají automaticky.
        </p>
      </div>
      <TeamReflectionCreate
        teamId={profile.team_id}
        profileId={profile.id}
        month={month}
        label={monthLabel(month)}
      />
    </div>
  )
}
