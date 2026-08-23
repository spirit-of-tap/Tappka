"use client"

import { useMemo, useState } from "react"
import { Plus, Search } from "lucide-react"
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
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { PageHeader } from "@/components/ui/page-header"
import { MonthSection } from "@/components/ui/month-section"
import { SemesterSeparator } from "@/components/ui/semester-separator"
import { MetricProgress } from "@/components/metrics/metric-progress"
import { HelpDialog } from "@/components/help-dialog"
import { MobileFab, MobileFabSpacer } from "@/components/mobile-fab"
import { InfoCard } from "./info-card"
import { CustomerMeetingRow } from "./customer-meeting-row"
import { CustomerMeetingForm } from "./customer-meeting-form"
import { groupByMonth } from "@/lib/timeline/group-by-month"
import { getSemesterInfo } from "@/lib/timeline/semester-utils"
import { getCurrentSemesterRange } from "@/lib/metrics/periods"
import { getMetric } from "@/lib/metrics/config"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"
import type { CustomerMeeting } from "@/lib/customer-meetings/types"

const SEARCH_PLACEHOLDER = "Hledat osobu nebo firmu…"
const CUSTOMER_MEETINGS_METRIC = getMetric("customer-meetings")

interface CustomerMeetingsViewProps {
  meetings: CustomerMeeting[]
  profileId: string
  /** Injectable for tests. */
  now?: Date
  onboardingYear?: number | null
}

function matchesSearch(meeting: CustomerMeeting, normalizedQuery: string): boolean {
  const haystack = [meeting.contact_person, meeting.company, meeting.objective, meeting.post_mortem]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return haystack.includes(normalizedQuery)
}

function sortByMeetingAtDesc(meetings: CustomerMeeting[]): CustomerMeeting[] {
  return [...meetings].sort((a, b) => {
    if (!a.meeting_at) return 1
    if (!b.meeting_at) return -1
    return b.meeting_at.localeCompare(a.meeting_at)
  })
}

export function CustomerMeetingsView({
  meetings,
  profileId,
  now = new Date(),
  onboardingYear,
}: CustomerMeetingsViewProps) {
  const [items, setItems] = useState(meetings)
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState("")

  const searching = query.trim().length > 0
  const normalizedQuery = query.trim().toLowerCase()

  const visible = useMemo(
    () => (searching ? items.filter((m) => matchesSearch(m, normalizedQuery)) : items),
    [items, searching, normalizedQuery],
  )

  const { groups, undated } = useMemo(
    () => groupByMonth(visible, { getDate: (m) => m.meeting_at, now }),
    [visible, now],
  )

  const semesterCount = useMemo(() => {
    const { start, end } = getCurrentSemesterRange(now)
    return items.filter((m) => {
      if (!m.meeting_at) return false
      const at = new Date(m.meeting_at)
      return at >= start && at < end
    }).length
  }, [items, now])

  function handleCreated(meeting: CustomerMeeting) {
    setItems((prev) => sortByMeetingAtDesc([meeting, ...prev]))
    setCreateOpen(false)
  }

  const hasAny = items.length > 0

  return (
    <>
      {/* One shared create-dialog: desktop opens from the header button,
          mobile from the thumb-reachable floating action button below. */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <PageHeader
          title="Zákaznické schůzky"
          description="Záznamník schůzek s lidmi z praxe"
          count={{
            value: items.length,
            label: pluralizeCz(items.length, ["schůzka", "schůzky", "schůzek"]),
          }}
          action={
            <div className="flex items-center gap-2">
              <HelpDialog question="Co jsou zákaznické schůzky?">
                <InfoCard />
              </HelpDialog>
              <DialogTrigger asChild>
                <Button size="sm" className="hidden sm:inline-flex">
                  <Plus className="size-4" />
                  Nová
                </Button>
              </DialogTrigger>
            </div>
          }
        />

      {!searching && hasAny && (
        <MetricProgress
          goals={[
            {
              current: semesterCount,
              target: CUSTOMER_MEETINGS_METRIC.target ?? 0,
              label: "tento semestr",
            },
            {
              current: items.length,
              target: CUSTOMER_MEETINGS_METRIC.totalForStudy ?? 0,
              label: "za studium",
            },
          ]}
        />
      )}

      {hasAny && (
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

      {!hasAny ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Plus className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Žádné schůzky</EmptyTitle>
            <EmptyDescription>
              Zatím nemáš žádné záznamy. Přidej svou první schůzku.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Přidat schůzku
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
            <EmptyDescription>
              Pro „{query.trim()}“ nejsou žádné výsledky. Zkus hledat podle osoby nebo firmy.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {undated.length > 0 && (
            <MonthSection label="Bez data" count={undated.length}>
              {undated.map((meeting) => (
                <CustomerMeetingRow key={meeting.id} meeting={meeting} showUndatedChip={false} />
              ))}
            </MonthSection>
          )}
          {groups
            .filter((g) => g.items.length > 0)
            .map((group, idx, activeGroups) => {
              const semesterInfo = getSemesterInfo(group.key, onboardingYear)
              const prevSemesterInfo =
                idx > 0 ? getSemesterInfo(activeGroups[idx - 1].key, onboardingYear) : null
              const isNewSemester = !prevSemesterInfo || prevSemesterInfo.key !== semesterInfo?.key

              return (
                <div key={group.key} className="space-y-4">
                  {isNewSemester && semesterInfo && (
                    <SemesterSeparator
                      label={semesterInfo.label}
                      semester={semesterInfo.semester}
                      className={idx === 0 && undated.length === 0 ? "mt-1 mb-4" : "mt-8 mb-4"}
                    />
                  )}
                  <MonthSection label={group.label} count={group.items.length}>
                    {group.items.map((meeting) => (
                      <CustomerMeetingRow key={meeting.id} meeting={meeting} />
                    ))}
                  </MonthSection>
                </div>
              )
            })}
        </div>
      )}

      {/* Mobile FAB — second trigger of the shared dialog. Sits just above
          MobileBottomNav; extended variant with a visible label like every
          other module. */}
      <DialogTrigger asChild>
        <MobileFab label="Nová schůzka" />
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nová zákaznická schůzka</DialogTitle>
        </DialogHeader>
        <CustomerMeetingForm
          profileId={profileId}
          onSuccess={handleCreated}
          onCancel={() => setCreateOpen(false)}
        />
      </DialogContent>
      </Dialog>
      <MobileFabSpacer />
    </>
  )
}
