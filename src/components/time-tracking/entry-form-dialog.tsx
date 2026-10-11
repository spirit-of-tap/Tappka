"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch, type DefaultValues } from "react-hook-form"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  MS_PER_HOUR,
  MS_PER_MINUTE,
  TIME_DIRECTIONS,
  TIME_TRACKING_MESSAGES,
  TITLE_MAX_LENGTH,
  TITLE_PLACEHOLDER,
} from "@/lib/time-tracking/constants"
import { formatDurationShort } from "@/lib/time-tracking/duration"
import type { TagCatalog, TimeDirection, TimeEntryWithTag } from "@/lib/time-tracking/types"
import { hasRequiredTag, timeDirectionSchema } from "@/lib/time-tracking/validation"
import { cn } from "@/lib/utils"

import { isoToLocalInputs, localInputsToIso } from "./local-datetime"
import { ENTRIES_ENDPOINT, ENTRY_DELETED_MESSAGE, readApiError } from "./time-entry-row"
import { TagCombobox } from "./tag-combobox"

export const ENTRY_SAVED_MESSAGE = "Záznam uložen"

const END_BEFORE_START_MESSAGE = "Konec musí být po začátku"
const DATE_REQUIRED_MESSAGE = "Vyplň datum"
const TIME_REQUIRED_MESSAGE = "Vyplň čas"
/** Status codes whose `{ error }` belongs to the time range (overlap, end ≤ start). */
const RANGE_ERROR_STATUSES: readonly number[] = [400, 409]
/** Manual entries default to the last hour, rounded down to this step. */
const DEFAULT_ROUND_MS = 15 * MS_PER_MINUTE
const DEFAULT_LENGTH_MS = MS_PER_HOUR
const EMPTY_PREVIEW = "—"

const entryFormSchema = z
  .object({
    direction: timeDirectionSchema,
    tagId: z.string().nullable(),
    /** Draft name of a team tag created on save (see `TagSelection`). */
    newTagName: z.string().nullable(),
    title: z.string().max(TITLE_MAX_LENGTH, { message: `Název může mít nejvýš ${TITLE_MAX_LENGTH} znaků` }),
    startDate: z.string().min(1, { message: DATE_REQUIRED_MESSAGE }),
    startTime: z.string().min(1, { message: TIME_REQUIRED_MESSAGE }),
    endDate: z.string().min(1, { message: DATE_REQUIRED_MESSAGE }),
    endTime: z.string().min(1, { message: TIME_REQUIRED_MESSAGE }),
  })
  .superRefine((value, ctx) => {
    const start = localInputsToIso(value.startDate, value.startTime)
    const end = localInputsToIso(value.endDate, value.endTime)
    if (start === null || end === null) return
    if (Date.parse(end) <= Date.parse(start)) {
      ctx.addIssue({ code: "custom", message: END_BEFORE_START_MESSAGE, path: ["endTime"] })
    }
  })

type EntryFormInput = z.input<typeof entryFormSchema>
type EntryFormValues = z.output<typeof entryFormSchema>

interface EntryPayload {
  direction?: TimeDirection
  tagId?: string | null
  newTagName?: string
  title?: string | null
  startedAt?: string
  endedAt?: string
}

function normalizeTitle(title: string): string | null {
  const trimmed = title.trim()
  return trimmed === "" ? null : trimmed
}

/** Start / end proposed by the caller for a new entry (e.g. a block dragged in the calendar). */
export interface EntryInitialRange {
  startedAt: string
  endedAt: string
}

function defaultsFor(
  entry: TimeEntryWithTag | null,
  now: Date,
  initialRange?: EntryInitialRange,
): DefaultValues<EntryFormInput> {
  if (entry && entry.ended_at !== null) {
    const start = isoToLocalInputs(entry.started_at)
    const end = isoToLocalInputs(entry.ended_at)
    return {
      direction: entry.direction,
      tagId: entry.tag_id,
      newTagName: null,
      title: entry.title ?? "",
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
    }
  }
  const endMs = Math.floor(now.getTime() / DEFAULT_ROUND_MS) * DEFAULT_ROUND_MS
  const start = isoToLocalInputs(initialRange?.startedAt ?? new Date(endMs - DEFAULT_LENGTH_MS))
  const end = isoToLocalInputs(initialRange?.endedAt ?? new Date(endMs))
  return {
    // `direction` is required but deliberately has no default (design §5).
    tagId: null,
    newTagName: null,
    title: "",
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
  }
}

