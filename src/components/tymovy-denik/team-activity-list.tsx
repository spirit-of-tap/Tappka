"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus, CalendarDays, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
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
import { MobileFab, MobileFabSpacer } from "@/components/mobile-fab"
import { MonthSection } from "@/components/ui/month-section"
import { TeamActivityForm } from "./team-activity-form"
import { TeamActivityThumb } from "./team-activity-thumb"
import { getTeamActivityLoop, LOOP_LABELS } from "@/lib/tymovy-denik/status"
import { groupByMonth } from "@/lib/timeline/group-by-month"
import { formatShortDate } from "@/lib/tymovy-denik/format-date"
import type { TeamActivityWithCreator } from "@/lib/tymovy-denik/types"

const SEARCH_PLACEHOLDER = "Hledat akci nebo obsah…"

interface TeamActivityListProps {
  activities: TeamActivityWithCreator[]
  teamId: string
  profileId: string
}

export function TeamActivityList({ activities, teamId, profileId }: TeamActivityListProps) {
  const [items, setItems] = useState(activities)
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState("")

  const searching = query.trim().length > 0
  const normalizedQuery = query.trim().toLowerCase()

  const visible = useMemo(
    () =>
      searching
        ? items.filter((a) =>
            [a.activity_type, a.participants, a.reason, a.reflection]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(normalizedQuery),
          )
        : items,
    [items, searching, normalizedQuery],
  )

  const { groups } = useMemo(
    () => groupByMonth(visible, { getDate: (a) => a.occurred_at }),
    [visible],
  )

  function handleCreated(activity: TeamActivityWithCreator) {
    setItems((prev) =>
      [...prev, activity].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    )
    setCreateOpen(false)
  }

  function handleUpdated(activity: TeamActivityWithCreator) {
    setItems((prev) =>
      prev
        .map((a) => (a.id === activity.id ? activity : a))
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    )
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* One shared create-dialog: desktop opens from the header button,
          mobile from the thumb-reachable floating action button below. */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="hidden sm:inline-flex">
            <Plus className="size-4" />
            Nová akce
          </Button>
        </DialogTrigger>
        {/* Mobile FAB — second trigger of the shared dialog. */}
        <DialogTrigger asChild>
          <MobileFab label="Nová akce" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nová týmová akce</DialogTitle>
          </DialogHeader>
          <TeamActivityForm
            teamId={teamId}
            profileId={profileId}
            onSuccess={handleCreated}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {items.length > 0 && (
        <div className="relative">
          <Search
            aria-hidden
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={SEARCH_PLACEHOLDER}
            className="pl-9"
            aria-label={SEARCH_PLACEHOLDER}
          />
        </div>
      )}

      {items.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <CalendarDays className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Žádné akce</EmptyTitle>
            <EmptyDescription>
              Zatím není v deníku žádný záznam. Přidejte první společnou akci.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Přidat akci
            </Button>
          </EmptyContent>
        </Empty>
      ) : visible.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Search className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Nic jsme nenašli</EmptyTitle>
            <EmptyDescription>Pro „{query.trim()}“ nejsou žádné výsledky.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <MonthSection key={group.key} label={group.label} count={group.items.length}>
                {group.items.map((activity) => (
                  <ActivityRowLink key={activity.id} activity={activity} />
                ))}
              </MonthSection>
            ),
          )}
        </div>
      )}
      <MobileFabSpacer />
    </div>
  )
}

function ActivityRowLink({ activity }: { activity: TeamActivityWithCreator }) {
  const loop = getTeamActivityLoop(activity)

  return (
    <Link
      href={`/tymovy-denik/${activity.id}`}
      className="focus-ring flex items-center gap-3 rounded-lg py-2 pr-1 transition-colors hover:bg-accent/50"
    >
      <TeamActivityThumb imagePath={activity.image_path} activityType={activity.activity_type} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{activity.activity_type}</span>
      {loop && (
        <Badge variant="outline" className="shrink-0 border-transparent bg-warning/10 text-warning-strong">
          {LOOP_LABELS[loop]}
        </Badge>
      )}
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
        {formatShortDate(activity.occurred_at)}
      </span>
    </Link>
  )
}
