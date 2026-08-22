"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Ellipsis, ListChecks, Pencil, Target, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { getPublicStorageUrl } from "@/lib/storage/public-url"
import { TeamActivityForm } from "./team-activity-form"
import { TeamActivityThumb } from "./team-activity-thumb"
import { getTeamActivityLoop } from "@/lib/tymovy-denik/status"
import { formatActivityDate } from "@/lib/tymovy-denik/format"
import type { TeamActivityWithCreator } from "@/lib/tymovy-denik/types"

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm">{children}</p>
    </div>
  )
}

interface TeamActivityDetailProps {
  activity: TeamActivityWithCreator
  teamId: string
  profileId: string
}

export function TeamActivityDetail({ activity, teamId, profileId }: TeamActivityDetailProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loop = getTeamActivityLoop(activity)

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
      router.push("/tymovy-denik")
    } catch {
      toast.error("Nepodařilo se odstranit akci")
    } finally {
      setDeleting(false)
    }
  }

  function handleUpdated(updated: TeamActivityWithCreator) {
    setEditOpen(false)
    // Detail reads server data — refresh to pick up edited fields/photo.
    void updated
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Hero photo with a quiet placeholder when the event has no photo. */}
      <div className="overflow-hidden rounded-xl border border-border/50 bg-muted/30">
        {activity.image_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getPublicStorageUrl("images", activity.image_path)}
            alt={`Fotografie z akce ${activity.activity_type}`}
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="grid aspect-video w-full place-items-center">
            <TeamActivityThumb activityType={activity.activity_type} size={96} />
          </div>
        )}
      </div>

      <div className="space-y-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 truncate font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {activity.activity_type}
          </h1>
          {loop && (
            <Badge variant="outline" className="border-transparent bg-warning/10 text-warning-strong">
              Chybí reflexe
            </Badge>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
          <Target aria-hidden className="size-4" />
          {formatActivityDate(activity.occurred_at)}
          {activity.participants && (
            <>
              <span aria-hidden>·</span>
              <Users aria-hidden className="size-4" />
              {activity.participants}
            </>
          )}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2">
        {/* Edit is primary and visible; delete hides behind the overflow menu
            (established detail-page pattern). */}
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" />
          Upravit
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-label="Další akce"
            >
              <Ellipsis className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* preventDefault keeps the menu open until the AlertDialog takes
                over focus — otherwise Radix closes both. */}
            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => {
                event.preventDefault()
                setDeleteOpen(true)
              }}
            >
              <Trash2 className="size-4" />
              Smazat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-lg border border-border/50 p-3 space-y-4 sm:p-4">
        {activity.participants && <Block label="Účast">{activity.participants}</Block>}
        {activity.reason && <Block label="Proč jsme tam byli">{activity.reason}</Block>}
        {activity.reflection ? (
          <Block label="Co jsme si odnesli?">
            <span className="inline-flex items-start gap-2">
              <ListChecks aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>{activity.reflection}</span>
            </span>
          </Block>
        ) : (
          <p className="text-sm text-muted-foreground">
            Zatím bez reflexe — upravte akci a doplňte, co jste si odnesli.
          </p>
        )}
        {activity.created_by && (
          <p className="border-t border-border/50 pt-3 text-xs text-muted-foreground">
            Vytvořil:la: {activity.created_by.name}
          </p>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upravit akci</DialogTitle>
          </DialogHeader>
          <TeamActivityForm
            teamId={teamId}
            profileId={profileId}
            initial={activity}
            onSuccess={handleUpdated}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odstranit akci?</AlertDialogTitle>
            <AlertDialogDescription>
              Tímto odeberete {activity.activity_type} ({formatActivityDate(activity.occurred_at)})
              z deníku.
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
  )
}
