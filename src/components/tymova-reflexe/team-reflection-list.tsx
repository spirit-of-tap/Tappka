"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import { TeamReflectionCard } from "./team-reflection-card"
import type { TeamReflectionWithCreator } from "@/lib/tymova-reflexe/types"

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function monthLabel(monthStr: string): string {
  const m = Number(monthStr.slice(5, 7))
  return `${MONTH_LABELS[m - 1]} ${monthStr.slice(0, 4)}`
}

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

  const currentMonth = getCurrentMonth()
  const hasCurrentMonthReflection = items.some((r) => r.month === currentMonth)

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-end gap-4">
        <Button size="sm" asChild disabled={hasCurrentMonthReflection}>
          <Link href="/tymova-reflexe/nova">
            <Plus className="size-4" />
            {hasCurrentMonthReflection ? "Reflexe za tento měsíc existuje" : "Nová reflexe"}
          </Link>
        </Button>
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
            <Button variant="outline" size="sm" asChild>
              <Link href="/tymova-reflexe/nova">
                <Plus className="size-4" />
                Přidat reflexi
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-4">
          {items.map((reflection) => (
            <TeamReflectionCard
              key={reflection.id}
              reflection={reflection}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
