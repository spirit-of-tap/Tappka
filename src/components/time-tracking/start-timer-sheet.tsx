"use client"

import * as React from "react"
import { Play } from "lucide-react"
import { toast } from "sonner"

import { TIME_DIRECTIONS, TITLE_MAX_LENGTH, TITLE_PLACEHOLDER } from "@/lib/time-tracking/constants"
import type { TimeDirection } from "@/lib/time-tracking/types"
import { startTimerSchema } from "@/lib/time-tracking/validation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
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

import { TagCombobox } from "./tag-combobox"
import { useTimer } from "./timer-provider"

export const TIMER_STARTED_MESSAGE = "Časomíra běží"

interface StartTimerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FormState {
  direction: TimeDirection | null
  tagId: string | null
  title: string
}

const EMPTY_FORM: FormState = { direction: null, tagId: null, title: "" }

export function StartTimerSheet({ open, onOpenChange }: StartTimerSheetProps) {
  const { start, isPending } = useTimer()
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [error, setError] = React.useState<string | null>(null)
  const directionId = React.useId()
  const tagId = React.useId()
  const titleId = React.useId()

  function handleOpenChange(next: boolean) {
    if (!next) {
      setForm(EMPTY_FORM)
      setError(null)
    }
    onOpenChange(next)
  }

  async function submit() {
    if (isPending) return
    const parsed = startTimerSchema.safeParse({
      action: "start",
      direction: form.direction ?? undefined,
      tagId: form.tagId,
      title: form.title,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null)
      return
    }
    setError(null)
    const ok = await start({
      direction: parsed.data.direction,
      tagId: parsed.data.tagId ?? null,
      title: parsed.data.title ?? null,
    })
    if (ok) {
      toast.success(TIMER_STARTED_MESSAGE)
      handleOpenChange(false)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void submit()
    }
  }

  const directionMissing = error !== null && form.direction === null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Spustit časomíru</DialogTitle>
          <DialogDescription>Vyber směr, případně tag a na čem pracuješ.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="flex flex-col gap-5">
          <Field data-invalid={directionMissing || undefined}>
            <FieldLabel id={directionId}>Směr</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              aria-labelledby={directionId}
              aria-invalid={directionMissing || undefined}
              value={form.direction ?? ""}
              onValueChange={(value) => {
                if (!value) return
                setForm((current) => ({ ...current, direction: value as TimeDirection }))
                setError(null)
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
            {error !== null && <FieldError>{error}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor={tagId}>Tag</FieldLabel>
            <TagCombobox
              id={tagId}
              value={form.tagId}
              onChange={(nextTagId) => setForm((current) => ({ ...current, tagId: nextTagId }))}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor={titleId}>Co konkrétně</FieldLabel>
            <Input
              id={titleId}
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={TITLE_PLACEHOLDER}
              maxLength={TITLE_MAX_LENGTH}
              autoComplete="off"
            />
          </Field>

          <DialogFooter className="items-center gap-3 sm:justify-between">
            <KbdGroup className="hidden text-xs text-muted-foreground sm:inline-flex">
              <Kbd>Ctrl</Kbd>
              <span>+</span>
              <Kbd>Enter</Kbd>
            </KbdGroup>
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? <Spinner aria-hidden /> : <Play aria-hidden />}
              Spustit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
