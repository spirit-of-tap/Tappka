"use client"

import { useMemo, useState } from "react"
import { Plus, Search, UserRound } from "lucide-react"
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
import { IndividualCoachingSessionRow } from "./individual-coaching-session-row"
import { IndividualCoachingSessionForm } from "./individual-coaching-session-form"
import { groupByMonth } from "@/lib/timeline/group-by-month"
import { getSemesterInfo } from "@/lib/timeline/semester-utils"
import { getCurrentSemesterRange } from "@/lib/metrics/periods"
import { getMetric } from "@/lib/metrics/config"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"
import type { IndividualCoachingSessionWithCoach } from "@/lib/individual-coaching-sessions/types"
import type { Profile } from "@/lib/auth-helpers"

const SEARCH_PLACEHOLDER = "Hledat kouče nebo obsah…"
const INDIVIDUAL_COACHING_METRIC = getMetric("individual-coaching")

interface IndividualCoachingSessionsViewProps {
  sessions: IndividualCoachingSessionWithCoach[]
  profileId: string
  coachProfiles: Pick<Profile, "id" | "name" | "picture">[]
  /** Injectable for tests. */
  now?: Date
  onboardingYear?: number | null
}

function matchesSearch(
  session: IndividualCoachingSessionWithCoach,
  normalizedQuery: string,
): boolean {
  const haystack = [
    session.coach?.name,
    session.external_coach_name,
    session.key_takeaways,
    session.action_steps,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return haystack.includes(normalizedQuery)
}

function sortBySessionAtDesc(
  sessions: IndividualCoachingSessionWithCoach[],
): IndividualCoachingSessionWithCoach[] {
  return [...sessions].sort((a, b) => {
    if (!a.session_at) return 1
    if (!b.session_at) return -1
    return b.session_at.localeCompare(a.session_at)
  })
}

export function IndividualCoachingSessionsView({
  sessions,
  profileId,
  coachProfiles,
  now = new Date(),
  onboardingYear,
}: IndividualCoachingSessionsViewProps) {
  const [items, setItems] = useState(sessions)
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState("")

  const searching = query.trim().length > 0
  const normalizedQuery = query.trim().toLowerCase()

  const visible = useMemo(
    () => (searching ? items.filter((s) => matchesSearch(s, normalizedQuery)) : items),
    [items, searching, normalizedQuery],
  )

  const { groups, undated } = useMemo(
    () => groupByMonth(visible, { getDate: (s) => s.session_at, now }),
    [visible, now],
  )

  const semesterCount = useMemo(() => {
    const { start, end } = getCurrentSemesterRange(now)
    return items.filter((s) => {
      if (!s.session_at) return false
      const at = new Date(s.session_at)
      return at >= start && at < end
    }).length
  }, [items, now])

  function handleCreated(session: IndividualCoachingSessionWithCoach) {
    setItems((prev) => sortBySessionAtDesc([session, ...prev]))
    setCreateOpen(false)
  }

  function handleUpdated(session: IndividualCoachingSessionWithCoach) {
    setItems((prev) => prev.map((s) => (s.id === session.id ? session : s)))
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((s) => s.id !== id))
  }

  const hasAny = items.length > 0

  return (
    <>
      {/* One shared create-dialog: desktop opens from the header button,
          mobile from the thumb-reachable floating action button below. */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <PageHeader
          title="Individuální koučování"
          description="Záznamník koučovacích sezení s týmovým:ou koučem:kou"
          count={{
            value: items.length,
            label: pluralizeCz(items.length, ["sezení", "sezení", "sezení"]),
          }}
          action={
            <div className="flex items-center gap-2">
              <HelpDialog question="Co je individuální koučování?">
                <InfoCard />
              </HelpDialog>
              <DialogTrigger asChild>
                <Button size="sm" className="hidden sm:inline-flex">
                  <Plus className="size-4" />
                  Nové
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
                target: INDIVIDUAL_COACHING_METRIC.target ?? 0,
                label: "tento semestr",
              },
              {
                current: items.length,
                target: INDIVIDUAL_COACHING_METRIC.totalForStudy ?? 0,
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
              <UserRound className="size-6" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>Žádná sezení</EmptyTitle>
              <EmptyDescription>
                Zatím nemáš žádné záznamy. Přidej své první koučovací sezení.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Přidat sezení
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
                Pro „{query.trim()}“ nejsou žádné výsledky. Zkus hledat podle kouče nebo obsahu.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {undated.length > 0 && (
              <MonthSection label="Bez data" count={undated.length}>
                {undated.map((session) => (
                  <IndividualCoachingSessionRow
                    key={session.id}
                    session={session}
                    profileId={profileId}
                    coachProfiles={coachProfiles}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                  />
                ))}
              </MonthSection>
            )}
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
                        className={idx === 0 && undated.length === 0 ? "mt-1 mb-4" : "mt-8 mb-4"}
                      />
                    )}
                    <MonthSection label={group.label} count={group.items.length}>
                      {group.items.map((session) => (
                        <IndividualCoachingSessionRow
                          key={session.id}
                          session={session}
                          profileId={profileId}
                          coachProfiles={coachProfiles}
                          onUpdated={handleUpdated}
                          onDeleted={handleDeleted}
                        />
                      ))}
                    </MonthSection>
                  </div>
                )
              })}
          </div>
        )}

        {/* Mobile FAB — second trigger of the shared dialog. */}
        <DialogTrigger asChild>
          <MobileFab label="Nové sezení" />
        </DialogTrigger>

        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nové koučovací sezení</DialogTitle>
          </DialogHeader>
          <IndividualCoachingSessionForm
            profileId={profileId}
            coachProfiles={coachProfiles}
            onSuccess={handleCreated}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
      <MobileFabSpacer />
    </>
  )
}
