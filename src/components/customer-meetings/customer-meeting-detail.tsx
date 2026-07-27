"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, Building2, UserCircle, Briefcase, Calendar, Target, MessageSquare, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { CustomerMeetingForm } from "./customer-meeting-form"
import type { CustomerMeeting } from "@/lib/customer-meetings/types"

interface CustomerMeetingDetailProps {
  meeting: CustomerMeeting
  profileId: string
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

export function CustomerMeetingDetail({ meeting, profileId }: CustomerMeetingDetailProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("customer_meetings")
        .update({ removed_at: new Date().toISOString() })
        .eq("id", meeting.id)

      if (error) throw error
      toast.success("Schůzka odstraněna")
      router.push("/schuzky")
    } catch {
      toast.error("Nepodařilo se odstranit schůzku")
    } finally {
      setDeleting(false)
    }
  }

  function handleUpdated(_: CustomerMeeting) {
    setEditOpen(false)
    router.refresh()
    toast.success("Schůzka aktualizována")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Pencil className="size-4" />
              Upravit
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upravit schůzku</DialogTitle>
            </DialogHeader>
            <CustomerMeetingForm
              profileId={profileId}
              initial={meeting}
              onSuccess={handleUpdated}
              onCancel={() => setEditOpen(false)}
            />
          </DialogContent>
        </Dialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive">
              <Trash2 className="size-4" />
              Smazat
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Odstranit schůzku?</AlertDialogTitle>
              <AlertDialogDescription>
                Tato akce schůzku s {meeting.company} odstraní.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleting}
              >
                {deleting ? "Odstraňuji..." : "Odstranit"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detaily schůzky</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <DetailRow icon={Building2} label="Společnost">
              {meeting.company}
            </DetailRow>
            <DetailRow icon={UserCircle} label="Kontaktní osoba">
              {meeting.contact_person}
            </DetailRow>
            <DetailRow icon={Briefcase} label="Pozice">
              {meeting.position || "—"}
            </DetailRow>
            <DetailRow icon={Calendar} label="Datum">
              {meeting.meeting_at
                ? new Date(meeting.meeting_at).toLocaleDateString("cs-CZ", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Neuvedeno"}
            </DetailRow>
          </div>

          <div className="border-t pt-6 space-y-6">
            <DetailRow icon={Target} label="Cíl schůzky">
              <p className="whitespace-pre-wrap">{meeting.objective}</p>
            </DetailRow>

            {meeting.post_mortem && (
              <DetailRow icon={MessageSquare} label="Post-mortem (follow up)">
                <p className="whitespace-pre-wrap">{meeting.post_mortem}</p>
              </DetailRow>
            )}

            {meeting.team_share && (
              <DetailRow icon={Users} label="Co chci sdílet do týmu">
                <p className="whitespace-pre-wrap">{meeting.team_share}</p>
              </DetailRow>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
