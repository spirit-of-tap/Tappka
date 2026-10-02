"use client"

import { Clock, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatDayHeading, formatTimeRange } from "@/lib/training-sessions/format"
import type { UpcomingSlot } from "@/lib/training-sessions/slots"

interface SlotChipsProps {
  slots: UpcomingSlot[]
  rooms: { id: string; code: string; name: string }[]
  onPick: (slot: UpcomingSlot) => void
}

export function SlotChips({ slots, rooms, onPick }: SlotChipsProps) {
  if (slots.length === 0) return null
  const roomCode = new Map(rooms.map((r) => [r.id, r.code]))

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden />
        <p className="text-sm font-semibold text-foreground">Volné termíny podle rozvrhu týmu</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Kliknutím na termín automaticky předvyplníš datum, čas i rezervovanou místnost.
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {slots.map((slot) => (
          <Button
            key={slot.startsAt}
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full bg-background/80 hover:bg-background hover:border-primary/50 text-xs sm:text-sm font-medium shadow-2xs gap-1.5"
            onClick={() => onPick(slot)}
          >
            <Clock className="size-3.5 text-muted-foreground" aria-hidden />
            <span>{`${formatDayHeading(slot.startsAt)} · ${formatTimeRange(slot.startsAt, slot.endsAt)} · ${roomCode.get(slot.roomId) ?? ""}`}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

