"use client"

import { useMemo, useState } from "react"
import { Plus, UserCircle, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog"
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { IndividualCoachingSessionForm } from "./individual-coaching-session-form"
import { IndividualCoachingSessionCard } from "./individual-coaching-session-card"
import type { IndividualCoachingSessionWithCoach } from "@/lib/individual-coaching-sessions/types"
import type { Profile } from "@/lib/auth-helpers"

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function getMonthKey(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split("-")
  return `${MONTH_LABELS[Number(month) - 1]} ${year}`
}

function getCurrentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function monthKeyToDate(key: string): Date {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1)
}

function addMonths(key: string, n: number): string {
  const d = monthKeyToDate(key)
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

interface GroupedSessions {
  key: string
  label: string
  count: number
}

interface IndividualCoachingSessionListProps {
  sessions: IndividualCoachingSessionWithCoach[]
  profileId: string
  coachProfiles: Pick<Profile, "id" | "name" | "picture">[]
}

export function IndividualCoachingSessionList({ sessions, profileId, coachProfiles }: IndividualCoachingSessionListProps) {
  const [items, setItems] = useState(sessions)
  const [createOpen, setCreateOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const sessionMap = useMemo(() => {
    const map = new Map<string, IndividualCoachingSessionWithCoach[]>()
    const undated: IndividualCoachingSessionWithCoach[] = []
    let earliestKey = getCurrentMonthKey()
    for (const s of items) {
      const key = getMonthKey(s.session_at)
      if (!key) { undated.push(s); continue }
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
      if (key < earliestKey) earliestKey = key
    }
    return { map, earliestKey, undated }
  }, [items])

  const groups = useMemo(() => {
    const currentKey = getCurrentMonthKey()
    const result: GroupedSessions[] = []
    let cursor = sessionMap.earliestKey
    while (cursor <= currentKey) {
      result.push({
        key: cursor,
        label: getMonthLabel(cursor),
        count: sessionMap.map.get(cursor)?.length ?? 0,
      })
      cursor = addMonths(cursor, 1)
    }
    result.reverse()
    return result
  }, [sessionMap])

  function handleCreated(session: IndividualCoachingSessionWithCoach) {
    setItems((prev) => {
      const updated = [session, ...prev]
      updated.sort((a, b) => {
        if (!a.session_at) return 1
        if (!b.session_at) return -1
        return b.session_at.localeCompare(a.session_at)
      })
      return updated
    })
    setCreateOpen(false)
  }

  function handleSessionUpdated(session: IndividualCoachingSessionWithCoach) {
    setItems((prev) => prev.map((s) => (s.id === session.id ? session : s)))
  }

  function handleSessionDeleted(id: string) {
    setItems((prev) => prev.filter((s) => s.id !== id))
  }

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-end gap-4">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Nové sezení
            </Button>
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
      </div>

      {sessionMap.undated.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => toggleCollapse("__undated__")}
            className="flex w-full items-center gap-2 mb-2 sm:mb-3 group"
          >
            <Calendar className="size-4 shrink-0 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Bez data
            </h2>
            <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
              {sessionMap.undated.length}
            </Badge>
            <span className="ml-auto text-xs text-muted-foreground transition-transform group-hover:translate-y-0.5">
              {collapsed.has("__undated__") ? "rozbalit" : "skrýt"}
            </span>
          </button>
          {!collapsed.has("__undated__") && (
            <div className="space-y-2">
              {sessionMap.undated.map((session) => (
                <IndividualCoachingSessionCard
                  key={session.id}
                  session={session}
                  profileId={profileId}
                  coachProfiles={coachProfiles}
                  onUpdated={handleSessionUpdated}
                  onDeleted={handleSessionDeleted}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {items.length === 0 && sessionMap.undated.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <UserCircle className="size-6" />
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
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.key)
            const sessionsInMonth = sessionMap.map.get(group.key) ?? []

            return (
              <section key={group.key}>
                <button
                  type="button"
                  onClick={() => toggleCollapse(group.key)}
                  className="flex w-full items-center gap-2 mb-2 sm:mb-3 group"
                >
                  <Calendar className="size-4 shrink-0 text-muted-foreground" />
                  <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.label}
                  </h2>
                  <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                    {group.count}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground transition-transform group-hover:translate-y-0.5">
                    {isCollapsed ? "rozbalit" : "skrýt"}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-2">
                    {sessionsInMonth.length === 0 ? (
                      <p className="text-xs text-muted-foreground/40 italic px-1 py-3 text-center sm:text-left">
                        — tento měsíc žádné sezení
                      </p>
                    ) : (
                      sessionsInMonth.map((session) => (
                        <IndividualCoachingSessionCard
                          key={session.id}
                          session={session}
                          profileId={profileId}
                          coachProfiles={coachProfiles}
                          onUpdated={handleSessionUpdated}
                          onDeleted={handleSessionDeleted}
                        />
                      ))
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
