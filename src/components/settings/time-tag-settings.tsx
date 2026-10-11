"use client"

import * as React from "react"
import { Check, Pencil, Tags, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { TAGS_ENDPOINT, TAGS_REVIEW_ENDPOINT, tagSelectionEndpoint } from "@/components/time-tracking/tag-combobox"
import {
  SYSTEM_TAG_DIRECTIONS,
  TAG_NAME_MAX_LENGTH,
  TEAM_TAG_DIRECTIONS,
  TIME_DIRECTIONS,
  TIME_TRACKING_MESSAGES,
} from "@/lib/time-tracking/constants"
import { isSystemTag, listNewTeamTags } from "@/lib/time-tracking/tag-catalog"
import type { TimeTag } from "@/lib/time-tracking/types"
import { cn } from "@/lib/utils"

const NEW_BADGE_LABEL = "Nový"
const NO_TEAM_TAGS_MESSAGE = "Tým zatím nemá žádný tag. Založíš ho při zapisování času."
const TAG_RENAMED_MESSAGE = "Tag přejmenován"

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === "string" && body.error !== "") return body.error
  } catch {
    // Non-JSON error body.
  }
  return TIME_TRACKING_MESSAGES.generic
}

export interface TimeTagSettingsProps {
  tags: TimeTag[]
  selectedTagIds: string[]
  /** Previous review; tags created after it are marked „Nový" during this visit. */
  reviewedAt: string | null
  newTagCount: number
  profileId: string
  hasTeam: boolean
  /** Coaches and admins may rename any team tag; others only the tags they created (RLS). */
  canRenameAnyTag?: boolean
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
  canRenameAnyTag = false,
}: TimeTagSettingsProps) {
  const [names, setNames] = React.useState<ReadonlyMap<string, string>>(() => new Map())
  const [editing, setEditing] = React.useState<{ id: string; draft: string } | null>(null)
  const [isRenaming, setIsRenaming] = React.useState(false)
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

  function canRename(tag: TimeTag): boolean {
    return canRenameAnyTag || tag.created_by_profile_id === profileId
  }

  async function saveRename() {
    if (editing === null || isRenaming) return
    const name = editing.draft.trim()
    const tag = tags.find((candidate) => candidate.id === editing.id)
    if (!tag || name === "" || name === (names.get(tag.id) ?? tag.name)) {
      setEditing(null)
      return
    }
    setIsRenaming(true)
    try {
      const response = await fetch(`${TAGS_ENDPOINT}/${tag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) {
        toast.error(await readError(response))
        return
      }
      setNames((current) => new Map(current).set(tag.id, name))
      setEditing(null)
      toast.success(TAG_RENAMED_MESSAGE)
    } catch {
      toast.error(TIME_TRACKING_MESSAGES.generic)
    } finally {
      setIsRenaming(false)
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
                      <li key={tag.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                        {editing?.id === tag.id ? (
                          <form
                            className="flex min-w-0 flex-1 items-center gap-1"
                            onSubmit={(event) => {
                              event.preventDefault()
                              void saveRename()
                            }}
                          >
                            <Input
                              autoFocus
                              value={editing.draft}
                              maxLength={TAG_NAME_MAX_LENGTH}
                              aria-label={`Nový název tagu ${tag.name}`}
                              onChange={(event) => setEditing({ id: tag.id, draft: event.target.value })}
                              onKeyDown={(event) => {
                                if (event.key === "Escape") setEditing(null)
                              }}
                              className="h-8"
                            />
                            <Button type="submit" variant="ghost" size="icon-sm" disabled={isRenaming} aria-label="Uložit název">
                              <Check aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setEditing(null)}
                              aria-label="Zrušit přejmenování"
                            >
                              <X aria-hidden />
                            </Button>
                          </form>
                        ) : (
                          <>
                            <label htmlFor={switchId} className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                              <span className="truncate">{names.get(tag.id) ?? tag.name}</span>
                              {newTagIds.has(tag.id) && (
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                  {NEW_BADGE_LABEL}
                                </Badge>
                              )}
                            </label>
                            {canRename(tag) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setEditing({ id: tag.id, draft: names.get(tag.id) ?? tag.name })}
                                aria-label={`Přejmenovat tag ${names.get(tag.id) ?? tag.name}`}
                              >
                                <Pencil aria-hidden />
                              </Button>
                            )}
                          </>
                        )}
                        <Switch
                          id={switchId}
                          checked={selected.has(tag.id)}
                          disabled={pendingIds.has(tag.id)}
                          onCheckedChange={(checked) => void toggle(tag, checked)}
                          aria-label={editing?.id === tag.id ? `Zobrazit tag ${tag.name}` : undefined}
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
