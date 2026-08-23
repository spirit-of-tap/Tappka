import { redirect } from "next/navigation"

import { TeamDocuments } from "@/components/team-documents/team-documents"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { listTeamDocuments } from "@/lib/team-documents/queries"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"

export const metadata = {
  title: "Týmové dokumenty | Tappka",
  description: "Pravidla fungování týmu, Team Contract a finanční směrnice",
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
        description="Pravidla fungování týmu, Team Contract a finanční směrnice"
        count={{
          value: documents.length,
          label: pluralizeCz(documents.length, ["dokument", "dokumenty", "dokumentů"]),
        }}
      />

      <TeamDocuments teamId={profile.team_id} initialDocuments={documents} />
    </PageShell>
  )
}
