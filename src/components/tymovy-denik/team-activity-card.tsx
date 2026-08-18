"use client"

import { useState } from "react"
import { Pencil, Trash2, CalendarDays, Users } from "lucide-react"
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
import { TeamActivityForm } from "./team-activity-form"
import { formatActivityDate } from "@/lib/tymovy-denik/format"
import type { TeamActivityWithCreator } from "@/lib/tymovy-denik/types"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{children}</p>
    </div>
  )
}

interface TeamActivityCardProps {
  activity: TeamActivityWithCreator
  teamId: string
  profileId: string
  onUpdated: (activity: TeamActivityWithCreator) => void
  onDeleted: (id: string) => void
}

export function TeamActivityCard({
  activity,
  teamId,
  profileId,
  onUpdated,
  onDeleted,
}: TeamActivityCardProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("team_activities")
        .update({ removed_at: new Date().toISOString() })
        .eq("id", activity.id)

      if (error) throw error
      toast.success("Akce odstraněna")
      onDeleted(activity.id)
    } catch {
      toast.error("Nepodařilo se odstranit akci")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="p-3 sm:p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-semibold text-sm">{formatActivityDate(activity.occurred_at)}</span>
          <span className="text-sm text-muted-foreground">· {activity.activity_type}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Upravit akci">
                <Pencil className="size-4" />
                <span className="sr-only sm:not-sr-only sm:inline">Upravit</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upravit akci</DialogTitle>
              </DialogHeader>
              <TeamActivityForm
                teamId={teamId}
                profileId={profileId}
                initial={activity}
                onSuccess={(updated) => {
                  setEditOpen(false)
                  onUpdated(updated)
                }}
                onCancel={() => setEditOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive" aria-label="Smazat akci">
                <Trash2 className="size-4" />
                <span className="sr-only sm:not-sr-only sm:inline">Smazat</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Odstranit akci?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tuto akci ({formatActivityDate(activity.occurred_at)} — {activity.activity_type}) odeberete z deníku.
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

      <div className="border-t pt-4 space-y-4">
        {activity.participants && (
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <Field label="Účast">{activity.participants}</Field>
          </div>
        )}
        {activity.reason && <Field label="Proč jsme tam byli">{activity.reason}</Field>}
        {activity.reflection && <Field label="Co jsme si odnesli?">{activity.reflection}</Field>}
      </div>

      {activity.created_by && (
        <div className="border-t pt-3 text-xs text-muted-foreground">
          Vytvořil:la: {activity.created_by.name}
        </div>
      )}
    </Card>
  )
}
