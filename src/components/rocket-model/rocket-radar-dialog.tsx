"use client"

import { useMemo, useState } from "react"
import { ChevronRight, Maximize2, Minimize2, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { calculateRocketRadarData } from "@/lib/rocket-model/progress"
import type {
  RocketCategoryWithItems,
  RocketIndividualState,
  RocketTeamCheck,
} from "@/lib/rocket-model/types"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"
import { cn } from "@/lib/utils"
import { RocketRadarChart, type RadarMetricMode } from "./rocket-radar-chart"

export interface RocketRadarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: RocketCategoryWithItems[]
  teamMembers: TeamMemberProfile[]
  states: RocketIndividualState[]
  teamChecks: RocketTeamCheck[]
  onSelectCategory?: (categoryId: string) => void
  defaultFullscreen?: boolean
}

export function RocketRadarDialog({
  open,
  onOpenChange,
  categories,
  teamMembers,
  states,
  teamChecks,
  onSelectCategory,
  defaultFullscreen = true,
}: RocketRadarDialogProps) {
  const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen)
  const [metricMode, setMetricMode] = useState<RadarMetricMode>("both")

  const radarData = useMemo(
    () => calculateRocketRadarData(categories, teamMembers, states, teamChecks),
    [categories, teamMembers, states, teamChecks],
  )

  const legend = (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {(metricMode === "both" ||
        metricMode === "team_only" ||
        metricMode === "all") && (
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary" />
          <span className="font-medium text-foreground">Potvrzeno týmem</span>
        </div>
      )}
      {(metricMode === "both" ||
        metricMode === "average_only" ||
        metricMode === "all") && (
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-info" />
          <span className="font-medium text-foreground">Průměr členů:ek</span>
        </div>
      )}
      {metricMode === "all" && (
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-dashed border-warning bg-warning/30" />
          <span className="font-medium text-foreground">
            Shoda týmu (100 %)
          </span>
        </div>
      )}
    </div>
  )

  const sectionCards = (
    <div className="space-y-2">
      {radarData.map((point) => (
        <button
          key={point.categoryId}
          type="button"
          onClick={() => {
            onOpenChange(false)
            onSelectCategory?.(point.categoryId)
          }}
          className={cn(
            "w-full flex items-center justify-between gap-2 rounded-md border border-border/60 p-2.5 text-left transition-colors",
            onSelectCategory
              ? "cursor-pointer hover:bg-muted/50 hover:border-border"
              : "cursor-default",
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-foreground shrink-0">
                {point.code}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {point.title}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span>
                Potvrzeno:{" "}
                <strong className="font-medium text-foreground">
                  {point.teamCheckedPercent} %
                </strong>{" "}
                ({point.teamCheckedCount}/{point.totalItems})
              </span>
              <span>
                Průměr:{" "}
                <strong className="font-medium text-foreground">
                  {point.memberAveragePercent} %
                </strong>
              </span>
            </div>
          </div>
          {onSelectCategory && (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      ))}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "bg-background text-foreground transition-all duration-150",
          isFullscreen
            ? "fixed inset-0 top-0 left-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none sm:max-w-none max-h-none rounded-none border-none p-4 sm:p-6 flex flex-col z-50 overflow-hidden"
            : "max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6",
        )}
      >
        {/* Top Header Bar */}
        <div className="flex flex-col gap-3 pb-3 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="font-heading text-lg sm:text-xl font-bold">
              Radarový graf sekcí
            </DialogTitle>
            <Badge
              variant="secondary"
              className="gap-1.5 border-none bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success-strong"
            >
              <span className="size-1.5 rounded-full bg-success animate-pulse" />
              Živá synchronizace
            </Badge>
          </div>
          <DialogDescription className="sr-only">
            Přehled naplnění jednotlivých sekcí Rocket Modelu v reálném čase.
          </DialogDescription>

          {/* Controls & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Metric Mode Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1">
              <Button
                variant={metricMode === "both" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMetricMode("both")}
                className="h-7 px-2.5 text-xs"
              >
                Oba ukazatele
              </Button>
              <Button
                variant={metricMode === "team_only" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMetricMode("team_only")}
                className="h-7 px-2.5 text-xs"
              >
                Pouze potvrzeno
              </Button>
              <Button
                variant={metricMode === "average_only" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMetricMode("average_only")}
                className="h-7 px-2.5 text-xs"
              >
                Pouze průměr
              </Button>
              <Button
                variant={metricMode === "all" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMetricMode("all")}
                className="h-7 px-2.5 text-xs"
              >
                Včetně 100% shody
              </Button>
            </div>

            {/* Window / Fullscreen toggle button */}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label={
                isFullscreen ? "Zmenšit do okna" : "Zvětšit na celou obrazovku"
              }
              title={
                isFullscreen ? "Zmenšit do okna" : "Zvětšit na celou obrazovku"
              }
            >
              {isFullscreen ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </Button>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onOpenChange(false)}
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label="Zavřít"
              title="Zavřít"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Content Layout */}
        {isFullscreen ? (
          /* Fullscreen Layout: Split on desktop, stacked on mobile */
          <div className="flex-1 min-h-0 mt-3 flex flex-col lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 overflow-hidden">
            {/* Left/Main Column: Radar chart */}
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center rounded-xl border border-border/60 bg-muted/10 p-3 sm:p-5 overflow-hidden">
              <div className="mb-2 shrink-0">{legend}</div>
              <div className="w-full flex-1 flex items-center justify-center min-h-0 min-w-0">
                <RocketRadarChart
                  data={radarData}
                  metricMode={metricMode}
                  containerClassName="max-h-[min(640px,calc(100vh-210px))] w-full h-full"
                />
              </div>
            </div>

            {/* Right Column: Detailed Section list */}
            <div className="w-full mt-4 lg:mt-0 flex flex-col min-h-0 rounded-xl border border-border/60 bg-card p-4 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-border/60 shrink-0">
                <h4 className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Přehled sekcí ({radarData.length})
                </h4>
                {onSelectCategory && (
                  <span className="text-[11px] text-muted-foreground">
                    Kliknutím přejdeš na sekci
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto mt-3 pr-1">
                {sectionCards}
              </div>
            </div>
          </div>
        ) : (
          /* Windowed Layout */
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              {legend}
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/10 p-2 sm:p-4">
              <RocketRadarChart
                data={radarData}
                metricMode={metricMode}
                containerClassName="max-h-[380px] w-full"
              />
            </div>

            {radarData.length > 0 && (
              <div className="space-y-2 border-t border-border/60 pt-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Přehled sekcí ({radarData.length})
                  </h4>
                  {onSelectCategory && (
                    <span className="text-[11px] text-muted-foreground">
                      Kliknutím přejdeš na sekci
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {sectionCards}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
