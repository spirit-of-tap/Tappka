"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { DashboardWidgetId, DashboardWidgetMeta } from "@/lib/dashboard/types"

const LAYOUT_ENDPOINT = "/api/dashboard/layout"
const SAVE_ERROR = "Nepodařilo se uložit nastavení dashboardu."
const LAST_WIDGET_HINT = "Aspoň jedna část dashboardu musí zůstat zapnutá."

export interface DashboardWidgetSettingsProps {
  /** Widgets the role can see, in canonical dashboard order. */
  widgets: DashboardWidgetMeta[]
  shown: DashboardWidgetId[]
}

export function DashboardWidgetSettings({ widgets, shown }: DashboardWidgetSettingsProps) {
  const router = useRouter()
  const [visible, setVisible] = React.useState(() => new Set(shown))
  const [saving, setSaving] = React.useState(false)
  const showsAll = widgets.every((w) => visible.has(w.id))

  async function save(next: Set<DashboardWidgetId>) {
    const previous = visible
    setVisible(next)
    setSaving(true)
    try {
      const res = await fetch(LAYOUT_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgets: widgets.filter((w) => next.has(w.id)).map((w) => w.id) }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setVisible(previous)
      toast.error(SAVE_ERROR)
    } finally {
      setSaving(false)
    }
  }

  function toggle(id: DashboardWidgetId, on: boolean) {
    const next = new Set(visible)
    if (on) next.add(id)
    else next.delete(id)
    void save(next)
  }

  return (
    <div className="space-y-3">
      {widgets.map((widget) => {
        const checked = visible.has(widget.id)
        const isLast = checked && visible.size === 1
        return (
          <div key={widget.id} className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{widget.label}</p>
              <p className="text-xs text-muted-foreground">{isLast ? LAST_WIDGET_HINT : widget.description}</p>
            </div>
            <Switch
              aria-label={widget.label}
              checked={checked}
              disabled={saving || isLast}
              onCheckedChange={(on) => toggle(widget.id, on)}
            />
          </div>
        )
      })}
      <Button
        variant="outline"
        size="sm"
        disabled={saving || showsAll}
        onClick={() => void save(new Set(widgets.map((w) => w.id)))}
      >
        Zobrazit vše
      </Button>
    </div>
  )
}
