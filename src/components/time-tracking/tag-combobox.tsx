"use client"

import * as React from "react"
import Link from "next/link"
import { Check, ChevronsUpDown, Eye, Plus, Sparkles, Tag, X } from "lucide-react"
import { toast } from "sonner"

import {
  TAG_NAME_MAX_LENGTH,
  TAG_SETTINGS_URL,
  TIME_DIRECTION_LABELS,
  TIME_TRACKING_MESSAGES,
} from "@/lib/time-tracking/constants"
import { findTeamTagByName, hasTeamTags, isTagRequired, pickerTags } from "@/lib/time-tracking/tag-catalog"
import type { TagCatalog, TimeDirection, TimeTag } from "@/lib/time-tracking/types"
import { cn } from "@/lib/utils"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"

export const TAGS_ENDPOINT = "/api/time-tags"
export const TAGS_REVIEW_ENDPOINT = `${TAGS_ENDPOINT}/review`
const NO_TAG_LABEL = "Bez tagu"
const PICK_TAG_LABEL = "Vyber tag"
const PICK_DIRECTION_FIRST_LABEL = "Nejdřív vyber směr"
const NO_TAG_VALUE = "__no-tag__"
const CREATE_VALUE_PREFIX = "__create__"
const SHOW_VALUE_PREFIX = "__show__"
const NEW_TAG_FORMS: [string, string, string] = ["nový tag", "nové tagy", "nových tagů"]
const DRAFT_BADGE_LABEL = "nový"
const DRAFT_VALUE = "__draft__"

export function tagSelectionEndpoint(tagId: string): string {
  return `${TAGS_ENDPOINT}/${tagId}/selection`
}

/** „3 nové tagy" — short enough for the picker footer on a phone. */
export function newTagsLabel(count: number): string {
  return `${count} ${pluralizeCz(count, NEW_TAG_FORMS)}`
}

/**
 * What the picker holds: an existing tag, a draft name of a team tag that does not exist yet
 * (created only when the entry is saved, so typos never reach the team), or nothing.
 */
export interface TagSelection {
  tagId: string | null
  newTagName: string | null
}

export const NO_TAG_SELECTION: TagSelection = { tagId: null, newTagName: null }

export interface TagComboboxProps {
  value: TagSelection
  /**
   * Direction of the entry. Training / Reading offer their fixed tags (one is required);
   * Practise / Projekt offer the team tags the person shows; a typed new name stays a draft
   * (clicking away keeps it) until the entry is saved.
   * Without a direction the combobox is disabled (every tag belongs to one direction).
   */
  direction: TimeDirection | null
  onChange: (selection: TagSelection) => void
  /** Pre-loaded catalog (e.g. from the server); skips the fetch on first open. */
  initialCatalog?: TagCatalog
  id?: string
  disabled?: boolean
  className?: string
  "aria-invalid"?: boolean
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }
    if (typeof body.error === "string" && body.error !== "") return body.error
  } catch {
    // Non-JSON error body.
  }
  return TIME_TRACKING_MESSAGES.generic
}

