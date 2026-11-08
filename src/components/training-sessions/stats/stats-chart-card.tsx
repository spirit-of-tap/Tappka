"use client"

import { FileSpreadsheet, ImageDown } from "lucide-react"
import { useId, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { downloadCsv, exportChartAsPng, slugify, type LegendItem } from "@/components/time-tracking/chart-export"
import { Button } from "@/components/ui/button"

/** Shared Recharts styling so every TS statistics chart reads the same in both themes. */
export const STATS_CHART = {
  height: 300,
  minColumnWidth: 56,
  axisFontSize: 11,
  yAxisWidth: 40,
  percentAxisWidth: 56,
  maxBarSize: 56,
  tick: { fontSize: 11, fill: "var(--muted-foreground)" },
  tooltipItemStyle: { color: "var(--popover-foreground)" },
  tooltipStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--popover-foreground)",
    fontSize: 12,
  },
} as const

const EXPORT_ERROR_MESSAGE = "Graf se nepodařilo stáhnout"

interface StatsChartCardProps {
  title: string
  /** Team · period, printed under the title in PNG exports. */
  subtitle: string
  fileNamePrefix: string
  legend: readonly LegendItem[]
  toCsv: () => string
  /** Minimum chart width before it scrolls sideways (phones). */
  minWidth?: number
  children: ReactNode
}

export function StatsChartCard({ title, subtitle, fileNamePrefix, legend, toCsv, minWidth, children }: StatsChartCardProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const [isExporting, setIsExporting] = useState(false)
  const fileName = `${fileNamePrefix}-${slugify(title)}`

  async function exportPng() {
    if (!chartRef.current) return
    setIsExporting(true)
    try {
      await exportChartAsPng({ container: chartRef.current, title, subtitle, legend, fileName: `${fileName}.png` })
    } catch {
      toast.error(EXPORT_ERROR_MESSAGE)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <h3 id={titleId} className="font-semibold">
          {title}
        </h3>
        <div className="flex gap-2 sm:ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void exportPng()}
            disabled={isExporting}
            aria-label={`Stáhnout ${title} jako PNG`}
          >
            <ImageDown aria-hidden />
            PNG
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(toCsv(), `${fileName}.csv`)}
            aria-label={`Stáhnout ${title} jako CSV`}
          >
            <FileSpreadsheet aria-hidden />
            CSV
          </Button>
        </div>
      </div>
      {legend.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legenda">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
      )}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div ref={chartRef} aria-labelledby={titleId} role="figure" style={{ minWidth }}>
          {children}
        </div>
      </div>
    </div>
  )
}
