import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { getIndividualCoachingSession, listCoachProfiles } from "@/lib/individual-coaching-sessions/queries"
import { IndividualCoachingSessionDetail } from "@/components/individual-coaching-sessions/individual-coaching-session-detail"
import { coachDisplayName } from "@/lib/individual-coaching-sessions/types"
import { Button } from "@/components/ui/button"

interface SessionDetailPageProps {
  params: Promise<{ sessionId: string }>
}

export const metadata = {
  title: "Detail koučovacího sezení | Tappka",
}

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")

  const [session, coachProfiles] = await Promise.all([
    getIndividualCoachingSession(supabase, sessionId),
    listCoachProfiles(supabase),
  ])
  if (!session || session.profile_id !== profile.id) {
    notFound()
  }

  return (
    <div className="container mx-auto max-w-3xl py-4 sm:py-6 px-3 sm:px-6 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/koucovani">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{coachDisplayName(session)}</h1>
          <p className="text-sm text-muted-foreground">
            Koučovací sezení
            {session.session_at && ` — ${new Date(session.session_at).toLocaleDateString("cs-CZ")}`}
          </p>
        </div>
      </div>
      <IndividualCoachingSessionDetail session={session} profileId={profile.id} coachProfiles={coachProfiles} />
    </div>
  )
}
