import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  description?: string
  count?: { value: number; label: string }
  action?: ReactNode
}

export function PageHeader({ title, description, count, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        {count && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {count.value} {count.label}
          </span>
        )}
        {action}
      </div>
    </div>
  )
}
