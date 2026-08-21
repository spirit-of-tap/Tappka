import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"

interface MonthSectionProps {
  label: string
  count: number
  children: ReactNode
}

/**
 * Timeline month marker: non-interactive header (label + count + rule) and a
 * body carrying a vertical rail that connects entry discs. Entries are plain
 * history — no collapsing; callers skip empty months entirely.
 */
export function MonthSection({ label, count, children }: MonthSectionProps) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </h2>
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {count}
        </Badge>
        <div aria-hidden className="h-px min-w-4 flex-1 bg-border" />
      </div>
      <div className="relative space-y-1">
        {/* Rail connecting the entry discs (disc center = 14px). */}
        <div
          aria-hidden
          className="absolute bottom-4 left-[13.5px] top-4 w-px bg-border"
        />
        {children}
      </div>
    </section>
  )
}
