"use client"

import { useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { cs } from "date-fns/locale"
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  EDITABLE_REFLECTION_FIELDS,
  REFLECTION_WITH_CREATOR_SELECT,
  type EditableReflectionField,
  type TeamReflectionWithCreator,
} from "@/lib/tymova-reflexe/types"
import { useFieldAutosave } from "@/lib/tymova-reflexe/use-field-autosave"

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function monthLabel(monthStr: string): string {
  const m = Number(monthStr.slice(5, 7))
  return `${MONTH_LABELS[m - 1]} ${monthStr.slice(0, 4)}`
}

const FIELD_LABELS: Record<EditableReflectionField, string> = {
  what_went_well: "Co se povedlo",
  what_didnt_go_well: "Co se nepovedlo",
  what_we_do_differently: "Co uděláme jinak",
  planned_action_steps: "Plánované akční kroky",
  responsible_person: "Zodpovědná osoba za AK",
}

interface TeamReflectionDetailProps {
  reflection: TeamReflectionWithCreator
  profileId: string
}

export function TeamReflectionDetail({ reflection: initial, profileId }: TeamReflectionDetailProps) {
  const supabase = useRef(createClient())
  const channelRef = useRef<RealtimeChannel | null>(null)

  const save = useCallback(
    async (payload: Partial<Record<EditableReflectionField, string | null>>, current: TeamReflectionWithCreator) => {
      const { data: updated, error } = await supabase.current
        .from("team_reflections")
        .update({ ...payload, updated_by_profile_id: profileId })
        .eq("id", current.id)
        .select(REFLECTION_WITH_CREATOR_SELECT)
        .single()

      if (error) throw error
      const typed = updated as TeamReflectionWithCreator

      await channelRef.current?.send({
        type: "broadcast",
        event: "reflection_updated",
        payload: typed,
      })

      return typed
    },
    [profileId],
  )

  const onConflict = useCallback((fields: EditableReflectionField[]) => {
    const labels = fields.map((field) => FIELD_LABELS[field]).join(", ")
    toast.warning(`Pole „${labels}“ mezitím upravila jiná osoba. Zkontrolujte obsah před uložením.`)
  }, [])

  const { data, setField, dirtyFields, saving, applyIncoming } = useFieldAutosave<
    TeamReflectionWithCreator,
    EditableReflectionField
  >({ initial, fields: EDITABLE_REFLECTION_FIELDS, save, onConflict })

  const topic = `team:${data.team_id}:reflection`

  useEffect(() => {
    const channel = supabase.current
      .channel(topic, {
        config: {
          broadcast: { self: false, ack: true },
          private: true,
        },
      })
      .on("broadcast", { event: "reflection_updated" }, (message) => {
        applyIncoming(message.payload as TeamReflectionWithCreator)
      })

    channelRef.current = channel

    supabase.current.realtime.setAuth().then(() => {
      channel.subscribe((status, err) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Reflection channel error:", err)
        }
      })
    }).catch((err) => {
      console.error("Failed to set auth for reflection channel:", err)
    })

    return () => {
      channelRef.current = null
      supabase.current.removeChannel(channel)
    }
  }, [topic, applyIncoming])

  return (
    <div className="container mx-auto max-w-4xl py-4 sm:py-6 px-3 sm:px-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/tymova-reflexe"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Zpět na přehled
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Týmová reflexe — {monthLabel(data.month)}
          </h1>
          {data.updated_by && (
            <p className="text-xs text-muted-foreground">
              Naposledy upravil:la {data.updated_by.name}{" "}
              {formatDistanceToNow(new Date(data.updated_at), { locale: cs, addSuffix: true })}
            </p>
          )}
        </div>
        <div className="shrink-0">
          <SaveStatus saving={saving} dirty={dirtyFields.size > 0} />
        </div>
      </div>

      <Card className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="what-went-well">{FIELD_LABELS.what_went_well}</Label>
            <Textarea
              id="what-went-well"
              value={data.what_went_well ?? ""}
              onChange={(e) => setField("what_went_well", e.target.value)}
              placeholder="Úspěchy a pozitiva za uplynulý měsíc"
              rows={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="what-didnt-go-well">{FIELD_LABELS.what_didnt_go_well}</Label>
            <Textarea
              id="what-didnt-go-well"
              value={data.what_didnt_go_well ?? ""}
              onChange={(e) => setField("what_didnt_go_well", e.target.value)}
              placeholder="Problémy a výzvy, které nastaly"
              rows={6}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="what-we-do-differently">{FIELD_LABELS.what_we_do_differently}</Label>
          <Textarea
            id="what-we-do-differently"
            value={data.what_we_do_differently ?? ""}
            onChange={(e) => setField("what_we_do_differently", e.target.value)}
            placeholder="Změny přístupu do budoucna"
            rows={4}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="action-steps">{FIELD_LABELS.planned_action_steps}</Label>
            <Textarea
              id="action-steps"
              value={data.planned_action_steps ?? ""}
              onChange={(e) => setField("planned_action_steps", e.target.value)}
              placeholder="Konkrétní kroky ke zlepšení"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="responsible-person">{FIELD_LABELS.responsible_person}</Label>
            <Input
              id="responsible-person"
              value={data.responsible_person ?? ""}
              onChange={(e) => setField("responsible_person", e.target.value)}
              placeholder="Jméno člena:ky týmu"
            />
          </div>
        </div>
      </Card>
    </div>
  )
}

function SaveStatus({ saving, dirty }: { saving: boolean; dirty: boolean }) {
  if (saving) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Ukládání…
      </span>
    )
  }
  if (dirty) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
        <span className="size-1.5 rounded-full bg-amber-500" />
        Neuložené změny
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <CheckCircle2 className="size-3.5 text-green-600" />
      Uloženo
    </span>
  )
}
