"use client"

import Link from "next/link"
import { Award, ChevronRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { TeamAnnualReflectionSummary } from "@/lib/tymova-reflexe/semester-types"

function rocnikovaLabel(reflectionMonth: string): string {
  const [year] = reflectionMonth.split("-")
  return `Ročníková reflexe ${year}`
}

interface RocnikovaReflectionCardProps {
  reflection: TeamAnnualReflectionSummary
  onDeleted?: (id: string) => void
}

export function RocnikovaReflectionCard({ reflection }: RocnikovaReflectionCardProps) {
  const isComplete = reflection.filledTopicsCount === reflection.totalTopicsCount
  const progressPercent = Math.round(
    (reflection.filledTopicsCount / reflection.totalTopicsCount) * 100,
  )

  return (
    <Card className="group relative overflow-hidden rounded-xl border border-chart-5/30 bg-card p-4 sm:p-5 transition-all hover:border-chart-5/60 hover:bg-chart-5/5 hover:shadow-xs">
      <Link
        href={`/tymova-reflexe/rocnikova/${reflection.id}`}
        className="absolute inset-0 z-0"
        aria-label={`Otevřít ${rocnikovaLabel(reflection.reflection_month)}`}
      />

      <div className="relative z-10 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pointer-events-none">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chart-5/15 text-chart-5">
              <Award className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-heading font-semibold text-base sm:text-lg text-foreground group-hover:text-chart-5 transition-colors">
                  {rocnikovaLabel(reflection.reflection_month)}
                </span>
                <Badge
                  variant="outline"
                  className="border-chart-5/40 bg-chart-5/10 text-chart-5 text-[11px] font-normal"
                >
                  11 témat
                </Badge>
              </div>
            </div>
          </div>

          <div className="size-8 grid place-items-center text-muted-foreground/40 group-hover:text-chart-5 group-hover:translate-x-0.5 transition-all shrink-0">
            <ChevronRight className="size-4" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5 pointer-events-none rounded-lg border border-chart-5/20 bg-chart-5/5 p-2.5 sm:p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground/85">Vyplněno témat</span>
            <span className="font-semibold tabular-nums text-foreground/90">
              {reflection.filledTopicsCount} z {reflection.totalTopicsCount} ({progressPercent} %)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-chart-5/20">
            <div
              className={cn(
                "h-full transition-all duration-500 rounded-full",
                isComplete ? "bg-emerald-500" : "bg-chart-5",
              )}
              style={{
                width: `${progressPercent}%`,
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pointer-events-none pt-0.5">
          <span>{reflection.created_by && `Založil:a ${reflection.created_by.name}`}</span>
          <span className="text-[11px] text-chart-5/90 font-medium group-hover:underline">
            {isComplete ? "Zobrazit reflexi →" : "Pokračovat ve vyplňování →"}
          </span>
        </div>
      </div>
    </Card>
  )
}

export const SemesterReflectionCard = RocnikovaReflectionCard
