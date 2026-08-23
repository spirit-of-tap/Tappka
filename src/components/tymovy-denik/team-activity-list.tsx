"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Plus,
  CalendarDays,
  Search,
  List,
  LayoutGrid,
  ChevronRight,
  Sparkles,
  Lightbulb,
  Target,
} from "lucide-react"
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
import { SemesterSeparator } from "@/components/ui/semester-separator"
import { PageHeader } from "@/components/ui/page-header"
import { HelpDialog } from "@/components/help-dialog"
import { TeamActivityForm } from "./team-activity-form"
import { TeamActivityThumb } from "./team-activity-thumb"
import { TeamActivityImage } from "./team-activity-image"
import { InfoCard } from "./info-card"
import { getTeamActivityLoop, LOOP_LABELS } from "@/lib/tymovy-denik/status"
import { groupByMonth } from "@/lib/timeline/group-by-month"
import { getSemesterInfo } from "@/lib/timeline/semester-utils"
import { formatShortDate } from "@/lib/tymovy-denik/format-date"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"
import { cn } from "@/lib/utils"
import type { TeamActivityWithCreator, TeamMemberProfile, AttendanceStatus } from "@/lib/tymovy-denik/types"

const SEARCH_PLACEHOLDER = "Hledat akci, účastníky nebo obsah…"

type ViewMode = "timeline" | "grid"

interface TeamActivityListProps {
  activities: TeamActivityWithCreator[]
  teamMembers?: TeamMemberProfile[]
  onboardingYear?: number | null
}

