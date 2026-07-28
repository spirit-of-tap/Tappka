"use client"

import { useState } from "react"
import { Pencil, Trash2, UserCircle, Lightbulb, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

interface IndividualCoachingSessionCardProps {
  session: IndividualCoachingSessionWithCoach
  profileId: string
  coachProfiles: Pick<Profile, "id" | "name" | "picture">[]
  onUpdated: (session: IndividualCoachingSessionWithCoach) => void
  onDeleted: (id: string) => void
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

export function IndividualCoachingSessionCard({
  session,
  profileId,
  coachProfiles,
  onUpdated,
  onDeleted,
}: IndividualCoachingSessionCardProps) {
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
      onDeleted(session.id)
    } catch {
      toast.error("Nepodařilo se odstranit sezení")
    } finally {
      setDeleting(false)
    }
  }

  function handleUpdated(updated: IndividualCoachingSessionWithCoach) {
    setEditOpen(false)
    onUpdated(updated)
  }

  return (
    <Card className="p-3 sm:p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="size-6 shrink-0">
            <AvatarImage src={session.coach?.picture ?? undefined} alt={coachDisplayName(session)} />
            <AvatarFallback>
              <UserCircle className="size-4 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-sm truncate">{coachDisplayName(session)}</span>
          {session.session_at && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {new Date(session.session_at).toLocaleDateString("cs-CZ", {
                day: "numeric",
                month: "numeric",
              })}
              {" v "}
              {new Date(session.session_at).toLocaleTimeString("cs-CZ", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Upravit sezení">
                <Pencil className="size-4" />
                <span className="sr-only sm:not-sr-only sm:inline">Upravit</span>
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
              <Button variant="outline" size="sm" className="text-destructive" aria-label="Smazat sezení">
                <Trash2 className="size-4" />
                <span className="sr-only sm:not-sr-only sm:inline">Smazat</span>
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
      </div>

      {session.key_takeaways || session.action_steps ? (
        <div className="border-t pt-4 space-y-4">
          {session.key_takeaways && (
            <Field icon={Lightbulb} label="Co jsem si odnesl / uvědomění">
              <p className="whitespace-pre-wrap">{session.key_takeaways}</p>
            </Field>
          )}
          {session.action_steps && (
            <Field icon={ListChecks} label="Akční kroky po koučování">
              <p className="whitespace-pre-wrap">{session.action_steps}</p>
            </Field>
          )}
        </div>
      ) : (
        <div className="border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Zatím žádné poznámky — uprav sezení a doplň, co sis odnesl.
          </p>
        </div>
      )}
    </Card>
  )
}
