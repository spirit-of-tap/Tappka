"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MobileFab, MobileFabSpacer } from "@/components/mobile-fab"
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import { TeamReflectionCard } from "./team-reflection-card"
import { SemesterReflectionCard } from "./semester-reflection-card"
import { TeamReflectionCalendar } from "./team-reflection-calendar"
import { isSemesterMonth } from "@/lib/tymova-reflexe/month-grid"
import type { TeamReflectionWithCreator } from "@/lib/tymova-reflexe/types"
import type { TeamSemesterReflectionSummary } from "@/lib/tymova-reflexe/semester-types"

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

type CombinedItem =
  | { kind: "monthly"; date: string; reflection: TeamReflectionWithCreator }
  | { kind: "semester"; date: string; reflection: TeamSemesterReflectionSummary }

interface TeamReflectionListProps {
  reflections: TeamReflectionWithCreator[]
  semesterReflections: TeamSemesterReflectionSummary[]
  onboardingYear: number | null
}

export function TeamReflectionList({
  reflections,
  semesterReflections,
  onboardingYear,
}: TeamReflectionListProps) {
  const [items, setItems] = useState(reflections)
  const [semesterItems, setSemesterItems] = useState(semesterReflections)

  const currentMonth = getCurrentMonth()
  const currentMonthIsSemester = isSemesterMonth(currentMonth)
  const hasCurrentReflection = currentMonthIsSemester
    ? semesterItems.some((r) => r.semester_month === currentMonth)
    : items.some((r) => r.month === currentMonth)
  const newReflectionHref = currentMonthIsSemester
    ? "/tymova-reflexe/semestralni/nova"
    : "/tymova-reflexe/nova"

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id))
  }

  function handleSemesterDeleted(id: string) {
    setSemesterItems((prev) => prev.filter((r) => r.id !== id))
  }

  const combined: CombinedItem[] = [
    ...items.map((reflection) => ({ kind: "monthly" as const, date: reflection.month, reflection })),
    ...semesterItems.map((reflection) => ({
      kind: "semester" as const,
      date: reflection.semester_month,
      reflection,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-4 sm:space-y-6">
      <TeamReflectionCalendar
        monthlyReflections={items}
        semesterReflections={semesterItems.map((r) => ({ id: r.id, month: r.semester_month }))}
        currentMonth={currentMonth}
        onboardingYear={onboardingYear}
      />

      {!hasCurrentReflection && (
        <div className="flex items-center justify-end gap-4">
          <Button size="sm" asChild className="hidden sm:inline-flex">
            <Link href={newReflectionHref}>
              <Plus className="size-4" />
              Nová reflexe
            </Link>
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Historie reflexí</h2>

        {combined.length === 0 ? (
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
                <Link href={newReflectionHref}>
                  <Plus className="size-4" />
                  Přidat reflexi
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-4">
            {combined.map((item) =>
              item.kind === "monthly" ? (
                <TeamReflectionCard
                  key={`monthly-${item.reflection.id}`}
                  reflection={item.reflection}
                  onDeleted={handleDeleted}
                />
              ) : (
                <SemesterReflectionCard
                  key={`semester-${item.reflection.id}`}
                  reflection={item.reflection}
                  onDeleted={handleSemesterDeleted}
                />
              ),
            )}
          </div>
        )}
      </div>
      {!hasCurrentReflection && <MobileFab label="Nová týmová reflexe" href={newReflectionHref} />}
      <MobileFabSpacer />
    </div>
  )
}
