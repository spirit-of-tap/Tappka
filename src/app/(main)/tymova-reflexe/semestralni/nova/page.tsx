import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { getSemesterReflectionForTeamMonth } from "@/lib/tymova-reflexe/semester-queries"
import { SemesterInfoCard } from "@/components/tymova-reflexe/semester-info-card"
import { SemesterReflectionCreate } from "@/components/tymova-reflexe/semester-reflection-create"

const SEMESTER_MONTH_PATTERN = /^\d{4}-(01|05)-01$/

function semesterLabel(semesterMonth: string): string {
  const [year, month] = semesterMonth.split("-")
  return month === "01" ? `zimní semestr ${year}` : `letní semestr ${year}`
}

export const metadata = {
  title: "Nová semestrální reflexe | Tappka",
}

export default async function NovaSemestralniReflexePage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string }>
}) {
  const { semester } = await searchParams
  if (!semester || !SEMESTER_MONTH_PATTERN.test(semester)) {
    redirect("/tymova-reflexe")
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")
  if (!profile.team_id) redirect("/")

  const existing = await getSemesterReflectionForTeamMonth(supabase, profile.team_id, semester)
  if (existing) redirect(`/tymova-reflexe/semestralni/${existing.id}`)

  return (
    <div className="container mx-auto max-w-3xl py-4 sm:py-6 px-3 sm:px-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Nová semestrální reflexe</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Založí prázdnou reflexi za {semesterLabel(semester)} se všemi tématy — vyplňovat je pak
          může celý tým společně.
        </p>
      </div>
      <SemesterInfoCard />
      <SemesterReflectionCreate
        teamId={profile.team_id}
        profileId={profile.id}
        semesterMonth={semester}
        label={semesterLabel(semester)}
      />
    </div>
  )
}
