"use client"

import { useState } from "react"
import { toast } from "sonner"

import type { TeamActivityAttendeeInput } from "@/app/api/tymovy-denik/activities/_shared"
import { AttendanceSelector } from "@/components/tymovy-denik/attendance-selector"
import { Button } from "@/components/ui/button"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"

interface AttendancePanelProps {
  sessionId: string
  people: TeamMemberProfile[]
  initial: TeamActivityAttendeeInput[]
}

const SAVE_ERROR_MESSAGE = "Docházku se nepodařilo uložit"

export function AttendancePanel({ sessionId, people, initial }: AttendancePanelProps) {
  const [value, setValue] = useState(initial)
  const [pending, setPending] = useState(false)

  async function save() {
    setPending(true)
    try {
      const res = await fetch(`/api/training-sessions/${sessionId}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendees: value }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) toast.error(body.error ?? SAVE_ERROR_MESSAGE)
      else toast.success("Docházka uložena")
    } catch {
      toast.error(SAVE_ERROR_MESSAGE)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Zaznamenej účast všech členů týmu i přihlášených hostujících.
      </p>
      <AttendanceSelector teamMembers={people} value={value} onChange={setValue} disabled={pending} />
      <div className="pt-1">
        <Button size="sm" disabled={pending} onClick={() => void save()}>
          Uložit docházku
        </Button>
      </div>
    </div>
  )
}


