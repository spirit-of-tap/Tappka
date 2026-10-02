"use client"

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
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Volné termíny podle rozvrhu týmu</p>
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <Button key={slot.startsAt} type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onPick(slot)}>
            {`${formatDayHeading(slot.startsAt)} · ${formatTimeRange(slot.startsAt, slot.endsAt)} · ${roomCode.get(slot.roomId) ?? ""}`}
          </Button>
        ))}
      </div>
    </div>
  )
}
