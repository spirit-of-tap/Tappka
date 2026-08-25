import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listBirthGivingEvents, listBirthGivingOrganizerProfiles } from "@/lib/birth-giving/queries"
import { BirthGivingIndex } from "@/components/birth-giving/birth-giving-index"
import { PageShell } from "@/components/ui/page-shell"

export const metadata = {
  title: "Birth Giving | Tappka",
  description: "Přehled hackathonů, týmových řešení a odevzdaných výstupů",
}

export default async function BirthGivingIndexPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")

  const [events, organizerProfiles] = await Promise.all([
    listBirthGivingEvents(supabase),
    listBirthGivingOrganizerProfiles(supabase),
  ])

  return (
    <PageShell>
      <BirthGivingIndex
        events={events}
        profileId={profile.id}
        now={new Date().toISOString()}
        organizerProfiles={organizerProfiles}
      />
    </PageShell>
  )
}