"use client"

import { useState } from "react"
import { Plus, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog"
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import { TeamReflectionForm } from "./team-reflection-form"
import { TeamReflectionCard } from "./team-reflection-card"
import type { TeamReflectionWithCreator } from "@/lib/tymova-reflexe/types"

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

interface TeamReflectionListProps {
  reflections: TeamReflectionWithCreator[]
  teamId: string
  profileId: string
}

export function TeamReflectionList({ reflections, teamId, profileId }: TeamReflectionListProps) {
  const [items, setItems] = useState(reflections)
  const [createOpen, setCreateOpen] = useState(false)

  const currentMonth = getCurrentMonth()
  const hasCurrentMonthReflection = items.some((r) => r.month === currentMonth)

  function handleCreated(reflection: TeamReflectionWithCreator) {
    setItems((prev) => {
      const updated = [reflection, ...prev]
      updated.sort((a, b) => b.month.localeCompare(a.month))
      return updated
    })
    setCreateOpen(false)
  }

  function handleUpdated(reflection: TeamReflectionWithCreator) {
    setItems((prev) => prev.map((r) => (r.id === reflection.id ? reflection : r)))
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-end gap-4">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={hasCurrentMonthReflection}>
              <Plus className="size-4" />
              {hasCurrentMonthReflection ? "Reflexe za tento měsíc existuje" : "Nová reflexe"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nová týmová reflexe</DialogTitle>
            </DialogHeader>
            <TeamReflectionForm
              teamId={teamId}
              profileId={profileId}
              onSuccess={handleCreated}
              onCancel={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <CalendarDays className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Žádné reflexe</EmptyTitle>
            <EmptyDescription>
              Zatím nemáte žádné záznamy. Vytvořte první měsíční reflexi.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="size-4" />
                  Přidat reflexi
                </Button>
              </DialogTrigger>
            </Dialog>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-4">
          {items.map((reflection) => (
            <TeamReflectionCard
              key={reflection.id}
              reflection={reflection}
              teamId={teamId}
              profileId={profileId}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
