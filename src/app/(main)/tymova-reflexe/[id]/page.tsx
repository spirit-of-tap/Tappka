import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { TeamReflectionDetail } from "@/components/tymova-reflexe/team-reflection-detail"
import { getTeamReflectionById } from "@/lib/tymova-reflexe/queries"
import { listTeamMembers } from "@/lib/tymovy-denik/queries"

export const metadata = {
  title: "Týmová reflexe | Tappka",
}

export default async function ReflexeDetailPage({
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
  if (!profile.team_id) redirect("/")

  const [reflection, teamMembers] = await Promise.all([
    getTeamReflectionById(supabase, id),
    listTeamMembers(supabase, profile.team_id),
  ])

  if (!reflection) notFound()

  return (
    <TeamReflectionDetail
      reflection={reflection}
      profileId={profile.id}
      teamMembers={teamMembers}
    />
  )
}
