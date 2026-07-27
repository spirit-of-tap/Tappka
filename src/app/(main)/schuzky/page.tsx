import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listCustomerMeetings } from "@/lib/customer-meetings/queries"
import { CustomerMeetingList } from "@/components/customer-meetings/customer-meeting-list"
import { InfoCard } from "@/components/customer-meetings/info-card"

export const metadata = {
  title: "Zákaznické schůzky | Tappka",
  description: "Záznamník zákaznických schůzek",
}

export default async function SchuzkyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")

  const meetings = await listCustomerMeetings(supabase, profile.id)

  return (
    <div className="container mx-auto max-w-5xl py-4 sm:py-6 px-3 sm:px-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Zákaznické schůzky</h1>
          <p className="text-sm text-muted-foreground">
            Záznamník schůzek s lidmi z praxe
          </p>
        </div>
      </div>
      <InfoCard />
      <CustomerMeetingList meetings={meetings} profileId={profile.id} />
    </div>
  )
}
