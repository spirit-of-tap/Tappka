"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ArrowLeft, Wifi, WifiOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { REFLECTION_WITH_CREATOR_SELECT } from "@/lib/tymova-reflexe/types"
import type { TeamReflectionWithCreator } from "@/lib/tymova-reflexe/types"

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function monthLabel(monthStr: string): string {
  const m = Number(monthStr.slice(5, 7))
  return `${MONTH_LABELS[m - 1]} ${monthStr.slice(0, 4)}`
}

const AUTO_SAVE_DELAY = 2000
const TOPIC_PREFIX = "team:teamId:reflection"

interface TeamReflectionDetailProps {
  reflection: TeamReflectionWithCreator
  profileId: string
}

export function TeamReflectionDetail({ reflection: initial, profileId }: TeamReflectionDetailProps) {
  const supabase = useRef(createClient())
  const [data, setData] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [connected, setConnected] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef(data)

  latestRef.current = data

  const topic = `team:${data.team_id}:reflection`

  const doSave = useCallback(async (current: TeamReflectionWithCreator) => {
    setSaving(true)
    try {
      const { data: updated, error } = await supabase.current
        .from("team_reflections")
        .update({
          what_went_well: current.what_went_well || null,
          what_didnt_go_well: current.what_didnt_go_well || null,
          what_we_do_differently: current.what_we_do_differently || null,
          planned_action_steps: current.planned_action_steps || null,
          responsible_person: current.responsible_person || null,
          updated_by_profile_id: profileId,
        })
        .eq("id", current.id)
        .select(REFLECTION_WITH_CREATOR_SELECT)
        .single()

      if (error) throw error

      const typed = updated as TeamReflectionWithCreator
      setData(typed)
      setDirty(false)

      await supabase.current.channel(topic).send({
        type: "broadcast",
        event: "reflection_updated",
        payload: typed,
      })
    } catch {
      toast.error("Nepodařilo se uložit")
    } finally {
      setSaving(false)
    }
  }, [profileId, topic])

  useEffect(() => {
    const channel = supabase.current
      .channel(topic, { config: { private: true } })
      .on("broadcast", { event: "reflection_updated" }, (payload) => {
        const incoming = payload.payload as TeamReflectionWithCreator
        if (incoming.id === data.id && incoming.updated_at !== latestRef.current.updated_at) {
          setData(incoming)
          setDirty(false)
        }
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED")
      })

    return () => {
      supabase.current.removeChannel(channel)
    }
  }, [data.id, topic])

  useEffect(() => {
    if (!dirty) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSave(latestRef.current), AUTO_SAVE_DELAY)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [data, dirty, doSave])

  function handleChange(field: keyof TeamReflectionWithCreator, value: string) {
    setData((prev) => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  return (
    <div className="container mx-auto max-w-4xl py-4 sm:py-6 px-3 sm:px-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <a
            href="/tymova-reflexe"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Zpět na přehled
          </a>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Týmová reflexe — {monthLabel(data.month)}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : dirty ? (
            <span className="text-xs text-amber-600 font-medium">Neuloženo</span>
          ) : (
            <span className="text-xs text-green-600 font-medium">Uloženo</span>
          )}
          {connected ? (
            <Wifi className="size-4 text-green-600" />
          ) : (
            <WifiOff className="size-4 text-muted-foreground" />
          )}
        </div>
      </div>

      <Card className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="what-went-well">Co se povedlo</Label>
            <Textarea
              id="what-went-well"
              value={data.what_went_well ?? ""}
              onChange={(e) => handleChange("what_went_well", e.target.value)}
              placeholder="Úspěchy a pozitiva za uplynulý měsíc"
              rows={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="what-didnt-go-well">Co se nepovedlo</Label>
            <Textarea
              id="what-didnt-go-well"
              value={data.what_didnt_go_well ?? ""}
              onChange={(e) => handleChange("what_didnt_go_well", e.target.value)}
              placeholder="Problémy a výzvy, které nastaly"
              rows={6}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="what-we-do-differently">Co uděláme jinak</Label>
          <Textarea
            id="what-we-do-differently"
            value={data.what_we_do_differently ?? ""}
            onChange={(e) => handleChange("what_we_do_differently", e.target.value)}
            placeholder="Změny přístupu do budoucna"
            rows={4}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="action-steps">Plánované akční kroky</Label>
            <Textarea
              id="action-steps"
              value={data.planned_action_steps ?? ""}
              onChange={(e) => handleChange("planned_action_steps", e.target.value)}
              placeholder="Konkrétní kroky ke zlepšení"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="responsible-person">Zodpovědná osoba za AK</Label>
            <Input
              id="responsible-person"
              value={data.responsible_person ?? ""}
              onChange={(e) => handleChange("responsible_person", e.target.value)}
              placeholder="Jméno člena týmu"
            />
          </div>
        </div>
      </Card>
    </div>
  )
}
