"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, Award, Calendar, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  buildSchoolYears,
  type MonthCell,
} from "@/lib/tymova-reflexe/month-grid"

const MONTH_NAMES = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function getMonthName(monthStr: string): string {
  const parts = monthStr.split("-")
  const m = Number(parts[1])
  return MONTH_NAMES[m - 1] ?? "—"
}

interface TeamReflectionCalendarProps {
  monthlyReflections: { id: string; month: string }[]
  rocnikovaReflections: { id: string; month: string }[]
  currentMonth: string
  onboardingYear: number | null
}

function RegularMonthCell({ cell }: { cell: MonthCell }) {
  const full = getMonthName(cell.month)

  if (cell.monthlyStatus === "future") {
    return (
      <div
        title={`${full} (budoucí období)`}
        className="flex h-[72px] flex-col items-center justify-center gap-1 rounded-lg bg-muted/20 p-1.5 text-xs text-muted-foreground/40 select-none border border-transparent"
      >
        <span className="font-medium text-xs truncate max-w-full">{full}</span>
        <span className="text-[10px] text-muted-foreground/30">—</span>
      </div>
    )
  }

  const href =
    cell.monthlyStatus === "done"
      ? `/tymova-reflexe/${cell.monthlyReflectionId}`
      : `/tymova-reflexe/nova?month=${cell.month}`

  const isDone = cell.monthlyStatus === "done"
  const isCurrentMissing = cell.monthlyStatus === "current-missing"

  return (
    <Link
      href={href}
      title={`${full} — ${isDone ? "vyplněno" : isCurrentMissing ? "k vyplnění" : "chybí"}`}
      className={cn(
        "group relative flex h-[72px] flex-col items-center justify-center gap-1 rounded-lg p-1.5 text-xs transition-all text-center",
        isDone &&
          "bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-500/20 border border-emerald-500/30",
        isCurrentMissing &&
          "bg-amber-500/10 text-amber-900 dark:text-amber-100 hover:bg-amber-500/20 border border-amber-500/50 ring-1 ring-amber-500/30",
        !isDone &&
          !isCurrentMissing &&
          "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-accent/60 border border-transparent",
      )}
    >
      <span className="font-semibold text-xs truncate max-w-full tracking-tight">
        {full}
      </span>

      {isDone ? (
        <div className="flex items-center justify-center size-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <Check className="size-3 stroke-[2.5]" />
        </div>
      ) : isCurrentMissing ? (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
          <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
          K vyplnění
        </span>
      ) : (
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 group-hover:text-primary transition-colors">
          <Plus className="size-2.5" />
          Vytvořit
        </span>
      )}
    </Link>
  )
}

