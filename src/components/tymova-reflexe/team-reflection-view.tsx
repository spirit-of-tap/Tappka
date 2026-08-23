"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Plus,
  CalendarDays,
  Search,
  Award,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog"
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { MobileFab, MobileFabSpacer } from "@/components/mobile-fab"
import { PageHeader } from "@/components/ui/page-header"
import { HelpDialog } from "@/components/help-dialog"
import { TeamReflectionCard } from "./team-reflection-card"
import { RocnikovaReflectionCard } from "./rocnikova-reflection-card"
import { TeamReflectionCalendar } from "./team-reflection-calendar"
import { InfoCard } from "./info-card"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"
import { isRocnikovaMonth } from "@/lib/tymova-reflexe/month-grid"
import type { TeamReflectionWithCreator } from "@/lib/tymova-reflexe/types"
import type { TeamSemesterReflectionSummary } from "@/lib/tymova-reflexe/semester-types"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

function getCurrentMonthLabel(): string {
  const now = new Date()
  return `${MONTH_LABELS[now.getMonth()]} ${now.getFullYear()}`
}

function getMayMonth(): string {
  const now = new Date()
  const year = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear()
  return `${year}-05-01`
}

type CombinedItem =
  | { kind: "monthly"; date: string; reflection: TeamReflectionWithCreator }
  | { kind: "rocnikova"; date: string; reflection: TeamSemesterReflectionSummary }

type FilterTab = "all" | "monthly" | "rocnikova"

interface TeamReflectionViewProps {
  reflections: TeamReflectionWithCreator[]
  rocnikovaReflections: TeamSemesterReflectionSummary[]
  teamMembers?: TeamMemberProfile[]
  onboardingYear: number | null
}

