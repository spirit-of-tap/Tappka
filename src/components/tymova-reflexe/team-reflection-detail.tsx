"use client"

import { useEffect, useRef, useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { cs } from "date-fns/locale"
import { CheckCircle2, Loader2, Sparkles, Trash2 } from "lucide-react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageBack } from "@/components/ui/page-back"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  EDITABLE_REFLECTION_FIELDS,
  REFLECTION_WITH_CREATOR_SELECT,
  type EditableReflectionField,
  type TeamReflectionWithCreator,
} from "@/lib/tymova-reflexe/types"
import { useFieldAutosave } from "@/lib/tymova-reflexe/use-field-autosave"
import { parseActionSteps, serializeActionSteps, type ActionStepItem } from "@/lib/tymova-reflexe/action-steps"
import { ActionStepsEditor } from "./action-steps-editor"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function monthLabel(monthStr: string): string {
  const parts = monthStr.split("-")
  const m = Number(parts[1])
  const year = parts[0]
  return `${MONTH_LABELS[m - 1]} ${year}`
}

const FIELD_LABELS: Record<EditableReflectionField, string> = {
  what_went_well: "Co se povedlo",
  what_we_do_differently: "Co uděláme jinak",
  planned_action_steps: "Plánované akční kroky",
  responsible_person: "Zodpovědná osoba za AK",
}

interface TeamReflectionDetailProps {
  reflection: TeamReflectionWithCreator
  profileId: string
  teamMembers?: TeamMemberProfile[]
}

export function TeamReflectionDetail({
  reflection: initial,
  profileId,
  teamMembers = [],
}: TeamReflectionDetailProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const supabase = useRef(createClient())
  const channelRef = useRef<RealtimeChannel | null>(null)

  const save = useCallback(
    async (
      payload: Partial<Record<EditableReflectionField, string | null>>,
      current: TeamReflectionWithCreator,
    ) => {
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
    const client = supabase.current
    const channel = client
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

    client.realtime
      .setAuth()
      .then(() => {
        channel.subscribe((status, err) => {
          if (status === "CHANNEL_ERROR") {
            console.error("Reflection channel error:", err)
          }
        })
      })
      .catch((err) => {
        console.error("Failed to set auth for reflection channel:", err)
      })

    return () => {
      channelRef.current = null
      client.removeChannel(channel)
    }
  }, [topic, applyIncoming])

  const actionSteps = useMemo(
    () => parseActionSteps(data.planned_action_steps, data.responsible_person),
    [data.planned_action_steps, data.responsible_person],
  )

  const handleActionStepsChange = useCallback(
    (steps: ActionStepItem[]) => {
      const serialized = serializeActionSteps(steps)
      setField("planned_action_steps", serialized.planned_action_steps ?? "")
      setField("responsible_person", serialized.responsible_person ?? "")
    },
    [setField],
  )

  async function handleDelete() {
    setDeleting(true)
    try {
      const { error } = await supabase.current
        .from("team_reflections")
        .update({ removed_at: new Date().toISOString() })
        .eq("id", data.id)

      if (error) throw error
      toast.success("Reflexe odstraněna")
      router.push("/tymova-reflexe")
    } catch {
      toast.error("Nepodařilo se odstranit reflexi")
      setDeleting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl py-4 sm:py-6 px-3 sm:px-6 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <PageBack href="/tymova-reflexe" label="Zpět na přehled" />
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Týmová reflexe — {monthLabel(data.month)}
          </h1>
          {data.updated_by && (
            <p className="text-xs text-muted-foreground">
              Naposledy upravil:a {data.updated_by.name}{" "}
              {formatDistanceToNow(new Date(data.updated_at), { locale: cs, addSuffix: true })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <SaveStatus saving={saving} dirty={dirtyFields.size > 0} />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                aria-label="Smazat reflexi"
              >
                <Trash2 className="size-4" />
                <span className="hidden sm:inline ml-1.5">Smazat</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Odstranit měsíční reflexi?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tato akce reflexi za {monthLabel(data.month)} odstraní.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleting}
                >
                  {deleting ? "Odstraňuji..." : "Odstranit"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Two Reflection Text Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {/* Co se povedlo */}
        <Card className="flex flex-col p-4 sm:p-5 space-y-2 border-emerald-500/25 bg-card hover:border-emerald-500/40 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
            </div>
            <div>
              <h2 className="font-heading text-sm font-semibold text-foreground">
                Co se povedlo
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Úspěchy, zvládnuté výzvy a pozitivní momenty
              </p>
            </div>
          </div>
          <Textarea
            id="what-went-well"
            aria-label="Co se povedlo"
            value={data.what_went_well ?? ""}
            onChange={(e) => setField("what_went_well", e.target.value)}
            placeholder="Úspěchy, zvládnuté výzvy a pozitiva za uplynulý měsíc…"
            rows={6}
            className="flex-1 resize-none text-sm border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60 leading-relaxed min-h-[120px]"
          />
        </Card>

        {/* Co uděláme jinak */}
        <Card className="flex flex-col p-4 sm:p-5 space-y-2 border-primary/25 bg-card hover:border-primary/40 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h2 className="font-heading text-sm font-semibold text-foreground">
                Co uděláme jinak
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Co příště upravíme, vyzkoušíme nebo změníme
              </p>
            </div>
          </div>
          <Textarea
            id="what-we-do-differently"
            aria-label="Co uděláme jinak"
            value={data.what_we_do_differently ?? ""}
            onChange={(e) => setField("what_we_do_differently", e.target.value)}
            placeholder="Co příště změníme, zkusíme nebo upravíme v přístupu…"
            rows={6}
            className="flex-1 resize-none text-sm border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60 leading-relaxed min-h-[120px]"
          />
        </Card>
      </div>

      {/* Action Steps Section */}
      <Card className="p-4 sm:p-5 border-border/80 bg-card">
        <ActionStepsEditor
          steps={actionSteps}
          onChange={handleActionStepsChange}
          teamMembers={teamMembers}
        />
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
      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <span className="size-1.5 rounded-full bg-amber-500" />
        Neuložené změny
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      Uloženo
    </span>
  )
}