function MayMonthCell({ cell }: { cell: MonthCell }) {
  const full = getMonthName(cell.month)
  const isFuture = cell.monthlyStatus === "future" && cell.rocnikovaStatus === "future"

  if (isFuture) {
    return (
      <div
        title={`${full} (budoucí období)`}
        className="flex h-[72px] flex-col items-center justify-center gap-1 rounded-lg bg-muted/20 p-1.5 text-xs text-muted-foreground/40 select-none border border-transparent"
      >
        <span className="font-medium text-xs">{full}</span>
        <span className="text-[10px] text-muted-foreground/30">—</span>
      </div>
    )
  }

  const monthlyHref =
    cell.monthlyStatus === "done"
      ? `/tymova-reflexe/${cell.monthlyReflectionId}`
      : `/tymova-reflexe/nova?month=${cell.month}`

  const rocnikovaHref =
    cell.rocnikovaStatus === "done"
      ? `/tymova-reflexe/rocnikova/${cell.rocnikovaReflectionId}`
      : `/tymova-reflexe/rocnikova/nova?month=${cell.month}`

  const isMonthlyDone = cell.monthlyStatus === "done"
  const isMonthlyCurrentMissing = cell.monthlyStatus === "current-missing"

  const isRocnikovaDone = cell.rocnikovaStatus === "done"
  const isRocnikovaCurrentMissing = cell.rocnikovaStatus === "current-missing"

  return (
    <div className="flex h-[72px] flex-col justify-between rounded-lg bg-muted/30 p-1 border border-border/50 text-center">
      <span className="text-xs font-semibold text-foreground leading-none pt-0.5">
        {full}
      </span>

      <div className="flex flex-col gap-0.5">
        {/* Monthly button */}
        <Link
          href={monthlyHref}
          title={`Měsíční reflexe za ${full}`}
          className={cn(
            "flex items-center justify-center gap-1 rounded py-0.5 px-1 text-[10px] font-medium transition-colors leading-tight",
            isMonthlyDone && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/25",
            isMonthlyCurrentMissing && "bg-amber-500/15 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25",
            !isMonthlyDone && !isMonthlyCurrentMissing && "bg-background/80 text-muted-foreground hover:text-foreground",
          )}
        >
          {isMonthlyDone ? (
            <Check className="size-2.5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
          ) : (
            <Plus className="size-2.5 text-muted-foreground/70" />
          )}
          <span>Měsíční</span>
        </Link>

        {/* Ročníková button */}
        <Link
          href={rocnikovaHref}
          title={`Ročníková reflexe za ${full}`}
          className={cn(
            "flex items-center justify-center gap-1 rounded py-0.5 px-1 text-[10px] font-semibold transition-colors leading-tight",
            isRocnikovaDone && "bg-chart-5/20 text-chart-5 hover:bg-chart-5/30",
            isRocnikovaCurrentMissing && "bg-amber-500/15 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25",
            !isRocnikovaDone && !isRocnikovaCurrentMissing && "bg-chart-5/10 text-chart-5 hover:bg-chart-5/20",
          )}
        >
          {isRocnikovaDone ? (
            <Check className="size-2.5 text-chart-5 stroke-[2.5]" />
          ) : (
            <Award className="size-2.5 text-chart-5" />
          )}
          <span>Ročníková</span>
        </Link>
      </div>
    </div>
  )
}

export function TeamReflectionCalendar({
  monthlyReflections,
  rocnikovaReflections,
  currentMonth,
  onboardingYear,
}: TeamReflectionCalendarProps) {
  const years = buildSchoolYears(
    monthlyReflections,
    rocnikovaReflections,
    currentMonth,
    2,
    onboardingYear,
  )

  const activeYear = years.find((y) => y.isCurrentYear) ?? years[0]
  const [selectedStartYear, setSelectedStartYear] = useState<number>(activeYear.startYear)

  const selectedYear = years.find((y) => y.startYear === selectedStartYear) ?? years[0]

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-3 sm:p-5 shadow-xs">
      {/* Header with Title & Ročník Segmented Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Calendar className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">Plán reflexí za studium</h2>
            <p className="text-xs text-muted-foreground truncate">
              {selectedYear.rocnik !== null ? `${selectedYear.rocnik}. ročník` : selectedYear.label}{" "}
              ({selectedYear.label}) — {selectedYear.completedCount} z {selectedYear.totalCount} splněno
            </p>
          </div>
        </div>

        {/* Ročník segmented control - 3 equal columns on mobile, inline flex on desktop */}
        <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-muted/60 p-1 rounded-lg w-full sm:w-auto">
          {years.map((year) => {
            const isSelected = year.startYear === selectedStartYear
            return (
              <button
                key={year.startYear}
                type="button"
                onClick={() => setSelectedStartYear(year.startYear)}
                className={cn(
                  "flex items-center justify-center gap-1 px-1.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer truncate",
                  isSelected
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40",
                )}
              >
                <span className="truncate">{year.rocnik !== null ? `${year.rocnik}. ročník` : year.label}</span>
                <span
                  className={cn(
                    "text-[10px] tabular-nums rounded px-1 py-0.2 shrink-0",
                    isSelected ? "bg-muted text-foreground" : "text-muted-foreground",
                  )}
                >
                  {year.completedCount}/{year.totalCount}
                </span>
                {year.isCurrentYear && (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-primary"
                    title="Aktuální studijní ročník"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 8-month unified timeline strip: 4 cols on mobile (Semester 1 & 2), 8 cols on desktop */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-1.5 sm:gap-2 pt-1 border-t border-border/40">
        {selectedYear.months.map((cell) =>
          cell.isMay ? (
            <MayMonthCell key={cell.month} cell={cell} />
          ) : (
            <RegularMonthCell key={cell.month} cell={cell} />
          ),
        )}
      </div>
    </div>
  )
}
