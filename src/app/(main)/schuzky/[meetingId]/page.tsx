import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { getCustomerMeeting } from "@/lib/customer-meetings/queries"
import { CustomerMeetingDetail } from "@/components/customer-meetings/customer-meeting-detail"
import { Badge } from "@/components/ui/badge"
import { PageBack } from "@/components/ui/page-back"
import { getMeetingLoop, LOOP_LABELS, type MeetingLoop } from "@/lib/customer-meetings/status"

interface MeetingDetailPageProps {
  params: Promise<{ meetingId: string }>
}

export const metadata = {
  title: "Detail schůzky | Tappka",
}

const CHIP_CLASS: Record<MeetingLoop, string> = {
  "missing-follow-up": "border-transparent bg-warning/10 text-warning-strong",
  undated: "",
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

  // Same open-loop logic as the timeline rows: only unfinished states get a
  // badge — done + reflected stays calm, "Proběhlo" would just repeat the date.
  const loop = getMeetingLoop(meeting)

  return (
    <div className="container mx-auto max-w-3xl py-4 sm:py-6 px-3 sm:px-6 space-y-4 sm:space-y-6">
      <PageBack href="/schuzky" label="Zpět na přehled" />
      <div className="space-y-1 min-w-0">
        <h1 className="font-heading text-2xl font-bold tracking-tight truncate sm:text-3xl">
          {meeting.contact_person}
        </h1>
        <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
          <span>
            {meeting.company}
            {meeting.meeting_at &&
              ` · ${new Date(meeting.meeting_at).toLocaleDateString("cs-CZ", {
                day: "numeric",
                month: "numeric",
                year: "numeric",
              })}`}
          </span>
          {loop && (
            <Badge variant="outline" className={`shrink-0 ${CHIP_CLASS[loop]}`}>
              {LOOP_LABELS[loop]}
            </Badge>
          )}
        </p>
      </div>
      <CustomerMeetingDetail meeting={meeting} profileId={profile.id} />
    </div>
  )
}
