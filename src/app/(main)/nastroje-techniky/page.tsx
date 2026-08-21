import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listToolsTechniques } from "@/lib/nastroje-techniky/queries"
import { ToolsTechniquesTable } from "@/components/nastroje-techniky/tools-techniques-table"
import { InfoCard } from "@/components/nastroje-techniky/info-card"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"

export const metadata = {
  title: "Nástroje a techniky | Tappka",
  description: "Katalog modelů, technik a nástrojů, které umíš používat pro efektivní práci",
}

export default async function NastrojeTechnikyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")

  const items = await listToolsTechniques(supabase, profile.id)

  return (
    <PageShell className="max-w-5xl">
      <PageHeader
        title="Nástroje a techniky"
        description="Katalog modelů, technik a nástrojů, které umíš používat pro efektivní práci"
        count={{ value: items.length, label: pluralizeCz(items.length, ["záznam", "záznamy", "záznamů"]) }}
      />
      <InfoCard />
      <ToolsTechniquesTable items={items} profileId={profile.id} />
    </PageShell>
  )
}
