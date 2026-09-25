"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Ellipsis, Pencil, Square, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
} from "@/components/ui/responsive-alert-dialog"
import {
  PRAGUE_TIME_ZONE,
  TIME_DIRECTIONS,
  TIME_DIRECTION_LABELS,
  TIME_TRACKING_MESSAGES,
} from "@/lib/time-tracking/constants"
import { entryDurationMs, formatDurationHms, formatDurationShort } from "@/lib/time-tracking/duration"
import type { TimeDirection, TimeEntryWithTag } from "@/lib/time-tracking/types"
import { toPragueDateKey } from "@/lib/time-tracking/week"
import { cn } from "@/lib/utils"

export const ENTRY_DELETED_MESSAGE = "Záznam smazán"
export const ATTENDANCE_CHIP_LABEL = "z docházky"
export const NEXT_DAY_NOTE = "→ následující den"

export const ENTRIES_ENDPOINT = "/api/time-entries"

const clockFormatter = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: PRAGUE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

export const DIRECTION_DOT_CLASS = Object.fromEntries(TIME_DIRECTIONS.map((d) => [d.value, d.dotClass])) as Record<
  TimeDirection,
  string
>

/** `HH:mm` in Prague local time. */
export function formatClock(instant: string | Date): string {
  return clockFormatter.format(typeof instant === "string" ? new Date(instant) : instant)
}

function entryLabel(entry: TimeEntryWithTag): string {
  return entry.title ?? TIME_DIRECTION_LABELS[entry.direction]
}

/** `{ error }` body of a failed API call, or the generic message. */
export async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === "string" && body.error !== "") return body.error
  } catch {
    // Non-JSON error body.
  }
  return TIME_TRACKING_MESSAGES.generic
}

function RowShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/50",
        className,
      )}
    >
      {children}
    </div>
  )
}

function EntryMain({ entry, dot }: { entry: TimeEntryWithTag; dot: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
      {dot}
      <span className="min-w-0 truncate text-sm font-medium">{entryLabel(entry)}</span>
      {entry.tag && (
        <Badge variant="outline" className="bg-muted/60 font-normal">
          {entry.tag.name}
        </Badge>
      )}
      {entry.source === "attendance" && (
        <Badge variant="outline" className="border-transparent bg-muted font-normal text-muted-foreground">
          {ATTENDANCE_CHIP_LABEL}
        </Badge>
      )}
    </div>
  )
}

export interface TimeEntryRowProps {
  entry: TimeEntryWithTag
  /** Called when „Upravit" is chosen. */
  onEdit?: (entry: TimeEntryWithTag) => void
  /** Optimistic removal, called before the DELETE request. */
  onDeleted?: (id: string) => void
  /** Called when the DELETE request fails so the entry can be restored. */
  onDeleteFailed?: (entry: TimeEntryWithTag) => void
}

/** A finished entry: dot · title / direction · tag · od–do · délka · ⋮ menu. */
export function TimeEntryRow({ entry, onEdit, onDeleted, onDeleteFailed }: TimeEntryRowProps) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const end = entry.ended_at
  const endsNextDay = end !== null && toPragueDateKey(end) !== toPragueDateKey(entry.started_at)
  const label = entryLabel(entry)
  const duration = formatDurationShort(entryDurationMs(entry))

  async function handleDelete() {
    onDeleted?.(entry.id)
    try {
      const response = await fetch(`${ENTRIES_ENDPOINT}/${entry.id}`, { method: "DELETE" })
      if (!response.ok) {
        toast.error(await readApiError(response))
        onDeleteFailed?.(entry)
        return
      }
      toast.success(ENTRY_DELETED_MESSAGE)
      router.refresh()
    } catch {
      toast.error(TIME_TRACKING_MESSAGES.generic)
      onDeleteFailed?.(entry)
    }
  }

  return (
    <RowShell>
      <EntryMain
        entry={entry}
        dot={<span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", DIRECTION_DOT_CLASS[entry.direction])} />}
      />
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right sm:flex-row sm:items-center sm:gap-3">
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatClock(entry.started_at)}–{end ? formatClock(end) : ""}
          {endsNextDay && <span className="ml-1">{NEXT_DAY_NOTE}</span>}
        </span>
        <span className="min-w-16 text-sm font-medium tabular-nums">{duration}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label={`Další akce: ${label}`}
          >
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit?.(entry)}>
            <Pencil className="size-4" />
            Upravit
          </DropdownMenuItem>
          {/* preventDefault keeps the menu mounted until the AlertDialog takes focus. */}
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat záznam?</AlertDialogTitle>
            <AlertDialogDescription>
              Záznam „{label}“ ({duration}) zmizí z tvého přehledu. Tuhle akci nejde vrátit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RowShell>
  )
}

export interface RunningEntryRowProps {
  entry: TimeEntryWithTag
  /** Live elapsed time from `useTimer().elapsedMs`. */
  elapsedMs: number
  onStop: () => void
  isPending?: boolean
}

/** The running timer, pinned first: pulsing dot · live `HH:MM:SS` · Stop. No edit/delete menu. */
export function RunningEntryRow({ entry, elapsedMs, onStop, isPending = false }: RunningEntryRowProps) {
  const dotClass = DIRECTION_DOT_CLASS[entry.direction]

  return (
    <RowShell className="border border-success/30 bg-success/5 hover:bg-success/10">
      <EntryMain
        entry={entry}
        dot={
          <span aria-hidden className="relative flex size-2.5 shrink-0" data-testid="running-dot">
            <span
              className={cn(
                "absolute inline-flex size-full animate-ping rounded-full opacity-75 motion-reduce:animate-none",
                dotClass,
              )}
            />
            <span className={cn("relative inline-flex size-2.5 rounded-full", dotClass)} />
          </span>
        }
      />
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right sm:flex-row sm:items-center sm:gap-3">
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatClock(entry.started_at)}–<span className="text-success-strong">běží</span>
        </span>
        <span className="min-w-16 text-sm font-semibold tabular-nums text-success-strong">
          {formatDurationHms(elapsedMs)}
        </span>
      </div>
      <Button variant="outline" size="sm" className="shrink-0" onClick={onStop} disabled={isPending}>
        <Square className="size-3.5 fill-current" aria-hidden />
        Stop
      </Button>
    </RowShell>
  )
}
