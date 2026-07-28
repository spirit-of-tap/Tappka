import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { getSemesterReflectionWithEntries } from "@/lib/tymova-reflexe/semester-queries"
import { SemesterReflectionDetail } from "@/components/tymova-reflexe/semester-reflection-detail"

export const metadata = {
  title: "Semestrální reflexe | Tappka",
}

export default async function SemestralniReflexeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")

  const result = await getSemesterReflectionWithEntries(supabase, id)
  if (!result) notFound()

  return (
    <SemesterReflectionDetail
      reflection={result.reflection}
      entries={result.entries}
      profileId={profile.id}
    />
  )
}