/** Full payload for create; only changed fields for edit. */
export function buildEntryPayload(
  values: EntryFormValues,
  entry: TimeEntryWithTag | null,
): EntryPayload | null {
  const startedAt = localInputsToIso(values.startDate, values.startTime)
  const endedAt = localInputsToIso(values.endDate, values.endTime)
  if (startedAt === null || endedAt === null) return null
  const title = normalizeTitle(values.title)

  // A draft tag name is sent instead of `tagId`; the API creates (or reuses) the team tag.
  const newTagName = values.newTagName ?? undefined
  if (entry === null) {
    return newTagName === undefined
      ? { direction: values.direction, tagId: values.tagId, title, startedAt, endedAt }
      : { direction: values.direction, newTagName, title, startedAt, endedAt }
  }

  const patch: EntryPayload = {}
  if (values.direction !== entry.direction) patch.direction = values.direction
  if (newTagName !== undefined) patch.newTagName = newTagName
  else if (values.tagId !== entry.tag_id) patch.tagId = values.tagId
  if (title !== entry.title) patch.title = title
  if (Date.parse(startedAt) !== Date.parse(entry.started_at)) patch.startedAt = startedAt
  if (entry.ended_at === null || Date.parse(endedAt) !== Date.parse(entry.ended_at)) patch.endedAt = endedAt
  return patch
}

export interface EntryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Entry to edit; `null` / omitted = create („Zapsat ručně"). */
  entry?: TimeEntryWithTag | null
  /** Pre-loaded tag catalog for the combobox. */
  tagCatalog?: TagCatalog
  /** Reference time for create defaults (end = now rounded down, start = 1 h before). */
  now?: Date
  /** Called with the saved entry (for an optimistic update) before `router.refresh()`. */
  onSaved?: (entry: TimeEntryWithTag) => void
  /** Pre-filled start / end for a new entry. */
  initialRange?: EntryInitialRange
  /** When set, editing shows „Smazat"; called with the id after a successful delete. */
  onDeleted?: (id: string) => void
}

/** One dialog for „Zapsat ručně" (POST) and „Upravit" (PATCH with changed fields only). */
export function EntryFormDialog({
  open,
  onOpenChange,
  entry = null,
  tagCatalog,
  now,
  onSaved,
  initialRange,
  onDeleted,
}: EntryFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? "Upravit záznam" : "Zapsat čas ručně"}</DialogTitle>
          <DialogDescription>
            {entry ? "Uprav směr, tag, název nebo čas záznamu." : "Zapiš čas, který neběžel na časomíře."}
          </DialogDescription>
        </DialogHeader>
        {/* Content unmounts when closed, so every open starts from fresh defaults. */}
        <EntryForm
          key={entry?.id ?? `new-${initialRange?.startedAt ?? ""}`}
          entry={entry}
          tagCatalog={tagCatalog}
          now={now}
          initialRange={initialRange}
          onSaved={onSaved}
          onDeleted={onDeleted}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface EntryFormProps {
  entry: TimeEntryWithTag | null
  tagCatalog?: TagCatalog
  now?: Date
  initialRange?: EntryInitialRange
  onSaved?: (entry: TimeEntryWithTag) => void
  onDeleted?: (id: string) => void
  onDone: () => void
}

