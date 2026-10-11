"use client"

import { toast } from "sonner"

import { TIME_DIRECTIONS, TIME_DIRECTION_LABELS } from "@/lib/time-tracking/constants"
import { formatDurationHms } from "@/lib/time-tracking/duration"
import { cn } from "@/lib/utils"
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

import { useTimer } from "./timer-provider"

export const TIMER_STOPPED_MESSAGE = "Časomíra zastavena"

interface StopTimerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StopTimerSheet({ open, onOpenChange }: StopTimerSheetProps) {
  const { active, elapsedMs, isPending, stop } = useTimer()
  const direction = active ? TIME_DIRECTIONS.find((option) => option.value === active.direction) : undefined

  async function handleStop() {
    const ok = await stop()
    if (ok) toast.success(TIMER_STOPPED_MESSAGE)
  }

  return (
    <AlertDialog open={open && active !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Zastavit časomíru?</AlertDialogTitle>
          <AlertDialogDescription>Záznam se uloží s aktuálním časem.</AlertDialogDescription>
        </AlertDialogHeader>
        {active && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <dt className="text-muted-foreground">Směr</dt>
            <dd className="flex items-center gap-2 font-medium">
              <span aria-hidden className={cn("size-2 rounded-full", direction?.dotClass)} />
              {TIME_DIRECTION_LABELS[active.direction]}
            </dd>
            <dt className="text-muted-foreground">Tag</dt>
            <dd className="truncate">{active.tag?.name ?? "Bez tagu"}</dd>
            {active.title && (
              <>
                <dt className="text-muted-foreground">Název</dt>
                <dd className="truncate">{active.title}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Uplynulo</dt>
            <dd className="font-medium tabular-nums">{formatDurationHms(elapsedMs)}</dd>
          </dl>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Pokračovat</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => void handleStop()}
            variant="destructive"
          >
            Zastavit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
