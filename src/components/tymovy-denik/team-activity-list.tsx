"use client"

import { useMemo, useState } from "react"
import { Plus, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { TeamActivityForm } from "./team-activity-form"
import { TeamActivityCard } from "./team-activity-card"
import { getActivityMonthKey, getActivityMonthLabel } from "@/lib/tymovy-denik/format"
import type { TeamActivityWithCreator } from "@/lib/tymovy-denik/types"

interface TeamActivityListProps {
  activities: TeamActivityWithCreator[]
  teamId: string
  profileId: string
}

export function TeamActivityList({ activities, teamId, profileId }: TeamActivityListProps) {
  const [items, setItems] = useState(activities)
  const [createOpen, setCreateOpen] = useState(false)

  const grouped = useMemo(() => {
    const map = new Map<string, TeamActivityWithCreator[]>()
    for (const activity of items) {
      const key = getActivityMonthKey(activity.occurred_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(activity)
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, group]) => ({ key, label: getActivityMonthLabel(key), activities: group }))
  }, [items])

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
      <div className="flex items-center justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="hidden sm:inline-flex">
              <Plus className="size-4" />
              Nová akce
            </Button>
          </DialogTrigger>
          {/* Mobile FAB — second trigger of the shared dialog. */}
          <DialogTrigger asChild>
            <MobileFab label="Nová týmová akce" />
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
      </div>

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
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="size-4" />
                  Přidat akci
                </Button>
              </DialogTrigger>
            </Dialog>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.key} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label} · {group.activities.length}
              </h2>
              <div className="space-y-4">
                {group.activities.map((activity) => (
                  <TeamActivityCard
                    key={activity.id}
                    activity={activity}
                    teamId={teamId}
                    profileId={profileId}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <MobileFabSpacer />
    </div>
  )
}
