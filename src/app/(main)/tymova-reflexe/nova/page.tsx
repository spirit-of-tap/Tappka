import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { TeamReflectionForm } from "@/components/tymova-reflexe/team-reflection-form"

export const metadata = {
  title: "Nová reflexe | Tappka",
}

export default async function NovaReflexePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")
  if (!profile.team_id) redirect("/")

  return (
    <div className="container mx-auto max-w-3xl py-4 sm:py-6 px-3 sm:px-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Nová týmová reflexe</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vyplňte reflexi za uplynulý měsíc
        </p>
      </div>
      <TeamReflectionForm
        teamId={profile.team_id}
        profileId={profile.id}
      />
    </div>
  )
}
