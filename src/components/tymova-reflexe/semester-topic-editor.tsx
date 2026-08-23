"use client"

import { useCallback, useEffect, useRef, type RefObject } from "react"
import { formatDistanceToNow } from "date-fns"
import { cs } from "date-fns/locale"
import { CheckCircle2, Loader2 } from "lucide-react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  EDITABLE_SEMESTER_ENTRY_FIELDS,
  SEMESTER_ENTRY_SELECT,
  type EditableSemesterEntryField,
  type SemesterReflectionEntryWithUpdater,
} from "@/lib/tymova-reflexe/semester-types"
import type { RocnikovaTopicDefinition } from "@/lib/tymova-reflexe/semester-topics"
import { useFieldAutosave } from "@/lib/tymova-reflexe/use-field-autosave"

const FIELD_LABELS: Record<EditableSemesterEntryField, string> = {
  what_went_well: "Co se povedlo",
  what_didnt_go_well: "Co se nepovedlo",
  what_next_time: "Co příště jinak a jak",
}

interface SemesterTopicEditorProps {
  entry: SemesterReflectionEntryWithUpdater
  topicDef: RocnikovaTopicDefinition
  channelRef: RefObject<RealtimeChannel | null>
  profileId: string
  registerListener: (
    entryId: string,
    handler: (incoming: SemesterReflectionEntryWithUpdater) => void,
  ) => () => void
}

export function SemesterTopicEditor({
  entry: initial,
  topicDef,
  channelRef,
  profileId,
  registerListener,
}: SemesterTopicEditorProps) {
  const supabase = useRef(createClient())

  const save = useCallback(
    async (
      payload: Partial<Record<EditableSemesterEntryField, string | null>>,
      current: SemesterReflectionEntryWithUpdater,
    ) => {
      const { data: updated, error } = await supabase.current
        .from("team_annual_reflection_entries")
        .update({ ...payload, updated_by_profile_id: profileId })
        .eq("id", current.id)
        .select(SEMESTER_ENTRY_SELECT)
        .single()

      if (error) throw error
      const typed = updated as SemesterReflectionEntryWithUpdater

      await channelRef.current?.send({
        type: "broadcast",
        event: "entry_updated",
        payload: typed,
      })

      return typed
    },
    [profileId, channelRef],
  )

  const onConflict = useCallback(
    (fields: EditableSemesterEntryField[]) => {
      const labels = fields.map((field) => FIELD_LABELS[field]).join(", ")
      toast.warning(`Pole „${labels}“ u tématu „${topicDef.label}“ mezitím upravil:a jiný:á člen:ka týmu.`)
    },
    [topicDef.label],
  )

  const { data, setField, dirtyFields, saving, applyIncoming } = useFieldAutosave<
    SemesterReflectionEntryWithUpdater,
    EditableSemesterEntryField
  >({ initial, fields: EDITABLE_SEMESTER_ENTRY_FIELDS, save, onConflict })

  useEffect(
    () => registerListener(initial.id, applyIncoming),
    [registerListener, applyIncoming, initial.id],
  )

  const filledCount = EDITABLE_SEMESTER_ENTRY_FIELDS.filter((field) => data[field]?.trim()).length

  return (
    <AccordionItem value={topicDef.key}>
      <AccordionTrigger>
        <div className="flex w-full items-center justify-between gap-3 pr-2">
          <span className="text-left font-medium">{topicDef.label}</span>
          <span
            className={
              filledCount === EDITABLE_SEMESTER_ENTRY_FIELDS.length
                ? "text-xs font-normal text-emerald-600 dark:text-emerald-400"
                : "text-xs font-normal text-muted-foreground"
            }
          >
            {filledCount}/{EDITABLE_SEMESTER_ENTRY_FIELDS.length}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pt-1 pb-4">
        <p className="text-xs leading-relaxed text-muted-foreground">{topicDef.description}</p>

        {EDITABLE_SEMESTER_ENTRY_FIELDS.map((field) => (
          <div key={field} className="space-y-1.5">
            <Label htmlFor={`${topicDef.key}-${field}`}>{FIELD_LABELS[field]}</Label>
            <Textarea
              id={`${topicDef.key}-${field}`}
              value={data[field] ?? ""}
              onChange={(e) => setField(field, e.target.value)}
              placeholder={`Zapište ${FIELD_LABELS[field].toLowerCase()}…`}
              rows={3}
            />
          </div>
        ))}

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <InlineSaveStatus saving={saving} dirty={dirtyFields.size > 0} />
          {data.updated_by && (
            <span>
              Naposledy upravil:a {data.updated_by.name}{" "}
              {formatDistanceToNow(new Date(data.updated_at), { locale: cs, addSuffix: true })}
            </span>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

function InlineSaveStatus({ saving, dirty }: { saving: boolean; dirty: boolean }) {
  if (saving) {
    return (
      <span className="flex items-center gap-1">
        <Loader2 className="size-3 animate-spin" />
        Ukládání…
      </span>
    )
  }
  if (dirty) {
    return (
      <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
        <span className="size-1.5 rounded-full bg-amber-500" />
        Neuložené změny
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="size-3" />
      Uloženo
    </span>
  )
}
