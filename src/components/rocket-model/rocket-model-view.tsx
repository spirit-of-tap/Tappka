"use client"

import { useCallback, useMemo, useState } from "react"
import confetti from "canvas-confetti"
import { Check, ChevronDown, History, Lock, Radar as RadarIcon, User, Users } from "lucide-react"

import { ProfileAvatar } from "@/components/profile-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { usePersistedState } from "@/lib/hooks/use-persisted-state"
import { formatRocketDateTime } from "@/lib/rocket-model/datetime"
import {
  calculateTeamProgressStats,
  canCheckAsTeam,
  coveragePercent,
  getMissingMembers,
  needsReconfirmation,
} from "@/lib/rocket-model/progress"
import type {
  RocketCategoryWithItems,
  RocketHistoryEntry,
  RocketIndividualState,
  RocketTeamCheck,
} from "@/lib/rocket-model/types"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"
import { cn } from "@/lib/utils"
import { RocketRadarDialog } from "./rocket-radar-dialog"

export interface RocketModelViewProps {
  categories: RocketCategoryWithItems[]
  teamMembers: TeamMemberProfile[]
  states: RocketIndividualState[]
  teamChecks: RocketTeamCheck[]
  history: RocketHistoryEntry[]
  profileId: string
  onToggleIndividual: (itemId: string, checked: boolean) => Promise<void>
  onToggleTeam: (itemId: string, checked: boolean) => Promise<void>
}

type RocketTab = "mine" | "team"
type TeamFilter = "all" | "ready" | "confirmed" | "reconfirm" | "in_progress"
type MineFilter = "all" | "incomplete"

function formatMissingMembers(missing: TeamMemberProfile[]): string {
  if (missing.length === 0) return ""
  if (missing.length === 1) {
    return `Chybí: ${missing[0].name ?? "Neznámý:á"}`
  }
  if (missing.length === 2) {
    return `Chybí: ${missing[0].name ?? "Neznámý:á"}, ${missing[1].name ?? "Neznámý:á"}`
  }
  return `Chybí: ${missing[0].name ?? "Neznámý:á"}, ${missing[1].name ?? "Neznámý:á"} a ${missing.length - 2} další`
}