export function TeamActivityList({
  activities,
  teamMembers = [],
  onboardingYear,
}: TeamActivityListProps) {
  const [items, setItems] = useState(activities)
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("timeline")

  const searching = query.trim().length > 0
  const normalizedQuery = query.trim().toLowerCase()

  // Filtered dataset (text search)
  const filtered = useMemo(() => {
    if (!searching) return items
    return items.filter((a) => {
      const attendeeNames = a.attendees
        ?.map((att) => att.profile?.name)
        .filter(Boolean)
        .join(" ") ?? ""
      const textToMatch = [a.activity_type, a.participants, a.reason, a.reflection, attendeeNames]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return textToMatch.includes(normalizedQuery)
    })
  }, [items, searching, normalizedQuery])

  const { groups } = useMemo(
    () => groupByMonth(filtered, { getDate: (a) => a.occurred_at }),
    [filtered],
  )

  const prioritizedPhotoId = filtered[0]?.image_path ? filtered[0].id : undefined

  function handleCreated(activity: TeamActivityWithCreator) {
    setItems((prev) =>
      [...prev, activity].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    )
    setCreateOpen(false)
  }

  const hasAny = items.length > 0

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Shared create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <PageHeader
          title="Týmový deník"
          description="Chronologický záznam týmových akcí mimo pracovní prostředí"
          count={{
            value: items.length,
            label: pluralizeCz(items.length, ["akce", "akce", "akcí"]),
          }}
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nová týmová akce</DialogTitle>
          </DialogHeader>
          <TeamActivityForm
            teamMembers={teamMembers}
            onSuccess={handleCreated}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
        {/* Mobile FAB */}
        <DialogTrigger asChild>
          <MobileFab label="Nová akce" />
        </DialogTrigger>
      </Dialog>

      {hasAny && (
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={SEARCH_PLACEHOLDER}
              className="pl-9 pr-8"
              aria-label={SEARCH_PLACEHOLDER}
            />
            {searching && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              title="Zobrazit jako časovou osu"
              className={cn(
                "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-all",
                viewMode === "timeline" && "bg-background text-foreground shadow-xs",
              )}
              aria-label="Časová osa"
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Zobrazit jako fotoalbum"
              className={cn(
                "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-all",
                viewMode === "grid" && "bg-background text-foreground shadow-xs",
              )}
              aria-label="Mřížka"
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main content display */}
      {!hasAny ? (
        <Empty>
          <EmptyMedia variant="icon">
            <CalendarDays className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Žádné akce</EmptyTitle>
            <EmptyDescription>
              Zatím není v deníku žádný záznam. Přidejte první společnou akci týmu.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Přidat akci
            </Button>
          </EmptyContent>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Search className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Nic jsme nenašli</EmptyTitle>
            <EmptyDescription>
              Pro „{query.trim()}“ nebyly nalezeny žádné záznamy.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuery("")}
            >
              Zrušit hledání
            </Button>
          </EmptyContent>
        </Empty>
      ) : viewMode === "grid" ? (
        /* Photo Grid / Album View */
        <div className="space-y-6 sm:space-y-8">
          {groups
            .filter((g) => g.items.length > 0)
            .map((group, idx, activeGroups) => {
              const semesterInfo = getSemesterInfo(group.key, onboardingYear)
              const prevSemesterInfo =
                idx > 0 ? getSemesterInfo(activeGroups[idx - 1].key, onboardingYear) : null
              const isNewSemester =
                !prevSemesterInfo || prevSemesterInfo.key !== semesterInfo?.key

              return (
                <div key={group.key} className="space-y-3">
                  {isNewSemester && semesterInfo && (
                    <SemesterSeparator
                      label={semesterInfo.label}
                      semester={semesterInfo.semester}
                      className={idx === 0 ? "mt-1 mb-4" : "mt-8 mb-4"}
                    />
                  )}
                  <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                    <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.label}
                    </h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
                      {group.items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((activity) => (
                      <ActivityGridCard
                        key={activity.id}
                        activity={activity}
                        teamMembers={teamMembers}
                        prioritizePhoto={activity.id === prioritizedPhotoId}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
        </div>
      ) : (
        /* High-density Smart Timeline Rows View */
        <div className="space-y-4 sm:space-y-6">
          {groups
            .filter((g) => g.items.length > 0)
            .map((group, idx, activeGroups) => {
              const semesterInfo = getSemesterInfo(group.key, onboardingYear)
              const prevSemesterInfo =
                idx > 0 ? getSemesterInfo(activeGroups[idx - 1].key, onboardingYear) : null
              const isNewSemester =
                !prevSemesterInfo || prevSemesterInfo.key !== semesterInfo?.key

              return (
                <div key={group.key} className="space-y-4">
                  {isNewSemester && semesterInfo && (
                    <SemesterSeparator
                      label={semesterInfo.label}
                      semester={semesterInfo.semester}
                      className={idx === 0 ? "mt-1 mb-4" : "mt-8 mb-4"}
                    />
                  )}
                  <MonthSection label={group.label} count={group.items.length}>
                    <div className="divide-y divide-border/40 rounded-xl border border-border/60 bg-card overflow-hidden">
                      {group.items.map((activity) => (
                        <ActivitySmartRow
                          key={activity.id}
                          activity={activity}
                          teamMembers={teamMembers}
                          prioritizePhoto={activity.id === prioritizedPhotoId}
                        />
                      ))}
                    </div>
                  </MonthSection>
                </div>
              )
            })}
        </div>
      )}

      <MobileFabSpacer />
    </div>
  )
}

interface AttendanceMiniBarProps {
  present: number
  excused?: number
  absent?: number
  total: number
  showBreakdown?: boolean
  className?: string
}

function AttendanceMiniBar({
  present,
  excused = 0,
  absent = 0,
  total,
  showBreakdown = true,
  className,
}: AttendanceMiniBarProps) {
  if (total <= 0) return null

  const presentPct = Math.round((present / total) * 100)
  const excusedPct = Math.round((excused / total) * 100)
  const absentPct = Math.max(0, 100 - presentPct - excusedPct)

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs select-none", className)}>
      {/* Segmented visual mini bar */}
      <div
        className="flex h-1.5 w-16 sm:w-24 overflow-hidden rounded-full bg-muted/80 shrink-0"
        title={`Účast: ${presentPct} % (${present}/${total})`}
      >
        {presentPct > 0 && (
          <div
            style={{ width: `${presentPct}%` }}
            className="bg-success shrink-0 transition-all"
          />
        )}
        {excusedPct > 0 && (
          <div
            style={{ width: `${excusedPct}%` }}
            className="bg-warning shrink-0 transition-all"
          />
        )}
        {absentPct > 0 && (
          <div
            style={{ width: `${absentPct}%` }}
            className="bg-muted-foreground/25 dark:bg-muted-foreground/35 shrink-0 transition-all"
          />
        )}
      </div>

      {/* Numerical percentage & count */}
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="font-semibold text-foreground tabular-nums">
          {presentPct} %
        </span>
        <span className="text-muted-foreground tabular-nums text-[11px]">
          ({present}/{total})
        </span>
      </div>

      {/* Contextual breakdown on larger screens */}
      {showBreakdown && (absent > 0 || excused > 0) && (
        <span className="hidden sm:inline text-muted-foreground/75 text-[11px] truncate">
          {absent > 0 && `· ${absent} neúčast`}
          {excused > 0 && ` · ${excused} omluveno`}
        </span>
      )}
    </div>
  )
}

/**
 * Unified Media-Rich Smart Row for timeline listings.
 * Clean, scannable format whether an entry has a photo or not.
 */
function ActivitySmartRow({
  activity,
  teamMembers = [],
  prioritizePhoto,
}: {
  activity: TeamActivityWithCreator
  teamMembers?: TeamMemberProfile[]
  prioritizePhoto: boolean
}) {
  const loop = getTeamActivityLoop(activity)

  const attendeeStatusMap = new Map<string, AttendanceStatus>(
    activity.attendees?.map((a) => [a.profile_id, a.status]) ?? [],
  )

  const allKnownMembers: TeamMemberProfile[] = [...teamMembers]
  for (const att of activity.attendees ?? []) {
    if (att.profile && !allKnownMembers.some((m) => m.id === att.profile_id)) {
      allKnownMembers.push(att.profile)
    }
  }

  const hasRecordedAttendees = (activity.attendees?.length ?? 0) > 0
  const presentAttendees = hasRecordedAttendees
    ? allKnownMembers.filter((m) => attendeeStatusMap.get(m.id) === "present")
    : []
  const absentAttendees = hasRecordedAttendees
    ? allKnownMembers.filter((m) => {
        const st = attendeeStatusMap.get(m.id)
        return st === "absent" || st === undefined
      })
    : []
  const excusedAttendees = hasRecordedAttendees
    ? allKnownMembers.filter((m) => attendeeStatusMap.get(m.id) === "excused")
    : []

  return (
    <Link
      href={`/tymovy-denik/${activity.id}`}
      className="focus-ring group flex items-start gap-3.5 p-3 sm:p-4 transition-colors hover:bg-accent/40"
    >
      {/* Visual media anchor / thumb */}
      {activity.image_path ? (
        <div className="relative aspect-[4/3] w-20 sm:w-24 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted">
          <TeamActivityImage
            imagePath={activity.image_path}
            variant="card"
            priority={prioritizePhoto}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="grid size-12 sm:size-14 shrink-0 place-items-center rounded-lg border border-border/50 bg-muted/60 text-muted-foreground">
          <Sparkles className="size-5 sm:size-6 text-muted-foreground/60 transition-transform group-hover:scale-110" />
        </div>
      )}

      {/* Main content body */}
      <div className="min-w-0 flex-1 space-y-1">
        {/* Top line: Title, Loop badge, Date pill */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-heading font-semibold text-foreground text-sm sm:text-base group-hover:text-primary transition-colors">
            {activity.activity_type}
          </span>
          {loop && (
            <Badge
              variant="outline"
              className="border-transparent bg-warning/10 text-warning-strong text-[11px] py-0 px-2"
            >
              {LOOP_LABELS[loop]}
            </Badge>
          )}
          <span className="ml-auto shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground font-medium">
            {formatShortDate(activity.occurred_at)}
          </span>
        </div>

        {/* Second line: Attendance visual percentage and trend */}
        <div>
          {hasRecordedAttendees && allKnownMembers.length > 0 ? (
            <AttendanceMiniBar
              present={presentAttendees.length}
              excused={excusedAttendees.length}
              absent={absentAttendees.length}
              total={allKnownMembers.length}
              showBreakdown
            />
          ) : (
            <span className="text-xs text-muted-foreground/60 italic">Účast nebyla specifikována</span>
          )}
        </div>

        {/* Third line: Reflection or Purpose snippet for instant context */}
        {activity.reflection ? (
          <p className="line-clamp-1 flex items-center gap-1.5 text-xs text-muted-foreground/90">
            <Lightbulb className="size-3.5 shrink-0 text-amber-500/80" />
            <span className="truncate italic">„{activity.reflection}“</span>
          </p>
        ) : activity.reason ? (
          <p className="line-clamp-1 flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <Target className="size-3.5 shrink-0 text-muted-foreground/50" />
            <span className="truncate">{activity.reason}</span>
          </p>
        ) : null}
      </div>

      {/* Right chevron indicator */}
      <ChevronRight className="hidden sm:block size-4 self-center text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  )
}

/**
 * Visual Photo Card for Photo Album / Grid View.
 */
function ActivityGridCard({
  activity,
  teamMembers = [],
  prioritizePhoto,
}: {
  activity: TeamActivityWithCreator
  teamMembers?: TeamMemberProfile[]
  prioritizePhoto: boolean
}) {
  const loop = getTeamActivityLoop(activity)

  const attendeeStatusMap = new Map<string, AttendanceStatus>(
    activity.attendees?.map((a) => [a.profile_id, a.status]) ?? [],
  )

  const allKnownMembers: TeamMemberProfile[] = [...teamMembers]
  for (const att of activity.attendees ?? []) {
    if (att.profile && !allKnownMembers.some((m) => m.id === att.profile_id)) {
      allKnownMembers.push(att.profile)
    }
  }

  const hasRecordedAttendees = (activity.attendees?.length ?? 0) > 0
  const presentAttendees = hasRecordedAttendees
    ? allKnownMembers.filter((m) => attendeeStatusMap.get(m.id) === "present")
    : []
  const absentAttendees = hasRecordedAttendees
    ? allKnownMembers.filter((m) => {
        const st = attendeeStatusMap.get(m.id)
        return st === "absent" || st === undefined
      })
    : []
  const excusedAttendees = hasRecordedAttendees
    ? allKnownMembers.filter((m) => attendeeStatusMap.get(m.id) === "excused")
    : []

  return (
    <Link
      href={`/tymovy-denik/${activity.id}`}
      className="focus-ring group flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-all hover:border-border hover:shadow-sm"
    >
      {/* Card cover image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/60">
        {activity.image_path ? (
          <TeamActivityImage
            imagePath={activity.image_path}
            variant="card"
            priority={prioritizePhoto}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-radial from-muted/60 to-muted/20">
            <TeamActivityThumb activityType={activity.activity_type} size={56} />
          </div>
        )}

        {/* Date pill overlay */}
        <div className="absolute right-2.5 top-2.5 rounded-md bg-black/65 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-xs">
          {formatShortDate(activity.occurred_at)}
        </div>

        {loop && (
          <Badge
            variant="outline"
            className="absolute left-2.5 top-2.5 border-transparent bg-warning/90 text-warning-strong text-[10px] font-semibold backdrop-blur-xs"
          >
            {LOOP_LABELS[loop]}
          </Badge>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col justify-between p-3.5 space-y-2">
        <div className="space-y-1">
          <h4 className="font-heading font-semibold text-foreground text-sm line-clamp-1 group-hover:text-primary transition-colors">
            {activity.activity_type}
          </h4>

          {activity.reflection ? (
            <p className="line-clamp-2 text-xs text-muted-foreground italic">
              „{activity.reflection}“
            </p>
          ) : activity.reason ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {activity.reason}
            </p>
          ) : null}
        </div>

        {/* Footer with attendance visual trend & percentage */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs text-muted-foreground">
          {hasRecordedAttendees && allKnownMembers.length > 0 ? (
            <AttendanceMiniBar
              present={presentAttendees.length}
              excused={excusedAttendees.length}
              absent={absentAttendees.length}
              total={allKnownMembers.length}
              showBreakdown={false}
            />
          ) : (
            <span className="text-[11px] text-muted-foreground/60">—</span>
          )}

          <span className="text-[11px] text-primary font-medium group-hover:underline">
            Detail →
          </span>
        </div>
      </div>
    </Link>
  )
}
