import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listBirthGivingOrganizerProfiles } from "@/lib/birth-giving/queries"
import { BirthGivingUpcomingCreate } from "@/components/birth-giving/upcoming-create"
import { PageShell } from "@/components/ui/page-shell"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"

export const metadata = {
  title: "Nová Birth Giving událost | Tappka",
  description: "Vytvoření nové Birth Giving události",
}

export default async function BirthGivingNovaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")

  const organizerProfiles = await listBirthGivingOrganizerProfiles(supabase)

  return (
    <PageShell>
      <PageHeader
        title="Nová Birth Giving událost"
        description="Nastavte nadcházející událost. Podobné události v okolí data nabídneme ke kontrole."
      />
      <Card className="p-3 sm:p-5">
        <BirthGivingUpcomingCreate
          profileId={profile.id}
          organizerProfiles={organizerProfiles}
        />
      </Card>
    </PageShell>
  )
}