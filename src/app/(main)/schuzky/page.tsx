import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listCustomerMeetings } from "@/lib/customer-meetings/queries"
import { CustomerMeetingsView } from "@/components/customer-meetings/customer-meetings-view"
import { PageShell } from "@/components/ui/page-shell"

export const metadata = {
  title: "Zákaznické schůzky | Tappka",
  description: "Záznamník schůzek s lidmi z praxe",
}

export default async function SchuzkyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")

  const meetings = await listCustomerMeetings(supabase, profile.id)

  // Computed once on the server and passed down so client-side month grouping
  // hydrates against the exact same reference time (no TZ/boundary drift).
  const now = new Date()

  return (
    <PageShell className="max-w-5xl">
      <CustomerMeetingsView meetings={meetings} profileId={profile.id} now={now} />
    </PageShell>
  )
}
