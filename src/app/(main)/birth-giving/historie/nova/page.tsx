import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listBirthGivingOrganizerProfiles } from "@/lib/birth-giving/queries"
import { BirthGivingRetrospectiveWizard } from "@/components/birth-giving/retrospektiva/birth-giving-retrospective-wizard"
import { PageShell } from "@/components/ui/page-shell"
import { PageHeader } from "@/components/ui/page-header"

export const metadata = {
  title: "Historická Birth Giving událost | Tappka",
  description: "Zápis proběhlé Birth Giving události až do zveřejnění",
}

export default async function BirthGivingHistorieNovaPage() {
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
        title="Nová historická událost"
        description="Zapíšete proběhlou Birth Giving událost po krocích. Změny se ukládají průběžně a koncept může zůstat rozepsaný."
      />
      <BirthGivingRetrospectiveWizard
        profileId={profile.id}
        organizerProfiles={organizerProfiles}
      />
    </PageShell>
  )
}