export function TeamReflectionView({
  reflections,
  rocnikovaReflections,
  teamMembers = [],
  onboardingYear,
}: TeamReflectionViewProps) {
  const [monthlyItems, setMonthlyItems] = useState(reflections)
  const [rocnikovaItems, setRocnikovaItems] = useState(rocnikovaReflections)
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [filterTab, setFilterTab] = useState<FilterTab>("all")

  const currentMonth = getCurrentMonth()
  const isMay = isRocnikovaMonth(currentMonth)

  const hasCurrentMonthly = monthlyItems.some((r) => r.month === currentMonth)
  const hasCurrentRocnikova = rocnikovaItems.some((r) => r.reflection_month === getMayMonth())

  function handleMonthlyDeleted(id: string) {
    setMonthlyItems((prev) => prev.filter((r) => r.id !== id))
  }

  function handleRocnikovaDeleted(id: string) {
    setRocnikovaItems((prev) => prev.filter((r) => r.id !== id))
  }

  const combined: CombinedItem[] = useMemo(() => {
    const items: CombinedItem[] = [
      ...monthlyItems.map((reflection) => ({
        kind: "monthly" as const,
        date: reflection.month,
        reflection,
      })),
      ...rocnikovaItems.map((reflection) => ({
        kind: "rocnikova" as const,
        date: reflection.reflection_month,
        reflection,
      })),
    ]
    return items.sort((a, b) => b.date.localeCompare(a.date))
  }, [monthlyItems, rocnikovaItems])

  const searching = query.trim().length > 0
  const normalizedQuery = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    return combined.filter((item) => {
      if (filterTab === "monthly" && item.kind !== "monthly") return false
      if (filterTab === "rocnikova" && item.kind !== "rocnikova") return false

      if (!searching) return true

      if (item.kind === "monthly") {
        const textToMatch = [
          item.reflection.what_went_well,
          item.reflection.what_we_do_differently,
          item.reflection.planned_action_steps,
          item.reflection.responsible_person,
          item.reflection.created_by?.name,
          item.date,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        return textToMatch.includes(normalizedQuery)
      } else {
        const textToMatch = [
          "ročníková reflexe",
          item.date,
          item.reflection.created_by?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        return textToMatch.includes(normalizedQuery)
      }
    })
  }, [combined, filterTab, searching, normalizedQuery])

  const totalCount = monthlyItems.length + rocnikovaItems.length

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <PageHeader
          title="Týmová reflexe"
          description="Pravidelné ohlédnutí za týmovou spoluprací a rozvojem"
          count={{
            value: totalCount,
            label: pluralizeCz(totalCount, ["reflexe", "reflexe", "reflexí"]),
          }}
          action={
            <div className="flex items-center gap-2">
              <HelpDialog question="Co je týmová reflexe?">
                <InfoCard />
              </HelpDialog>
              <DialogTrigger asChild>
                <Button size="sm" className="hidden sm:inline-flex">
                  <Plus className="size-4" />
                  Nová reflexe
                </Button>
              </DialogTrigger>
            </div>
          }
        />

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Založit týmovou reflexi</DialogTitle>
            <DialogDescription>
              Vyberte typ reflexe, kterou chcete pro tým vytvořit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <Link
              href={`/tymova-reflexe/nova?month=${currentMonth}`}
              onClick={() => setCreateOpen(false)}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3.5 hover:bg-accent/40 transition-colors"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Calendar className="size-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Měsíční reflexe</span>
                  {hasCurrentMonthly && (
                    <span className="text-[11px] text-muted-foreground">(již existuje)</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pravidelné měsíční zhodnocení za {getCurrentMonthLabel()}
                </p>
              </div>
            </Link>

            <Link
              href={`/tymova-reflexe/rocnikova/nova?month=${getMayMonth()}`}
              onClick={() => setCreateOpen(false)}
              className="flex items-start gap-3 rounded-lg border border-chart-5/40 bg-chart-5/5 p-3.5 hover:bg-chart-5/10 transition-colors"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-chart-5/20 text-chart-5">
                <Award className="size-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Ročníková reflexe</span>
                  {hasCurrentRocnikova && (
                    <span className="text-[11px] text-muted-foreground">(již existuje)</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Závěrečné ročníkové ohlédnutí za 11 oblastmi týmu a komunity (Květen)
                </p>
              </div>
            </Link>
          </div>
        </DialogContent>

        <DialogTrigger asChild>
          <MobileFab label="Nová reflexe" />
        </DialogTrigger>
      </Dialog>

      {/* 3-Year Roadmap Calendar */}
      <TeamReflectionCalendar
        monthlyReflections={monthlyItems.map((r) => ({ id: r.id, month: r.month }))}
        rocnikovaReflections={rocnikovaItems.map((r) => ({ id: r.id, month: r.reflection_month }))}
        currentMonth={currentMonth}
        onboardingYear={onboardingYear}
      />

      {/* Search & Filter bar */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search
            aria-hidden
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat v reflexích, akčních krocích…"
            className="pl-9 pr-8 h-9 text-sm"
          />
          {searching && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              Vymazat
            </button>
          )}
        </div>

        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filtrovat podle typu reflexe"
        >
          <Badge
            variant={filterTab === "all" ? "default" : "outline"}
            className={cn(
              "cursor-pointer select-none text-xs py-1 px-3 transition-colors font-medium",
              filterTab === "all"
                ? "hover:bg-primary/90"
                : "hover:bg-accent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setFilterTab("all")}
          >
            Vše ({combined.length})
          </Badge>
          <Badge
            variant={filterTab === "monthly" ? "default" : "outline"}
            className={cn(
              "cursor-pointer select-none text-xs py-1 px-3 transition-colors font-medium",
              filterTab === "monthly"
                ? "hover:bg-primary/90"
                : "hover:bg-accent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setFilterTab("monthly")}
          >
            Měsíční ({monthlyItems.length})
          </Badge>
          <Badge
            variant={filterTab === "rocnikova" ? "default" : "outline"}
            className={cn(
              "cursor-pointer select-none text-xs py-1 px-3 transition-colors font-medium",
              filterTab === "rocnikova"
                ? "hover:bg-primary/90"
                : "hover:bg-accent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setFilterTab("rocnikova")}
          >
            Ročníkové ({rocnikovaItems.length})
          </Badge>
        </div>
      </div>

      {/* Feed of reflections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Historie reflexí</h2>
        </div>

        {filtered.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <CalendarDays className="size-6" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>
                {searching ? "Žádné odpovídající reflexe" : "Zatím žádné reflexe"}
              </EmptyTitle>
              <EmptyDescription>
                {searching
                  ? "Zadanému hledání neodpovídá žádný záznam."
                  : "Zatím nemáte vytvořenou žádnou reflexi. Můžete začít kliknutím na aktuální měsíc v kalendáři výše."}
              </EmptyDescription>
            </EmptyHeader>
            {!searching && (
              <EmptyContent>
                <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" />
                  Přidat první reflexi
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) =>
              item.kind === "monthly" ? (
                <TeamReflectionCard
                  key={`monthly-${item.reflection.id}`}
                  reflection={item.reflection}
                  onDeleted={handleMonthlyDeleted}
                />
              ) : (
                <RocnikovaReflectionCard
                  key={`rocnikova-${item.reflection.id}`}
                  reflection={item.reflection}
                  onDeleted={handleRocnikovaDeleted}
                />
              ),
            )}
          </div>
        )}
      </div>

      <MobileFabSpacer />
    </div>
  )
}
