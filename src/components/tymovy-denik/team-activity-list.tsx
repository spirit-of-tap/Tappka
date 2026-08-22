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
import { PageHeader } from "@/components/ui/page-header"
import { HelpDialog } from "@/components/help-dialog"
import { TeamActivityForm } from "./team-activity-form"
import { TeamActivityThumb } from "./team-activity-thumb"
import { TeamActivityImage } from "./team-activity-image"
import { InfoCard } from "./info-card"
import { getTeamActivityLoop, LOOP_LABELS } from "@/lib/tymovy-denik/status"
import { groupByMonth } from "@/lib/timeline/group-by-month"
import { formatShortDate } from "@/lib/tymovy-denik/format-date"
import type { TeamActivityWithCreator } from "@/lib/tymovy-denik/types"

const SEARCH_PLACEHOLDER = "Hledat akci nebo obsah…"

interface TeamActivityListProps {
  activities: TeamActivityWithCreator[]
}

export function TeamActivityList({ activities }: TeamActivityListProps) {
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
  const prioritizedPhotoId = visible[0]?.image_path ? visible[0].id : undefined

  function handleCreated(activity: TeamActivityWithCreator) {
    setItems((prev) =>
      [...prev, activity].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    )
    setCreateOpen(false)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* One shared create-dialog: desktop opens from the header button,
          mobile from the thumb-reachable floating action button below. */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <PageHeader
          title="Týmový deník"
          description="Chronologický záznam týmových akcí mimo pracovní prostředí"
          count={{ value: items.length, label: "akcí" }}
          action={
            <div className="flex items-center gap-2">
              <HelpDialog question="Co je týmový deník?">
                <InfoCard />
              </HelpDialog>
              <DialogTrigger asChild>
                <Button size="sm" className="hidden sm:inline-flex">
                  <Plus className="size-4" />
                  Nová akce
                </Button>
              </DialogTrigger>
            </div>
          }
        />
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nová týmová akce</DialogTitle>
          </DialogHeader>
          <TeamActivityForm
            onSuccess={handleCreated}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
        {/* Mobile FAB — second trigger of the shared dialog. */}
        <DialogTrigger asChild>
          <MobileFab label="Nová akce" />
        </DialogTrigger>
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
                  <ActivityRowLink
                    key={activity.id}
                    activity={activity}
                    prioritizePhoto={activity.id === prioritizedPhotoId}
                  />
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

function ActivityRowLink({
  activity,
  prioritizePhoto,
}: {
  activity: TeamActivityWithCreator
  prioritizePhoto: boolean
}) {
  const loop = getTeamActivityLoop(activity)

  // Photo-led entries get a cinematic card (the photo is the identity);
  // photo-less entries stay as compact initials rows so the timeline keeps
  // its rhythm instead of turning into a wall of empty placeholders.
  if (activity.image_path) {
    return (
      <Link
        href={`/tymovy-denik/${activity.id}`}
        className="focus-ring group block overflow-hidden rounded-xl border border-border/50 bg-card transition-colors hover:bg-accent/30"
      >
        <div className="aspect-[3/2] overflow-hidden sm:aspect-[16/6]">
          <TeamActivityImage
            imagePath={activity.image_path}
            variant="card"
            priority={prioritizePhoto}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{activity.activity_type}</span>
          {loop && (
            <Badge variant="outline" className="shrink-0 border-transparent bg-warning/10 text-warning-strong">
              {LOOP_LABELS[loop]}
            </Badge>
          )}
          <DatePill dateStr={activity.occurred_at} />
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={`/tymovy-denik/${activity.id}`}
      className="focus-ring flex items-center gap-3 rounded-lg py-2 pr-1 transition-colors hover:bg-accent/50"
    >
      <TeamActivityThumb activityType={activity.activity_type} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{activity.activity_type}</span>
      {loop && (
        <Badge variant="outline" className="shrink-0 border-transparent bg-warning/10 text-warning-strong">
          {LOOP_LABELS[loop]}
        </Badge>
      )}
      <DatePill dateStr={activity.occurred_at} />
    </Link>
  )
}

function DatePill({ dateStr }: { dateStr: string }) {
  return (
    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
      {formatShortDate(dateStr)}
    </span>
  )
}
