"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus, Tag, X } from "lucide-react"
import { toast } from "sonner"

import { TAG_NAME_MAX_LENGTH, TIME_TRACKING_MESSAGES } from "@/lib/time-tracking/constants"
import type { TimeTag } from "@/lib/time-tracking/types"
import { cn } from "@/lib/utils"
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

const TAGS_ENDPOINT = "/api/time-tags"
const NO_TAG_LABEL = "Bez tagu"
const NO_TAG_VALUE = "__no-tag__"
const CREATE_VALUE_PREFIX = "__create__"

export interface TagComboboxProps {
  value: string | null
  onChange: (tagId: string | null, tag?: TimeTag) => void
  /** Pre-loaded tags (e.g. from the server); skips the fetch on first open. */
  initialTags?: TimeTag[]
  id?: string
  disabled?: boolean
  className?: string
  "aria-invalid"?: boolean
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("cs")
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
  onChange,
  initialTags,
  id,
  disabled = false,
  className,
  "aria-invalid": ariaInvalid,
}: TagComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [tags, setTags] = React.useState<TimeTag[] | null>(initialTags ?? null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)

  const loadTags = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(TAGS_ENDPOINT, { cache: "no-store" })
      if (!response.ok) {
        toast.error(await readError(response))
        return
      }
      const body = (await response.json()) as { data: TimeTag[] }
      setTags(body.data ?? [])
    } catch {
      toast.error(TIME_TRACKING_MESSAGES.generic)
    } finally {
      setIsLoading(false)
    }
  }, [])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    setQuery("")
    if (next && tags === null && !isLoading) void loadTags()
  }

  function select(tagId: string | null, tag?: TimeTag) {
    onChange(tagId, tag)
    setOpen(false)
    setQuery("")
  }

  async function createTag(name: string) {
    setIsCreating(true)
    try {
      const response = await fetch(TAGS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) {
        toast.error(await readError(response))
        return
      }
      const body = (await response.json()) as { data: TimeTag }
      setTags((current) =>
        [...(current ?? []), body.data].sort((a, b) => a.name.localeCompare(b.name, "cs")),
      )
      select(body.data.id, body.data)
    } catch {
      toast.error(TIME_TRACKING_MESSAGES.generic)
    } finally {
      setIsCreating(false)
    }
  }

  const selectedTag = value === null ? null : (tags?.find((tag) => tag.id === value) ?? null)
  const trimmedQuery = query.trim().slice(0, TAG_NAME_MAX_LENGTH)
  const canCreate =
    trimmedQuery !== "" && !(tags ?? []).some((tag) => normalize(tag.name) === normalize(trimmedQuery))

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
          disabled={disabled}
          className={cn("w-full justify-start gap-2 font-normal", className)}
        >
          <Tag className="size-4 text-muted-foreground" aria-hidden />
          {selectedTag ? (
            <span className="truncate">{selectedTag.name}</span>
          ) : value !== null ? (
            <span className="text-muted-foreground">Vybraný tag</span>
          ) : (
            <span className="text-muted-foreground">{NO_TAG_LABEL}</span>
          )}
          <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <Command className="border-0 shadow-none">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Hledat nebo vytvořit tag"
            aria-label="Hledat nebo vytvořit tag"
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
                {!canCreate && <CommandEmpty>Žádný tag</CommandEmpty>}
                <CommandGroup>
                  <CommandItem value={NO_TAG_VALUE} keywords={[NO_TAG_LABEL]} onSelect={() => select(null)}>
                    <X className="size-4 text-muted-foreground" aria-hidden />
                    <span className="flex-1">{NO_TAG_LABEL}</span>
                    {value === null && <Check className="size-4 text-primary" aria-hidden />}
                  </CommandItem>
                  {(tags ?? []).map((tag) => (
                    <CommandItem key={tag.id} value={tag.id} keywords={[tag.name]} onSelect={() => select(tag.id, tag)}>
                      <Tag className="size-4 text-muted-foreground" aria-hidden />
                      <span className="flex-1 truncate">{tag.name}</span>
                      {value === tag.id && <Check className="size-4 text-primary" aria-hidden />}
                    </CommandItem>
                  ))}
                  {canCreate && (
                    <CommandItem
                      forceMount
                      value={`${CREATE_VALUE_PREFIX}${trimmedQuery}`}
                      disabled={isCreating}
                      onSelect={() => void createTag(trimmedQuery)}
                    >
                      {isCreating ? <Spinner aria-hidden /> : <Plus className="size-4" aria-hidden />}
                      <span className="truncate">Vytvořit tag „{trimmedQuery}“</span>
                    </CommandItem>
                  )}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
