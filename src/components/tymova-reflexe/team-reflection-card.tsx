"use client"

import Link from "next/link"
import { Calendar, ChevronRight, CheckSquare } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { parseActionSteps } from "@/lib/tymova-reflexe/action-steps"
import type { TeamReflectionWithCreator } from "@/lib/tymova-reflexe/types"

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function monthLabel(monthStr: string): string {
  const parts = monthStr.split("-")
  const m = Number(parts[1])
  const year = parts[0]
  return `${MONTH_LABELS[m - 1]} ${year}`
}

interface TeamReflectionCardProps {
  reflection: TeamReflectionWithCreator
  onDeleted?: (id: string) => void
}

export function TeamReflectionCard({ reflection }: TeamReflectionCardProps) {
  const steps = parseActionSteps(reflection.planned_action_steps, reflection.responsible_person)

  return (
    <Card className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-4 sm:p-5 transition-all hover:border-primary/40 hover:bg-accent/15 hover:shadow-xs">
      <Link
        href={`/tymova-reflexe/${reflection.id}`}
        className="absolute inset-0 z-0"
        aria-label={`Otevřít reflexi za ${monthLabel(reflection.month)}`}
      />

      <div className="relative z-10 flex flex-col gap-3">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 pointer-events-none">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-heading font-semibold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors">
                  {monthLabel(reflection.month)}
                </span>
                <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                  Měsíční reflexe
                </Badge>
              </div>
            </div>
          </div>

          <div className="size-8 grid place-items-center text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0">
            <ChevronRight className="size-4" />
          </div>
        </div>

        {/* Action Steps Body */}
        {steps.length > 0 ? (
          <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5 sm:p-3 pointer-events-none">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <CheckSquare className="size-3.5 text-primary" />
              <span>
                Akční kroky ({steps.length})
              </span>
            </div>

            <div className="space-y-1">
              {steps.slice(0, 3).map((step, idx) => (
                <div key={step.id || idx} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="size-1.5 rounded-full bg-primary/70 shrink-0" />
                    <span className="truncate font-medium text-foreground/90">
                      {step.text || <span className="italic text-muted-foreground">Bez popisu</span>}
                    </span>
                  </div>
                  {step.assignee && (
                    <span className="shrink-0 text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border/50 font-normal">
                      {step.assignee}
                    </span>
                  )}
                </div>
              ))}
              {steps.length > 3 && (
                <p className="text-[10px] text-muted-foreground pl-3">
                  + další {steps.length - 3} {steps.length - 3 === 1 ? "krok" : steps.length - 3 < 5 ? "kroky" : "kroků"}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/15 p-2.5 text-xs text-muted-foreground italic pointer-events-none">
            Žádné naplánované akční kroky — klikněte pro otevření detailu
          </div>
        )}

        {/* Footer info: Creator */}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pointer-events-none pt-0.5">
          <span className="truncate">
            {reflection.created_by && `Založil:a ${reflection.created_by.name}`}
          </span>
          <span className="text-[11px] text-primary/80 group-hover:underline">
            Zobrazit detail →
          </span>
        </div>
      </div>
    </Card>
  )
}
