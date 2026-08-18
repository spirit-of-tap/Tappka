import { redirect } from "next/navigation"
import { Files } from "lucide-react"

import { TeamDocuments } from "@/components/team-documents/team-documents"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { listTeamDocuments } from "@/lib/team-documents/queries"

export const metadata = {
  title: "Týmové dokumenty | Tappka",
  description: "Týmová smlouva, finanční směrnice a další verzované dokumenty",
}

export default async function TeamDocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at || !profile.team_id) redirect("/")

  const documents = await listTeamDocuments(supabase, profile.team_id)

  return (
    <PageShell className="max-w-5xl">
      <PageHeader
        title="Týmové dokumenty"
        description="Jedno místo pro důležité týmové dokumenty a jejich historii."
        count={{ value: documents.length, label: "dokumentů" }}
      />

      <Card className="flex-row items-start gap-3 p-4 sm:p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Files className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Každé nahrání vytváří novou verzi</p>
          <p className="text-sm text-muted-foreground">
            Nahrajte hotové PDF. Předchozí verze zůstávají dostupné, takže tým vždy dohledá,
            co platilo dříve.
          </p>
        </div>
      </Card>

      <TeamDocuments teamId={profile.team_id} initialDocuments={documents} />
    </PageShell>
  )
}
