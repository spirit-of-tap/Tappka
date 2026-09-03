import type { ReactNode } from "react"

import { PageBack } from "@/components/ui/page-back"

interface PageHeaderProps {
  title: string
  description?: string
  count?: { value: number; label: string }
  action?: ReactNode
  back?: { href: string; label: string }
  icon?: ReactNode
}

export function PageHeader({ title, description, count, action, back, icon }: PageHeaderProps) {
  return (
    <div className="space-y-1">
      {back && <PageBack href={back.href} label={back.label} />}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex items-start gap-3 sm:gap-4">
          {icon && <div className="shrink-0 pt-0.5">{icon}</div>}
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
          </div>
        </div>
        {(count || action) && (
          <div className="flex min-h-9 items-center gap-3 pt-0.5">
            {count && (
              <span className="text-sm tabular-nums text-muted-foreground">
                {count.value} {count.label}
              </span>
            )}
            {action}
          </div>
        )}
      </div>
    </div>
  )
}
