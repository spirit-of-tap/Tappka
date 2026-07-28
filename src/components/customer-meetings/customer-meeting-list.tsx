"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Building2, UserCircle, Calendar, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog"
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { CustomerMeetingForm } from "./customer-meeting-form"
import type { CustomerMeeting } from "@/lib/customer-meetings/types"

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

interface GroupedMeetings {
  key: string
  label: string
  count: number
}

interface CustomerMeetingListProps {
  meetings: CustomerMeeting[]
  profileId: string
}

export function CustomerMeetingList({ meetings, profileId }: CustomerMeetingListProps) {
  const [items, setItems] = useState(meetings)
  const [createOpen, setCreateOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const countByKey = new Map<string, number>()
    let earliestKey = getCurrentMonthKey()
    for (const m of meetings) {
      const key = getMonthKey(m.meeting_at)
      if (!key) continue
      countByKey.set(key, (countByKey.get(key) ?? 0) + 1)
      if (key < earliestKey) earliestKey = key
    }
    const currentKey = getCurrentMonthKey()
    const emptyKeys = new Set<string>()
    let cursor = earliestKey
    while (cursor <= currentKey) {
      if (!countByKey.has(cursor)) emptyKeys.add(cursor)
      cursor = addMonths(cursor, 1)
    }
    return emptyKeys
  })

  const meetingMap = useMemo(() => {
    const map = new Map<string, CustomerMeeting[]>()
    const undated: CustomerMeeting[] = []
    let earliestKey = getCurrentMonthKey()
    for (const m of items) {
      const key = getMonthKey(m.meeting_at)
      if (!key) { undated.push(m); continue }
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
      if (key < earliestKey) earliestKey = key
    }
    return { map, earliestKey, undated }
  }, [items])

  const groups = useMemo(() => {
    const currentKey = getCurrentMonthKey()
    const result: GroupedMeetings[] = []
    let cursor = meetingMap.earliestKey
    while (cursor <= currentKey) {
      result.push({
        key: cursor,
        label: getMonthLabel(cursor),
        count: meetingMap.map.get(cursor)?.length ?? 0,
      })
      cursor = addMonths(cursor, 1)
    }
    result.reverse()
    return result
  }, [meetingMap])

  function handleCreated(meeting: CustomerMeeting) {
    setItems((prev) => {
      const updated = [meeting, ...prev]
      updated.sort((a, b) => {
        if (!a.meeting_at) return 1
        if (!b.meeting_at) return -1
        return b.meeting_at.localeCompare(a.meeting_at)
      })
      return updated
    })
    setCreateOpen(false)
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
              Nová schůzka
            </Button>
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
      </div>

      {/* Undated meetings */}
      {meetingMap.undated.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => toggleCollapse("__undated__")}
            className="flex w-full items-center gap-2 mb-2 sm:mb-3 group"
            aria-expanded={!collapsed.has("__undated__")}
            aria-controls="month-__undated__-content"
          >
            <Calendar className="size-4 shrink-0 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Bez data
            </h2>
            <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
              {meetingMap.undated.length}
            </Badge>
            <ChevronDown
              className={`ml-auto size-4 text-muted-foreground transition-transform ${
                collapsed.has("__undated__") ? "-rotate-90" : "rotate-0"
              }`}
            />
          </button>
          {!collapsed.has("__undated__") && (
            <div id="month-__undated__-content" className="space-y-2">
              {meetingMap.undated.map((meeting) => (
                <Link key={meeting.id} href={`/schuzky/${meeting.id}`} className="block focus-ring rounded-xl">
                  <Card className="p-3 sm:p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Building2 className="size-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium text-sm truncate">
                            {meeting.company}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <UserCircle className="size-3" />
                            {meeting.contact_person}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground/80 line-clamp-2">
                          {meeting.objective}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {items.length === 0 && meetingMap.undated.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Building2 className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Žádné schůzky</EmptyTitle>
            <EmptyDescription>
              Zatím nemáš žádné záznamy. Přidej svou první schůzku.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="size-4" />
                  Přidat schůzku
                </Button>
              </DialogTrigger>
            </Dialog>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.key)
            const meetingsInMonth = meetingMap.map.get(group.key) ?? []

            return (
              <section key={group.key}>
                <button
                  type="button"
                  onClick={() => toggleCollapse(group.key)}
                  className="flex w-full items-center gap-2 mb-2 sm:mb-3 group"
                  aria-expanded={!isCollapsed}
                  aria-controls={`month-${group.key}-content`}
                >
                  <Calendar className="size-4 shrink-0 text-muted-foreground" />
                  <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.label}
                  </h2>
                  <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                    {group.count}
                  </Badge>
                  <ChevronDown
                    className={`ml-auto size-4 text-muted-foreground transition-transform ${
                      isCollapsed ? "-rotate-90" : "rotate-0"
                    }`}
                  />
                </button>

                {!isCollapsed && (
                  <div id={`month-${group.key}-content`} className="space-y-2">
                    {meetingsInMonth.length === 0 ? (
                      <p className="text-xs text-muted-foreground/70 px-1 py-3 text-center sm:text-left">
                        — tento měsíc žádná schůzka
                      </p>
                    ) : (
                      meetingsInMonth.map((meeting) => (
                        <Link key={meeting.id} href={`/schuzky/${meeting.id}`} className="block focus-ring rounded-xl">
                          <Card className="p-3 sm:p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <Building2 className="size-4 shrink-0 text-muted-foreground" />
                                  <span className="font-medium text-sm truncate">
                                    {meeting.company}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <UserCircle className="size-3" />
                                    {meeting.contact_person}
                                  </span>
                                  {meeting.meeting_at && (
                                    <span className="flex items-center gap-1 whitespace-nowrap">
                                      {new Date(meeting.meeting_at).toLocaleDateString("cs-CZ", {
                                        day: "numeric",
                                        month: "short",
                                      })}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground/80 line-clamp-2">
                                  {meeting.objective}
                                </p>
                              </div>
                            </div>
                          </Card>
                        </Link>
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
