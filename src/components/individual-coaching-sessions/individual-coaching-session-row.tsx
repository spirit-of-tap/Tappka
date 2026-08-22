"use client"

import { useState } from "react"
import { Ellipsis, ListChecks, Lightbulb, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { ProfileAvatar } from "@/components/profile-avatar"
import {
  getCoachingSessionLoop,
  LOOP_LABELS,
  type CoachingSessionLoop,
} from "@/lib/individual-coaching-sessions/status"
import { coachDisplayName } from "@/lib/individual-coaching-sessions/types"
import type { IndividualCoachingSessionWithCoach } from "@/lib/individual-coaching-sessions/types"
import type { Profile } from "@/lib/auth-helpers"
import { IndividualCoachingSessionForm } from "./individual-coaching-session-form"

const CHIP_CLASS: Record<CoachingSessionLoop, string> = {
  "missing-notes": "border-transparent bg-warning/10 text-warning-strong",
  undated: "",
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getDate()}.${pad(d.getMonth() + 1)}.`
}

/** First meaningful line for the collapsed preview — takeaways, fallback actions. */
function previewText(session: IndividualCoachingSessionWithCoach): string | null {
  const source = session.key_takeaways?.trim()
    ? session.key_takeaways
    : session.action_steps?.trim()
      ? session.action_steps
      : null
  if (!source) return null
  return source.split("\n").map((l) => l.trim()).find(Boolean) ?? null
}

interface IndividualCoachingSessionRowProps {
  session: IndividualCoachingSessionWithCoach
  profileId?: string
  coachProfiles?: Pick<Profile, "id" | "name" | "picture">[]
  onUpdated?: (session: IndividualCoachingSessionWithCoach) => void
  onDeleted?: (id: string) => void
}

/**
 * One koučování timeline entry — expandable in place (there is no detail
 * page; the notes ARE the content and progressive disclosure replaces the
 * old always-open text walls). Collapsed: avatar · coach name · date pill ·
 * preview line · open-loop chip · ⋮ overflow menu (Upravit dialog, Smazat
 * with confirm).
 */
export function IndividualCoachingSessionRow({
  session,
  profileId,
  coachProfiles,
  onUpdated,
  onDeleted,
}: IndividualCoachingSessionRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loop = getCoachingSessionLoop(session)
  const name = coachDisplayName(session)
  const preview = expanded ? null : previewText(session)

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
      onDeleted?.(session.id)
    } catch {
      toast.error("Nepodařilo se odstranit sezení")
    } finally {
      setDeleting(false)
    }
  }

  function handleUpdated(updated: IndividualCoachingSessionWithCoach) {
    setEditOpen(false)
    onUpdated?.(updated)
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-lg py-2 pr-1 transition-colors hover:bg-accent/50">
        {/* Toggle button covers avatar/name/date/preview/chip; the ⋮ menu is
            a sibling — a button inside a button is invalid HTML (hydration
            error) and breaks assistive tech. */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="focus-ring flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg text-left"
        >
          <ProfileAvatar
            picture={session.coach?.picture}
            name={name}
            size={28}
            className="relative z-10 shrink-0 text-[11px]"
          />
          <span className="min-w-0 shrink-0 truncate text-sm font-medium">{name}</span>
          {session.session_at && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
              {formatShortDate(session.session_at)}
            </span>
          )}
          {preview && (
            <span className="line-clamp-1 min-w-0 basis-full text-xs text-muted-foreground/90 sm:basis-auto sm:flex-1 sm:truncate">
              {preview}
            </span>
          )}
          {!preview && loop && <span className="flex-1" />}
        </button>
        {loop && (
          <Badge variant="outline" className={`shrink-0 ${CHIP_CLASS[loop]}`}>
            {LOOP_LABELS[loop]}
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              aria-label="Další akce"
            >
              <Ellipsis className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* preventDefault on Smazat keeps the menu open until the
                AlertDialog takes over focus — otherwise Radix closes both. */}
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Upravit
            </DropdownMenuItem>
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

      {expanded && (
        <div className="space-y-4 pb-4 pl-10 pr-1">
          {session.key_takeaways ? (
            <NoteBlock icon={Lightbulb} label="Co jsem si odnesl">
              {session.key_takeaways}
            </NoteBlock>
          ) : (
            <p className="text-sm text-muted-foreground">
              Zatím žádné poznámky — uprav sezení a doplň, co si odnášíš.
            </p>
          )}
          {session.action_steps && (
            <NoteBlock icon={ListChecks} label="Akční kroky po koučování">
              {session.action_steps}
            </NoteBlock>
          )}
        </div>
      )}

      {profileId && coachProfiles && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
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
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odstranit sezení?</AlertDialogTitle>
            <AlertDialogDescription>
              Tímto odstraníš sezení s {name || "externí:m koučem:em"}.
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

function NoteBlock({
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
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="whitespace-pre-wrap text-sm">{children}</p>
      </div>
    </div>
  )
}