export function TagCombobox({
  value,
  direction,
  onChange,
  initialCatalog,
  id,
  disabled = false,
  className,
  "aria-invalid": ariaInvalid,
}: TagComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [catalog, setCatalog] = React.useState<TagCatalog | null>(initialCatalog ?? null)
  const [isLoading, setIsLoading] = React.useState(false)

  const loadCatalog = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(TAGS_ENDPOINT, { cache: "no-store" })
      if (!response.ok) {
        toast.error(await readError(response))
        return
      }
      const body = (await response.json()) as { data: TagCatalog }
      setCatalog(body.data)
    } catch {
      toast.error(TIME_TRACKING_MESSAGES.generic)
    } finally {
      setIsLoading(false)
    }
  }, [])

  function handleOpenChange(next: boolean) {
    if (next) {
      // Reopening a draft lets the person fix its name.
      setQuery(value.newTagName ?? "")
      if (catalog === null && !isLoading) void loadCatalog()
    } else {
      commitTypedName()
      setQuery("")
    }
    setOpen(next)
  }

  function close() {
    setOpen(false)
    setQuery("")
  }

  function selectTag(tag: TimeTag | null) {
    onChange(tag === null ? NO_TAG_SELECTION : { tagId: tag.id, newTagName: null })
    close()
  }

  function selectDraft(name: string) {
    onChange({ tagId: null, newTagName: name })
    close()
  }

  /**
   * Clicking away with a typed name keeps it: an existing team tag of that name is picked,
   * anything else becomes a draft that is created only when the entry is saved.
   */
  function commitTypedName() {
    if (!canCreateTags || trimmedQuery === "") return
    if (matchingTeamTag === undefined) {
      if (trimmedQuery !== value.newTagName) onChange({ tagId: null, newTagName: trimmedQuery })
      return
    }
    onChange({ tagId: matchingTeamTag.id, newTagName: null })
    if (hiddenMatch !== undefined) void showTag(hiddenMatch, { closeAfter: false })
  }

  /** A hidden team tag with the typed name: show it instead of creating a duplicate. */
  async function showTag(tag: TimeTag, { closeAfter }: { closeAfter: boolean }) {
    if (closeAfter) selectTag(tag)
    setCatalog((current) =>
      current === null || current.selectedTagIds.includes(tag.id)
        ? current
        : { ...current, selectedTagIds: [...current.selectedTagIds, tag.id] },
    )
    try {
      const response = await fetch(tagSelectionEndpoint(tag.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected: true }),
      })
      if (!response.ok) toast.error(await readError(response))
    } catch {
      toast.error(TIME_TRACKING_MESSAGES.generic)
    }
  }

  async function ignoreNewTags() {
    // Optimistic: the notice disappears at once; it comes back on the next load if this fails.
    setCatalog((current) => (current === null ? current : { ...current, newTagCount: 0 }))
    try {
      const response = await fetch(TAGS_REVIEW_ENDPOINT, { method: "POST" })
      if (!response.ok) toast.error(await readError(response))
    } catch {
      toast.error(TIME_TRACKING_MESSAGES.generic)
    }
  }

  const allTags = catalog?.tags ?? []
  const selectedTagIds = new Set(catalog?.selectedTagIds ?? [])
  const selectedTag = value.tagId === null ? null : (allTags.find((tag) => tag.id === value.tagId) ?? null)
  const options =
    direction === null ? [] : pickerTags({ tags: allTags, selectedTagIds, direction, currentTagId: value.tagId })
  const required = direction !== null && isTagRequired(direction)
  const canCreateTags = direction !== null && hasTeamTags(direction)
  const trimmedQuery = query.trim().slice(0, TAG_NAME_MAX_LENGTH)
  const matchingTeamTag =
    canCreateTags && trimmedQuery !== "" ? findTeamTagByName(allTags, direction, trimmedQuery) : undefined
  const hiddenMatch = matchingTeamTag !== undefined && !options.includes(matchingTeamTag) ? matchingTeamTag : undefined
  const canCreate =
    canCreateTags && trimmedQuery !== "" && matchingTeamTag === undefined && trimmedQuery !== value.newTagName
  const newTagCount = canCreateTags ? (catalog?.newTagCount ?? 0) : 0
  const isDisabled = disabled || direction === null

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          disabled={isDisabled}
          className={cn("w-full justify-start gap-2 font-normal", className)}
        >
          <Tag className="size-4 text-muted-foreground" aria-hidden />
          {direction === null ? (
            <span className="text-muted-foreground">{PICK_DIRECTION_FIRST_LABEL}</span>
          ) : value.newTagName !== null ? (
            <>
              <span className="truncate">{value.newTagName}</span>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {DRAFT_BADGE_LABEL}
              </Badge>
            </>
          ) : selectedTag ? (
            <span className="truncate">{selectedTag.name}</span>
          ) : value.tagId !== null ? (
            <span className="text-muted-foreground">Vybraný tag</span>
          ) : (
            <span className="text-muted-foreground">{required ? PICK_TAG_LABEL : NO_TAG_LABEL}</span>
          )}
          <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <Command className="border-0 shadow-none">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={
              canCreateTags
                ? `Hledat nebo vytvořit tag pro ${direction ? TIME_DIRECTION_LABELS[direction] : "směr"}`
                : "Hledat tag"
            }
            aria-label={canCreateTags ? "Hledat nebo vytvořit tag" : "Hledat tag"}
            maxLength={TAG_NAME_MAX_LENGTH}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Spinner aria-label="Načítám tagy" />
                Načítám tagy
              </div>
            ) : (
              <>
                {!canCreate && hiddenMatch === undefined && <CommandEmpty>Žádný tag</CommandEmpty>}
                <CommandGroup>
                  {!required && (
                    <CommandItem value={NO_TAG_VALUE} keywords={[NO_TAG_LABEL]} onSelect={() => selectTag(null)}>
                      <X className="size-4 text-muted-foreground" aria-hidden />
                      <span className="flex-1">{NO_TAG_LABEL}</span>
                      {value.tagId === null && value.newTagName === null && (
                        <Check className="size-4 text-primary" aria-hidden />
                      )}
                    </CommandItem>
                  )}
                  {value.newTagName !== null && (
                    <CommandItem
                      value={DRAFT_VALUE}
                      keywords={[value.newTagName]}
                      onSelect={() => selectDraft(value.newTagName ?? "")}
                    >
                      <Plus className="size-4 text-muted-foreground" aria-hidden />
                      <span className="flex-1 truncate">{value.newTagName}</span>
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                        {DRAFT_BADGE_LABEL}
                      </Badge>
                      <Check className="size-4 text-primary" aria-hidden />
                    </CommandItem>
                  )}
                  {options.map((tag) => (
                    <CommandItem key={tag.id} value={tag.id} keywords={[tag.name]} onSelect={() => selectTag(tag)}>
                      <Tag className="size-4 text-muted-foreground" aria-hidden />
                      <span className="flex-1 truncate">{tag.name}</span>
                      {value.tagId === tag.id && <Check className="size-4 text-primary" aria-hidden />}
                    </CommandItem>
                  ))}
                  {hiddenMatch !== undefined && (
                    <CommandItem
                      forceMount
                      value={`${SHOW_VALUE_PREFIX}${hiddenMatch.id}`}
                      onSelect={() => void showTag(hiddenMatch, { closeAfter: true })}
                    >
                      <Eye className="size-4" aria-hidden />
                      <span className="truncate">Zobrazit tag týmu „{hiddenMatch.name}“</span>
                    </CommandItem>
                  )}
                  {canCreate && (
                    <CommandItem
                      forceMount
                      value={`${CREATE_VALUE_PREFIX}${trimmedQuery}`}
                      onSelect={() => selectDraft(trimmedQuery)}
                    >
                      <Plus className="size-4" aria-hidden />
                      <span className="truncate">Nový tag „{trimmedQuery}“</span>
                    </CommandItem>
                  )}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
        {newTagCount > 0 && (
          <div className="flex items-center gap-2 border-t px-3 py-2 text-sm">
            <Link
              href={TAG_SETTINGS_URL}
              className="flex min-w-0 flex-1 items-center gap-2 font-medium text-primary hover:underline focus-ring rounded-sm"
              onClick={() => setOpen(false)}
            >
              <Sparkles className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{newTagsLabel(newTagCount)}</span>
            </Link>
            <Button type="button" variant="ghost" size="xs" onClick={() => void ignoreNewTags()}>
              Ignorovat
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
