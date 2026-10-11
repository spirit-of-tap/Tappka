"use client"

import * as React from "react"
import { Tags } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Switch } from "@/components/ui/switch"
import { TAGS_REVIEW_ENDPOINT, tagSelectionEndpoint } from "@/components/time-tracking/tag-combobox"
import { SYSTEM_TAG_DIRECTIONS, TEAM_TAG_DIRECTIONS, TIME_DIRECTIONS, TIME_TRACKING_MESSAGES } from "@/lib/time-tracking/constants"
import { isSystemTag, listNewTeamTags } from "@/lib/time-tracking/tag-catalog"
import type { TimeTag } from "@/lib/time-tracking/types"
import { cn } from "@/lib/utils"

const NEW_BADGE_LABEL = "Nový"
const NO_TEAM_TAGS_MESSAGE = "Tým zatím nemá žádný tag. Založíš ho při zapisování času."

export interface TimeTagSettingsProps {
  tags: TimeTag[]
  selectedTagIds: string[]
  /** Previous review; tags created after it are marked „Nový" during this visit. */
  reviewedAt: string | null
  newTagCount: number
  profileId: string
  hasTeam: boolean
}

const TEAM_SECTIONS = TIME_DIRECTIONS.filter((direction) => TEAM_TAG_DIRECTIONS.includes(direction.value))
const SYSTEM_SECTIONS = TIME_DIRECTIONS.filter((direction) => SYSTEM_TAG_DIRECTIONS.includes(direction.value))

export function TimeTagSettings({
  tags,
  selectedTagIds,
  reviewedAt,
  newTagCount,
  profileId,
  hasTeam,
}: TimeTagSettingsProps) {
  const [selected, setSelected] = React.useState(() => new Set(selectedTagIds))
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(() => new Set())
  const [newTagIds] = React.useState(
    () =>
      new Set(
        listNewTeamTags({ tags, selectedTagIds: new Set(selectedTagIds), reviewedAt, profileId }).map((tag) => tag.id),
      ),
  )

  // Opening the settings counts as seeing the team's tags: the picker stops announcing them.
  const shouldMarkReviewed = newTagCount > 0 || reviewedAt === null
  React.useEffect(() => {
    if (!shouldMarkReviewed) return
    void fetch(TAGS_REVIEW_ENDPOINT, { method: "POST" }).catch(() => {
      // Not critical: the notice simply shows again next time.
    })
  }, [shouldMarkReviewed])

  async function toggle(tag: TimeTag, next: boolean) {
    setPendingIds((current) => new Set(current).add(tag.id))
    setSelected((current) => {
      const updated = new Set(current)
      if (next) updated.add(tag.id)
      else updated.delete(tag.id)
      return updated
    })
    try {
      const response = await fetch(tagSelectionEndpoint(tag.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected: next }),
      })
      if (!response.ok) throw new Error(String(response.status))
    } catch {
      setSelected((current) => {
        const reverted = new Set(current)
        if (next) reverted.delete(tag.id)
        else reverted.add(tag.id)
        return reverted
      })
      toast.error(TIME_TRACKING_MESSAGES.generic)
    } finally {
      setPendingIds((current) => {
        const updated = new Set(current)
        updated.delete(tag.id)
        return updated
      })
    }
  }

  return (
    <div className="space-y-6">
      {hasTeam ? (
        TEAM_SECTIONS.map((direction) => {
          // New tags first so they are easy to spot, then by name.
          const directionTags = tags
            .filter((tag) => !isSystemTag(tag) && tag.direction === direction.value)
            .sort((a, b) => Number(newTagIds.has(b.id)) - Number(newTagIds.has(a.id)))
          return (
            <section key={direction.value} className="space-y-2" aria-labelledby={`tags-${direction.value}`}>
              <h2 id={`tags-${direction.value}`} className="flex items-center gap-2 text-sm font-semibold">
                <span aria-hidden className={cn("size-2 rounded-full", direction.dotClass)} />
                {direction.label}
              </h2>
              {directionTags.length === 0 ? (
                <p className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
                  {NO_TEAM_TAGS_MESSAGE}
                </p>
              ) : (
                <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                  {directionTags.map((tag) => {
                    const switchId = `tag-switch-${tag.id}`
                    return (
                      <li key={tag.id} className="flex items-center gap-3 px-4 py-3">
                        <label htmlFor={switchId} className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                          <span className="truncate">{tag.name}</span>
                          {newTagIds.has(tag.id) && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                              {NEW_BADGE_LABEL}
                            </Badge>
                          )}
                        </label>
                        <Switch
                          id={switchId}
                          checked={selected.has(tag.id)}
                          disabled={pendingIds.has(tag.id)}
                          onCheckedChange={(checked) => void toggle(tag, checked)}
                        />
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })
      ) : (
        <Empty>
          <EmptyMedia variant="icon">
            <Tags className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Nejsi v žádném týmu</EmptyTitle>
            <EmptyDescription>Týmové tagy pro Practise a Projekt uvidíš, až budeš v týmu.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <section className="space-y-2" aria-labelledby="tags-fixed">
        <h2 id="tags-fixed" className="text-sm font-semibold">
          Training a Reading
        </h2>
        <div className="space-y-3 rounded-xl border bg-card px-4 py-3">
          {SYSTEM_SECTIONS.map((direction) => (
            <div key={direction.value} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex w-20 items-center gap-2 text-muted-foreground">
                <span aria-hidden className={cn("size-2 rounded-full", direction.dotClass)} />
                {direction.label}
              </span>
              {tags
                .filter((tag) => isSystemTag(tag) && tag.direction === direction.value)
                .map((tag) => (
                  <Badge key={tag.id} variant="outline">
                    {tag.name}
                  </Badge>
                ))}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Tyhle tagy jsou pevně dané a nabízejí se vždycky.</p>
        </div>
      </section>
    </div>
  )
}
