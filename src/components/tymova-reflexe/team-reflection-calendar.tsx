"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, ChevronDown, GraduationCap } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { buildSchoolYears, type MonthCell } from "@/lib/tymova-reflexe/month-grid"

const MONTH_SHORT_LABELS = [
  "Led", "Úno", "Bře", "Dub", "Kvě", "Čvn",
  "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro",
] as const

function shortMonthLabel(monthStr: string): string {
  const m = Number(monthStr.slice(5, 7))
  return MONTH_SHORT_LABELS[m - 1]
}

interface TeamReflectionCalendarProps {
  monthlyReflections: { id: string; month: string }[]
  semesterReflections: { id: string; month: string }[]
  currentMonth: string
  onboardingYear: number | null
}

function cellHref(cell: MonthCell): string {
  if (cell.kind === "semester") {
    return cell.status === "done"
      ? `/tymova-reflexe/semestralni/${cell.reflectionId}`
      : `/tymova-reflexe/semestralni/nova?semester=${cell.month}`
  }
  return cell.status === "done"
    ? `/tymova-reflexe/${cell.reflectionId}`
    : `/tymova-reflexe/nova?month=${cell.month}`
}

function cellClasses(cell: MonthCell): string {
  if (cell.kind === "semester") {
    return cell.status === "done"
      ? "border-chart-5/40 bg-chart-5/10 text-foreground hover:bg-chart-5/15"
      : "border-chart-5/40 border-dashed text-muted-foreground/70 hover:text-muted-foreground hover:bg-chart-5/5"
  }
  return cell.status === "done"
    ? "border-primary/30 bg-primary/10 text-foreground hover:bg-primary/15"
    : cell.status === "current-missing"
      ? "border-amber-500/50 border-dashed bg-amber-500/5 text-foreground hover:bg-amber-500/10"
      : "border-dashed border-border text-muted-foreground/70 hover:text-muted-foreground hover:bg-accent/40"
}

function CalendarCell({ cell }: { cell: MonthCell }) {
  if (cell.status === "future") {
    return (
      <div
        title={cell.month}
        className="flex flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-border/30 py-2.5 text-xs font-medium text-muted-foreground/30"
      >
        <span>{shortMonthLabel(cell.month)}</span>
      </div>
    )
  }

  return (
    <Link
      href={cellHref(cell)}
      title={cell.month}
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 rounded-md border py-2.5 text-xs font-medium transition-colors",
        cellClasses(cell),
      )}
    >
      {cell.kind === "semester" && (
        <GraduationCap className="absolute top-1 right-1 size-2.5 opacity-60" />
      )}
      {cell.status === "done" ? (
        <Check className="size-3.5" />
      ) : (
        <span
          className={cn(
            "size-1.5 rounded-full",
            cell.status === "current-missing" ? (cell.kind === "semester" ? "bg-chart-5" : "bg-amber-500") : "bg-transparent",
          )}
        />
      )}
      <span>{shortMonthLabel(cell.month)}</span>
    </Link>
  )
}

export function TeamReflectionCalendar({
  monthlyReflections,
  semesterReflections,
  currentMonth,
  onboardingYear,
}: TeamReflectionCalendarProps) {
  const years = buildSchoolYears(monthlyReflections, semesterReflections, currentMonth, 2, onboardingYear)
  const currentYear = years.find((y) => y.months.some((m) => m.month === currentMonth))
  const defaultOpenStartYear = currentYear?.startYear ?? years[years.length - 1]?.startYear
  const [openYears, setOpenYears] = useState<Set<number>>(
    () => new Set(defaultOpenStartYear !== undefined ? [defaultOpenStartYear] : []),
  )

  function toggle(startYear: number) {
    setOpenYears((prev) => {
      const next = new Set(prev)
      if (next.has(startYear)) next.delete(startYear)
      else next.add(startYear)
      return next
    })
  }

  return (
    <Card className="p-3 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Docházka reflexí</h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-primary/50" /> měsíční
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-chart-5/50" /> semestrální
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full border border-dashed border-amber-500/70" /> chybí
          </span>
        </div>
      </div>

      <div className="space-y-1">
        {years.map((year) => {
          const isOpen = openYears.has(year.startYear)
          return (
            <Collapsible key={year.startYear} open={isOpen} onOpenChange={() => toggle(year.startYear)}>
              <CollapsibleTrigger className="flex w-full items-center gap-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown className={cn("size-4 transition-transform", !isOpen && "-rotate-90")} />
                {year.rocnik !== null ? (
                  <>
                    <span className="font-semibold text-foreground">{year.rocnik}. ročník</span>
                    <span className="text-xs font-normal text-muted-foreground/70">({year.label})</span>
                  </>
                ) : (
                  <span className="font-medium">{year.label}</span>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-2 pt-1 pb-2">
                  {year.months.map((cell) => (
                    <CalendarCell key={cell.month} cell={cell} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </div>
    </Card>
  )
}