function EntryForm({ entry, tagCatalog, now, initialRange, onSaved, onDeleted, onDone }: EntryFormProps) {
  const router = useRouter()
  const [referenceNow] = React.useState(() => now ?? new Date())
  const ids = {
    direction: React.useId(),
    tag: React.useId(),
    title: React.useId(),
    startDate: React.useId(),
    startTime: React.useId(),
    endDate: React.useId(),
    endTime: React.useId(),
  }

  const form = useForm<EntryFormInput, unknown, EntryFormValues>({
    resolver: zodResolver(entryFormSchema),
    defaultValues: defaultsFor(entry, referenceNow, initialRange),
  })
  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = form

  const [startDate, startTime, endDate, endTime, selectedDirection, newTagName] = useWatch({
    control,
    name: ["startDate", "startTime", "endDate", "endTime", "direction", "newTagName"],
  })
  const startIso = localInputsToIso(startDate, startTime)
  const endIso = localInputsToIso(endDate, endTime)
  const previewMs = startIso !== null && endIso !== null ? Date.parse(endIso) - Date.parse(startIso) : null
  const preview = previewMs !== null && previewMs > 0 ? formatDurationShort(previewMs) : EMPTY_PREVIEW

  async function onSubmit(values: EntryFormValues) {
    // Like the API: an older untagged Training / Reading entry stays editable until its
    // direction or tag is touched.
    const touchesTag =
      entry === null ||
      values.direction !== entry.direction ||
      values.tagId !== entry.tag_id ||
      values.newTagName !== null
    if (touchesTag && !hasRequiredTag(values)) {
      setError("tagId", { type: "required", message: TIME_TRACKING_MESSAGES.tagRequired })
      return
    }
    const payload = buildEntryPayload(values, entry)
    if (payload === null) return
    if (entry !== null && Object.keys(payload).length === 0) {
      onDone()
      return
    }

    try {
      const response = await fetch(entry ? `${ENTRIES_ENDPOINT}/${entry.id}` : ENTRIES_ENDPOINT, {
        method: entry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const message = await readApiError(response)
        if (RANGE_ERROR_STATUSES.includes(response.status)) {
          setError("endTime", { type: "server", message }, { shouldFocus: true })
        } else {
          toast.error(message)
        }
        return
      }
      const body = (await response.json()) as { data?: TimeEntryWithTag }
      if (body.data) onSaved?.(body.data)
      toast.success(ENTRY_SAVED_MESSAGE)
      onDone()
      router.refresh()
    } catch {
      toast.error(TIME_TRACKING_MESSAGES.generic)
    }
  }

  const endError = errors.endDate ?? errors.endTime
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  async function handleDelete() {
    if (entry === null) return
    setIsDeleting(true)
    try {
      const response = await fetch(`${ENTRIES_ENDPOINT}/${entry.id}`, { method: "DELETE" })
      if (!response.ok) {
        toast.error(await readApiError(response))
        return
      }
      onDeleted?.(entry.id)
      toast.success(ENTRY_DELETED_MESSAGE)
      onDone()
      router.refresh()
    } catch {
      toast.error(TIME_TRACKING_MESSAGES.generic)
    } finally {
      setIsDeleting(false)
      setDeleteOpen(false)
    }
  }

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-5">
      <Controller
        control={control}
        name="direction"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel id={ids.direction}>Směr</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              aria-labelledby={ids.direction}
              aria-invalid={fieldState.invalid || undefined}
              value={field.value ?? ""}
              onValueChange={(value) => {
                if (!value || value === field.value) return
                field.onChange(value as TimeDirection)
                // A tag belongs to one direction, so switching direction drops it.
                setValue("tagId", null)
                setValue("newTagName", null)
              }}
              className="w-full"
            >
              {TIME_DIRECTIONS.map((direction) => (
                <ToggleGroupItem key={direction.value} value={direction.value} className="flex-1 gap-2">
                  <span aria-hidden className={cn("size-2 rounded-full", direction.dotClass)} />
                  {direction.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        control={control}
        name="tagId"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor={ids.tag}>Tag</FieldLabel>
            <TagCombobox
              id={ids.tag}
              value={{ tagId: field.value, newTagName: newTagName ?? null }}
              direction={selectedDirection ?? null}
              onChange={(selection) => {
                field.onChange(selection.tagId)
                setValue("newTagName", selection.newTagName)
                form.clearErrors("tagId")
              }}
              initialCatalog={tagCatalog}
              aria-invalid={fieldState.invalid || undefined}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Field data-invalid={errors.title ? true : undefined}>
        <FieldLabel htmlFor={ids.title}>Co konkrétně</FieldLabel>
        <Input
          id={ids.title}
          placeholder={TITLE_PLACEHOLDER}
          maxLength={TITLE_MAX_LENGTH}
          autoComplete="off"
          aria-invalid={errors.title ? true : undefined}
          {...register("title")}
        />
        <FieldError errors={[errors.title]} />
      </Field>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="sr-only">Začátek</legend>
        <Field data-invalid={errors.startDate ? true : undefined}>
          <FieldLabel htmlFor={ids.startDate}>Začátek</FieldLabel>
          <Input
            id={ids.startDate}
            type="date"
            aria-invalid={errors.startDate ? true : undefined}
            className="tabular-nums"
            {...register("startDate")}
          />
          <FieldError errors={[errors.startDate]} />
        </Field>
        <Field data-invalid={errors.startTime ? true : undefined}>
          <FieldLabel htmlFor={ids.startTime}>Čas začátku</FieldLabel>
          <Input
            id={ids.startTime}
            type="time"
            aria-invalid={errors.startTime ? true : undefined}
            className="tabular-nums"
            {...register("startTime")}
          />
          <FieldError errors={[errors.startTime]} />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="sr-only">Konec</legend>
        <Field data-invalid={errors.endDate ? true : undefined}>
          <FieldLabel htmlFor={ids.endDate}>Konec</FieldLabel>
          <Input
            id={ids.endDate}
            type="date"
            aria-invalid={errors.endDate ? true : undefined}
            className="tabular-nums"
            {...register("endDate")}
          />
        </Field>
        <Field data-invalid={errors.endTime ? true : undefined}>
          <FieldLabel htmlFor={ids.endTime}>Čas konce</FieldLabel>
          <Input
            id={ids.endTime}
            type="time"
            aria-invalid={errors.endTime ? true : undefined}
            className="tabular-nums"
            {...register("endTime")}
          />
        </Field>
        <FieldError className="col-span-2" errors={[endError]} />
      </fieldset>

      <p className="text-sm text-muted-foreground">
        Délka: <span className="font-medium tabular-nums text-foreground" data-testid="duration-preview">{preview}</span>
      </p>

      <DialogFooter className="gap-2 sm:justify-between">
        {entry !== null && onDeleted ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-destructive hover:text-destructive sm:w-auto"
            onClick={() => setDeleteOpen(true)}
            disabled={isDeleting}
          >
            <Trash2 aria-hidden />
            Smazat
          </Button>
        ) : (
          <span className="hidden sm:block" />
        )}
        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting && <Spinner aria-hidden />}
          Uložit
        </Button>
      </DialogFooter>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat záznam?</AlertDialogTitle>
            <AlertDialogDescription>Záznam zmizí z tvého přehledu. Tuhle akci nejde vrátit.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