export function RocketModelView({
  categories,
  teamMembers,
  states,
  teamChecks,
  history,
  profileId,
  onToggleIndividual,
  onToggleTeam,
}: RocketModelViewProps) {
  const [activeTab, setActiveTab] = usePersistedState<RocketTab>("tappka:rocket-model:tab", "mine")
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all")
  const [mineFilter, setMineFilter] = useState<MineFilter>("all")
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [isRadarOpen, setIsRadarOpen] = useState(false)

  const checkedByItem = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const state of states) {
      if (!state.is_checked) continue
      const set = map.get(state.item_id) ?? new Set<string>()
      set.add(state.profile_id)
      map.set(state.item_id, set)
    }
    return map
  }, [states])

  const teamChecksByItem = useMemo(
    () => new Map(teamChecks.map((check) => [check.item_id, check])),
    [teamChecks],
  )

  const stateByItemMember = useMemo(() => {
    const map = new Map<string, RocketIndividualState>()
    for (const state of states) {
      map.set(`${state.item_id}:${state.profile_id}`, state)
    }
    return map
  }, [states])

  const ownCheckedIds = useMemo(
    () =>
      new Set(
        states
          .filter((state) => state.profile_id === profileId && state.is_checked)
          .map((state) => state.item_id),
      ),
    [states, profileId],
  )

  const allItemIds = useMemo(
    () => categories.flatMap((category) => category.items.map((item) => item.id)),
    [categories],
  )

  const totalItems = allItemIds.length
  const totalOwnChecked = categories.reduce(
    (sum, category) => sum + category.items.filter((item) => ownCheckedIds.has(item.id)).length,
    0,
  )

  const teamStats = useMemo(
    () =>
      calculateTeamProgressStats(
        allItemIds,
        teamChecksByItem,
        checkedByItem,
        teamMembers.length,
      ),
    [allItemIds, teamChecksByItem, checkedByItem, teamMembers.length],
  )

  const allCollapsed = useMemo(
    () => categories.length > 0 && categories.every((cat) => collapsedCategories.has(cat.id)),
    [categories, collapsedCategories],
  )

  const handleToggleCategory = useCallback((categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }, [])

  const handleToggleAllCollapsed = useCallback(() => {
    setCollapsedCategories((prev) => {
      if (categories.every((cat) => prev.has(cat.id))) {
        return new Set()
      }
      return new Set(categories.map((c) => c.id))
    })
  }, [categories])

  const handleJumpToCategory = useCallback((categoryId: string) => {
    setCollapsedCategories((prev) => {
      if (!prev.has(categoryId)) return prev
      const next = new Set(prev)
      next.delete(categoryId)
      return next
    })
    const element = document.getElementById(`category-${categoryId}`)
    element?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const handleToggleTeamItem = useCallback(
    async (itemId: string, checked: boolean) => {
      await onToggleTeam(itemId, checked)
      if (checked) {
        try {
          void confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
          })
        } catch {
          // Ignored if canvas-confetti is unsupported
        }
      }
    },
    [onToggleTeam],
  )

  if (categories.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <Users />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>Zatím tu nic není</EmptyTitle>
          <EmptyDescription>Obsah Rocket Modelu se právě připravuje</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as RocketTab)}>
      <TabsList>
        <TabsTrigger value="mine">
          <User />
          Moje hodnocení
        </TabsTrigger>
        <TabsTrigger value="team">
          <Users />
          Týmový přehled
        </TabsTrigger>
      </TabsList>

      {/* Category Jump Navigation Bar — soft, borderless pill buttons */}
      <div className="no-scrollbar mt-3 -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-1">
        {categories.map((category) => {
          const ownCheckedCount = category.items.filter((item) => ownCheckedIds.has(item.id)).length
          const teamCheckedCount = category.items.filter((item) => teamChecksByItem.get(item.id)?.is_checked).length
          const isComplete =
            activeTab === "mine"
              ? ownCheckedCount === category.items.length && category.items.length > 0
              : teamCheckedCount === category.items.length && category.items.length > 0

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => handleJumpToCategory(category.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isComplete && "bg-success/15 text-success-strong",
              )}
              title={category.title}
            >
              <span>{category.code}</span>
              {isComplete && <Check className="size-3 text-success-strong" />}
            </button>
          )
        })}
      </div>

      {/* Moje hodnocení (Personal view) */}
      <TabsContent value="mine" aria-label="Moje hodnocení" className="mt-4 space-y-4">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-heading text-base font-semibold">Celkový postup</p>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Splněno {totalOwnChecked} z {totalItems} položek
              </p>
            </div>
            <span className="font-heading text-lg font-bold sm:text-xl tabular-nums">
              {coveragePercent(totalOwnChecked, totalItems)} %
            </span>
          </div>
          <Progress
            value={coveragePercent(totalOwnChecked, totalItems)}
            className="mt-3 h-2"
            indicatorClassName={
              totalOwnChecked === totalItems && totalItems > 0
                ? "bg-success"
                : undefined
            }
          />
        </Card>

        {/* Action / Filter bar for Personal View */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant={mineFilter === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMineFilter("all")}
              className="h-8 text-xs"
            >
              Vše ({totalItems})
            </Button>
            <Button
              variant={mineFilter === "incomplete" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMineFilter("incomplete")}
              className="h-8 text-xs"
            >
              K doplnění ({totalItems - totalOwnChecked})
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleAllCollapsed}
            className="h-8 text-xs text-muted-foreground"
          >
            {allCollapsed ? "Rozbalit vše" : "Sbalit vše"}
          </Button>
        </div>

        {/* Categories in DB order (order_index) — no hardcoded dimensions */}
        {categories.map((category) => {
          const checked = category.items.filter((item) =>
            ownCheckedIds.has(item.id),
          ).length
          const isCategoryComplete =
            checked === category.items.length && category.items.length > 0
          const isCollapsed = collapsedCategories.has(category.id)

          const itemsToRender = category.items.filter((item) => {
            if (mineFilter === "incomplete") {
              return !ownCheckedIds.has(item.id)
            }
            return true
          })

          return (
            <section
              id={`category-${category.id}`}
              key={category.id}
              className="scroll-mt-24"
            >
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex min-w-0 items-start sm:items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleToggleCategory(category.id)}
                    aria-label={
                      isCollapsed
                        ? `Rozbalit ${category.title}`
                        : `Sbalit ${category.title}`
                    }
                    className="mt-0.5 sm:mt-0 size-6 shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform duration-200",
                        isCollapsed && "-rotate-90",
                      )}
                    />
                  </Button>
                  <h2
                    onClick={() => handleToggleCategory(category.id)}
                    className="font-heading text-base font-bold sm:text-lg cursor-pointer select-none leading-snug sm:leading-normal"
                  >
                    {category.title}
                  </h2>
                </div>
                <div className="flex shrink-0 items-center gap-2.5 sm:gap-3 pl-[30px] sm:pl-0">
                  {isCategoryComplete && (
                    <Badge
                      variant="secondary"
                      className="border-none bg-success/15 text-xs text-success-strong"
                    >
                      <Check className="mr-1 size-3" />
                      Splněno
                    </Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <Progress
                      value={coveragePercent(checked, category.items.length)}
                      className="h-1.5 w-20 sm:w-24"
                      indicatorClassName={isCategoryComplete ? "bg-success" : undefined}
                    />
                    <p className="shrink-0 text-xs sm:text-sm tabular-nums text-muted-foreground">
                      {checked} z {category.items.length}
                    </p>
                  </div>
                </div>
              </div>

              {!isCollapsed && (
                <div className="mt-2.5 space-y-1 pl-1 sm:pl-7">
                  {itemsToRender.length === 0 ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-success-strong">
                      <Check className="size-4 shrink-0" />
                      Všechny položky v této kategorii máš splněné.
                    </div>
                  ) : (
                    itemsToRender.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40"
                      >
                        <Checkbox
                          id={`mine-${item.id}`}
                          checked={ownCheckedIds.has(item.id)}
                          onCheckedChange={(next) =>
                            onToggleIndividual(item.id, next === true)
                          }
                          className="mt-0.5"
                          aria-label={item.text_cs}
                        />
                        <Label
                          htmlFor={`mine-${item.id}`}
                          className="cursor-pointer text-sm leading-relaxed font-normal"
                        >
                          {item.text_cs}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>
          )
        })}

        {history.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <History />
                Historie změn ({history.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <Card className="p-4 sm:p-5 space-y-2">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-3 py-1.5"
                  >
                    <div>
                      <p className="text-sm leading-relaxed">{entry.itemText}</p>
                      <p className="text-xs text-muted-foreground">{entry.categoryTitle}</p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "shrink-0 border-none",
                        entry.isChecked
                          ? "bg-success/15 text-success-strong"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {entry.isChecked ? "Splněno" : "Zrušeno"}
                    </Badge>
                  </div>
                ))}
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}
      </TabsContent>

      {/* Týmový přehled (Team consensus view) */}
      <TabsContent value="team" aria-label="Týmový přehled" className="mt-4 space-y-4">
        {/* Team Progress Hero Card */}
        <Card className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-heading text-base font-semibold">Týmový postup</p>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Potvrzeno týmem: {teamStats.teamCheckedCount} z {teamStats.totalItems} položek (
                {teamStats.teamCheckedPercent} %)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {teamStats.readyToConfirmCount > 0 && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer border-none bg-primary/15 text-primary transition-colors hover:bg-primary/25 font-medium"
                  onClick={() => setTeamFilter("ready")}
                >
                  {teamStats.readyToConfirmCount} k potvrzení
                </Badge>
              )}
              {teamStats.reconfirmationCount > 0 && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer border-none bg-warning/15 text-warning-strong transition-colors hover:bg-warning/25 font-medium"
                  onClick={() => setTeamFilter("reconfirm")}
                >
                  {teamStats.reconfirmationCount} k novému potvrzení
                </Badge>
              )}
              <Badge variant="secondary" className="border-none">
                {teamStats.teamCheckedCount} potvrzeno
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRadarOpen(true)}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <RadarIcon className="size-3.5" />
                Radarový graf
              </Button>
            </div>
          </div>
          <Progress
            value={teamStats.teamCheckedPercent}
            className="mt-3 h-2"
            indicatorClassName={
              teamStats.teamCheckedCount === teamStats.totalItems && teamStats.totalItems > 0
                ? "bg-success"
                : undefined
            }
          />
        </Card>

        {/* Filter / Action Toolbar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant={teamFilter === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTeamFilter("all")}
              className="h-8 text-xs"
            >
              Vše ({teamStats.totalItems})
            </Button>
            <Button
              variant={teamFilter === "ready" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTeamFilter("ready")}
              className={cn(
                "h-8 text-xs",
                teamStats.readyToConfirmCount > 0 && "text-primary font-medium",
              )}
            >
              K potvrzení ({teamStats.readyToConfirmCount})
            </Button>
            <Button
              variant={teamFilter === "confirmed" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTeamFilter("confirmed")}
              className="h-8 text-xs"
            >
              Potvrzeno týmem ({teamStats.teamCheckedCount})
            </Button>
            <Button
              variant={teamFilter === "in_progress" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTeamFilter("in_progress")}
              className="h-8 text-xs"
            >
              Čeká na tým ({teamStats.inProgressCount})
            </Button>
            {teamStats.reconfirmationCount > 0 && (
              <Button
                variant={teamFilter === "reconfirm" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setTeamFilter("reconfirm")}
                className="h-8 text-xs text-warning-strong font-medium"
              >
                K novému potvrzení ({teamStats.reconfirmationCount})
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleAllCollapsed}
            className="h-8 text-xs text-muted-foreground self-start sm:self-auto"
          >
            {allCollapsed ? "Rozbalit vše" : "Sbalit vše"}
          </Button>
        </div>

        {/* Empty state when active filter yields 0 items across all categories */}
        {teamFilter !== "all" &&
          categories.every((cat) => {
            const matching = cat.items.filter((item) => {
              const checkers = checkedByItem.get(item.id) ?? new Set<string>()
              const unanimous = canCheckAsTeam(checkers.size, teamMembers.length)
              const teamCheck = teamChecksByItem.get(item.id)
              const teamChecked = teamCheck?.is_checked ?? false
              const reconfirm = needsReconfirmation(teamChecked, unanimous)
              if (teamFilter === "ready") return unanimous && !teamChecked
              if (teamFilter === "confirmed") return teamChecked
              if (teamFilter === "reconfirm") return reconfirm
              if (teamFilter === "in_progress") return !teamChecked && !unanimous
              return true
            })
            return matching.length === 0
          }) && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {teamFilter === "ready" && "Žádné položky momentálně nečekají na týmové potvrzení."}
              {teamFilter === "confirmed" && "Zatím nebyly týmem potvrzeny žádné položky."}
              {teamFilter === "reconfirm" && "Žádná položka nevyžaduje nové potvrzení."}
              {teamFilter === "in_progress" && "Všechny položky jsou již potvrzené nebo připravené."}
            </Card>
          )}

        {/* Categories in DB order — no hardcoded dimensions */}
        {categories.map((category) => {
          const filterItem = (item: RocketCategoryWithItems["items"][number]) => {
            if (teamFilter === "all") return true
            const checkers = checkedByItem.get(item.id) ?? new Set<string>()
            const unanimous = canCheckAsTeam(checkers.size, teamMembers.length)
            const teamCheck = teamChecksByItem.get(item.id)
            const teamChecked = teamCheck?.is_checked ?? false
            const reconfirm = needsReconfirmation(teamChecked, unanimous)

            if (teamFilter === "ready") return unanimous && !teamChecked
            if (teamFilter === "confirmed") return teamChecked
            if (teamFilter === "reconfirm") return reconfirm
            if (teamFilter === "in_progress") return !teamChecked && !unanimous
            return true
          }

          const filteredItems = category.items.filter(filterItem)

          if (teamFilter !== "all" && filteredItems.length === 0) {
            return null
          }

          const isCollapsed = collapsedCategories.has(category.id)
          const teamCheckedCount = category.items.filter(
            (item) => teamChecksByItem.get(item.id)?.is_checked,
          ).length
          const isCategoryComplete =
            teamCheckedCount === category.items.length && category.items.length > 0

          const lockedExists = category.items.some(
            (item) =>
              !canCheckAsTeam(
                checkedByItem.get(item.id)?.size ?? 0,
                teamMembers.length,
              ),
          )

          return (
            <section
              id={`category-${category.id}`}
              key={category.id}
              className="scroll-mt-24"
            >
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex min-w-0 items-start sm:items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleToggleCategory(category.id)}
                    aria-label={
                      isCollapsed
                        ? `Rozbalit ${category.title}`
                        : `Sbalit ${category.title}`
                    }
                    className="mt-0.5 sm:mt-0 size-6 shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform duration-200",
                        isCollapsed && "-rotate-90",
                      )}
                    />
                  </Button>
                  <h2
                    onClick={() => handleToggleCategory(category.id)}
                    className="font-heading text-base font-bold sm:text-lg cursor-pointer select-none leading-snug sm:leading-normal"
                  >
                    {category.title}
                  </h2>
                </div>
                <div className="flex shrink-0 items-center gap-2.5 sm:gap-3 pl-[30px] sm:pl-0">
                  {isCategoryComplete && (
                    <Badge
                      variant="secondary"
                      className="border-none bg-success/15 text-xs text-success-strong"
                    >
                      <Check className="mr-1 size-3" />
                      Splněno
                    </Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <Progress
                      value={coveragePercent(teamCheckedCount, category.items.length)}
                      className="h-1.5 w-20 sm:w-24"
                      indicatorClassName={isCategoryComplete ? "bg-success" : undefined}
                    />
                    <p className="shrink-0 text-xs sm:text-sm tabular-nums text-muted-foreground">
                      {teamCheckedCount} z {category.items.length} potvrzeno
                    </p>
                  </div>
                </div>
              </div>

              {lockedExists && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Lock className="mt-0.5 size-3.5 shrink-0" />
                  Odemkne se, až položku splní celý tým.
                </p>
              )}

              {!isCollapsed && (
                <div className="mt-2 space-y-1">
                  {filteredItems.map((item) => {
                            const checkers = checkedByItem.get(item.id) ?? new Set<string>()
                            const unanimous = canCheckAsTeam(checkers.size, teamMembers.length)
                            const teamCheck = teamChecksByItem.get(item.id)
                            const isTeamChecked = teamCheck?.is_checked ?? false
                            const reconfirm = needsReconfirmation(isTeamChecked, unanimous)
                            const isReadyToConfirm = unanimous && !isTeamChecked
                            const missing = getMissingMembers(teamMembers, checkers)

                            return (
                              <div
                                key={item.id}
                                role="group"
                                aria-label={item.text_cs}
                                className={cn(
                                  "flex items-start gap-3 rounded-md px-2.5 py-2 transition-colors",
                                  isReadyToConfirm && "bg-primary/[0.05]",
                                  reconfirm && "bg-warning/[0.05]",
                                  !isReadyToConfirm && !reconfirm && "hover:bg-muted/40",
                                )}
                              >
                                <Checkbox
                                  id={`team-${item.id}`}
                                  checked={isTeamChecked}
                                  disabled={!unanimous}
                                  onCheckedChange={(next) =>
                                    handleToggleTeamItem(item.id, next === true)
                                  }
                                  className="mt-0.5"
                                  aria-label={item.text_cs}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                    <Label
                                      htmlFor={`team-${item.id}`}
                                      className="cursor-pointer text-sm leading-relaxed font-normal"
                                    >
                                      {item.text_cs}
                                    </Label>
                                    {isReadyToConfirm && (
                                      <Badge
                                        variant="secondary"
                                        className="self-start shrink-0 border-none bg-primary/15 text-xs font-semibold text-primary"
                                      >
                                        Připraveno k potvrzení
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <Badge
                                      variant="secondary"
                                      className={cn(
                                        "border-none font-medium",
                                        unanimous
                                          ? "bg-success/15 text-success-strong"
                                          : missing.length <= 3
                                            ? "bg-warning/15 text-warning-strong"
                                            : "bg-muted text-muted-foreground",
                                      )}
                                    >
                                      {checkers.size}/{teamMembers.length}
                                    </Badge>

                                    {reconfirm && (
                                      <Badge
                                        variant="secondary"
                                        className="border-none bg-warning/15 text-warning-strong"
                                      >
                                        K novému potvrzení
                                      </Badge>
                                    )}

                                    {isTeamChecked && !reconfirm && (
                                      <Badge
                                        variant="secondary"
                                        className="border-none bg-success/15 text-success-strong"
                                      >
                                        Potvrzeno týmem
                                      </Badge>
                                    )}

                                    {unanimous ? (
                                      <span className="flex items-center gap-1 text-xs font-semibold text-success-strong">
                                        <Check className="size-3.5 stroke-[2.5]" />
                                        Celý tým splnil
                                      </span>
                                    ) : (
                                      <span
                                        className={cn(
                                          "text-xs",
                                          missing.length <= 3
                                            ? "font-medium text-warning-strong"
                                            : "text-muted-foreground",
                                        )}
                                      >
                                        {formatMissingMembers(missing)}
                                      </span>
                                    )}
                                  </div>

                                  {/* Avatar chips row for all team members */}
                                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    {teamMembers.map((member) => {
                                      const memberState = stateByItemMember.get(
                                        `${item.id}:${member.id}`,
                                      )
                                      const isChecked = memberState?.is_checked ?? false
                                      return (
                                        <Tooltip key={member.id}>
                                          <TooltipTrigger asChild>
                                            <span
                                              className={cn(
                                                "relative inline-flex rounded-full transition-all cursor-default select-none",
                                                isChecked
                                                  ? "ring-2 ring-success/80 opacity-100"
                                                  : "opacity-35 grayscale hover:opacity-75",
                                              )}
                                              tabIndex={0}
                                              aria-label={`${member.name ?? "Člen:ka týmu"}: ${isChecked ? "Splněno" : "Nesplněno"}`}
                                            >
                                              <ProfileAvatar
                                                picture={member.picture}
                                                name={member.name}
                                                size={24}
                                              />
                                              {isChecked && (
                                                <span className="absolute -bottom-0.5 -right-0.5 flex size-2.5 items-center justify-center rounded-full bg-success text-success-foreground ring-1 ring-background">
                                                  <Check className="size-1.5 stroke-[3]" />
                                                </span>
                                              )}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="font-medium">
                                              {member.name ?? "Neznámý:á"}
                                            </p>
                                            {isChecked && memberState ? (
                                              <p className="text-xs text-success-strong font-medium">
                                                Splněno{" "}
                                                {formatRocketDateTime(
                                                  new Date(memberState.updated_at),
                                                )}
                                              </p>
                                            ) : (
                                              <p className="text-xs text-muted-foreground">
                                                Zatím neoznačil:a
                                              </p>
                                            )}
                                          </TooltipContent>
                                        </Tooltip>
                                      )
                                    })}
                                  </div>

                                  <Collapsible>
                                    <CollapsibleTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="mt-1.5 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                      >
                                        Kdo a kdy
                                        <ChevronDown className="size-3.5" />
                                      </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <div className="mt-1.5 rounded-md border border-border/60 bg-muted/20 p-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                                          {teamMembers.map((member) => {
                                            const memberState = stateByItemMember.get(
                                              `${item.id}:${member.id}`,
                                            )
                                            const memberChecked =
                                              memberState?.is_checked ?? false
                                            return (
                                              <div
                                                key={member.id}
                                                className={cn(
                                                  "flex items-center gap-2 rounded px-1.5 py-1 text-xs transition-colors",
                                                  memberChecked
                                                    ? "bg-success/5"
                                                    : "text-muted-foreground/80",
                                                )}
                                              >
                                                <span
                                                  className={cn(
                                                    "relative inline-flex shrink-0 rounded-full",
                                                    memberChecked && "ring-1 ring-success/80",
                                                  )}
                                                >
                                                  <ProfileAvatar
                                                    picture={member.picture}
                                                    name={member.name}
                                                    size={20}
                                                  />
                                                  {memberChecked && (
                                                    <span className="absolute -bottom-0.5 -right-0.5 flex size-2 items-center justify-center rounded-full bg-success text-success-foreground">
                                                      <Check className="size-1.5 stroke-[3]" />
                                                    </span>
                                                  )}
                                                </span>
                                                <p className="flex-1 truncate font-medium text-foreground">
                                                  {member.name ?? "Neznámý:á"}
                                                </p>
                                                {memberChecked && memberState ? (
                                                  <p className="shrink-0 tabular-nums text-xs text-muted-foreground">
                                                    Splněno{" "}
                                                    {formatRocketDateTime(
                                                      new Date(memberState.updated_at),
                                                    )}
                                                  </p>
                                                ) : (
                                                  <p className="shrink-0 text-xs text-muted-foreground/60">
                                                    Nesplněno
                                                  </p>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                </div>
                              </div>
                            )
                          })}
                </div>
              )}
            </section>
          )
        })}
      </TabsContent>

      <RocketRadarDialog
        open={isRadarOpen}
        onOpenChange={setIsRadarOpen}
        categories={categories}
        teamMembers={teamMembers}
        states={states}
        teamChecks={teamChecks}
        onSelectCategory={handleJumpToCategory}
      />
    </Tabs>
  )
}
