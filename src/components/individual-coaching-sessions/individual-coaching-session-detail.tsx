"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, UserCircle, Calendar, Lightbulb, ListChecks } from "lucide-react"
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
import { IndividualCoachingSessionForm } from "./individual-coaching-session-form"
import { coachDisplayName } from "@/lib/individual-coaching-sessions/types"
import type { IndividualCoachingSessionWithCoach } from "@/lib/individual-coaching-sessions/types"
import type { Profile } from "@/lib/auth-helpers"

interface IndividualCoachingSessionDetailProps {
  session: IndividualCoachingSessionWithCoach
  profileId: string
  coachProfiles: Pick<Profile, "id" | "name" | "picture">[]
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

export function IndividualCoachingSessionDetail({ session, profileId, coachProfiles }: IndividualCoachingSessionDetailProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("individual_coaching_sessions")
        .update({ removed_at: new Date().toISOString() })
        .eq("id", session.id)

      if (error) throw error
      toast.success("Sezení odstraněno")
      router.push("/koucovani")
    } catch {
      toast.error("Nepodařilo se odstranit sezení")
    } finally {
      setDeleting(false)
    }
  }

  function handleUpdated(_: IndividualCoachingSessionWithCoach) {
    setEditOpen(false)
    router.refresh()
    toast.success("Sezení aktualizováno")
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
              <DialogTitle>Upravit sezení</DialogTitle>
            </DialogHeader>
            <IndividualCoachingSessionForm
              profileId={profileId}
              coachProfiles={coachProfiles}
              initial={session}
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
              <AlertDialogTitle>Odstranit sezení?</AlertDialogTitle>
              <AlertDialogDescription>
                Tato akce sezení s {coachDisplayName(session)} odstraní.
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
          <CardTitle>Detaily sezení</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <DetailRow icon={UserCircle} label="Kouč">
              {coachDisplayName(session)}
            </DetailRow>
            <DetailRow icon={Calendar} label="Datum">
              {session.session_at
                ? new Date(session.session_at).toLocaleDateString("cs-CZ", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Neuvedeno"}
            </DetailRow>
          </div>

          {(session.key_takeaways || session.action_steps) && (
            <div className="border-t pt-6 space-y-6">
              {session.key_takeaways && (
                <DetailRow icon={Lightbulb} label="Co jsem si odnesl / uvědomění">
                  <p className="whitespace-pre-wrap">{session.key_takeaways}</p>
                </DetailRow>
              )}

              {session.action_steps && (
                <DetailRow icon={ListChecks} label="Akční kroky po koučování">
                  <p className="whitespace-pre-wrap">{session.action_steps}</p>
                </DetailRow>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
