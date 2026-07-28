import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { getCustomerMeeting } from "@/lib/customer-meetings/queries"
import { CustomerMeetingDetail } from "@/components/customer-meetings/customer-meeting-detail"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface MeetingDetailPageProps {
  params: Promise<{ meetingId: string }>
}

export const metadata = {
  title: "Detail schůzky | Tappka",
}

type MeetingStatusVariant = "outline" | "default" | "secondary"

function getMeetingStatus(meetingAt: string | null): { label: string; variant: MeetingStatusVariant } {
  if (!meetingAt) return { label: "Bez data", variant: "outline" }
  return new Date(meetingAt).getTime() > Date.now()
    ? { label: "Naplánováno", variant: "default" }
    : { label: "Proběhlo", variant: "secondary" }
}

export default async function MeetingDetailPage({ params }: MeetingDetailPageProps) {
  const { meetingId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")

  const meeting = await getCustomerMeeting(supabase, meetingId)
  if (!meeting || meeting.profile_id !== profile.id) {
    notFound()
  }

  const status = getMeetingStatus(meeting.meeting_at)

  return (
    <div className="container mx-auto max-w-3xl py-4 sm:py-6 px-3 sm:px-6 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/schuzky">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{meeting.company}</h1>
          <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
            <span>
              Schůzka s {meeting.contact_person}
              {meeting.meeting_at && ` — ${new Date(meeting.meeting_at).toLocaleDateString("cs-CZ")}`}
            </span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </p>
        </div>
      </div>
      <CustomerMeetingDetail meeting={meeting} profileId={profile.id} />
    </div>
  )
}
