"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { TeamReflection, TeamReflectionWithCreator } from "@/lib/tymova-reflexe/types"
import { REFLECTION_WITH_CREATOR_SELECT } from "@/lib/tymova-reflexe/types"

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function monthLabel(monthStr: string): string {
  const m = Number(monthStr.slice(5, 7))
  return `${MONTH_LABELS[m - 1]} ${monthStr.slice(0, 4)}`
}

function availableMonths(): string[] {
  const now = new Date()
  const result: string[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`)
  }
  return result
}

interface TeamReflectionFormProps {
  teamId: string
  profileId: string
  initial?: Partial<TeamReflection>
  onSuccess: (reflection: TeamReflectionWithCreator) => void
  onCancel: () => void
}

export function TeamReflectionForm({ teamId, profileId, initial, onSuccess, onCancel }: TeamReflectionFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(initial?.month ?? getCurrentMonth())
  const [whatWentWell, setWhatWentWell] = useState(initial?.what_went_well ?? "")
  const [whatDidntGoWell, setWhatDidntGoWell] = useState(initial?.what_didnt_go_well ?? "")
  const [whatWeDoDifferently, setWhatWeDoDifferently] = useState(initial?.what_we_do_differently ?? "")
  const [plannedActionSteps, setPlannedActionSteps] = useState(initial?.planned_action_steps ?? "")
  const [responsiblePerson, setResponsiblePerson] = useState(initial?.responsible_person ?? "")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const isEdit = !!initial?.id
      const base = {
        team_id: teamId,
        month,
        what_went_well: whatWentWell.trim() || null,
        what_didnt_go_well: whatDidntGoWell.trim() || null,
        what_we_do_differently: whatWeDoDifferently.trim() || null,
        planned_action_steps: plannedActionSteps.trim() || null,
        responsible_person: responsiblePerson.trim() || null,
        updated_by_profile_id: profileId,
      }

      let data: TeamReflectionWithCreator
      if (isEdit) {
        const result = await supabase
          .from("team_reflections")
          .update(base)
          .eq("id", initial!.id!)
          .select(REFLECTION_WITH_CREATOR_SELECT)
          .single()
        if (result.error) throw result.error
        data = result.data as TeamReflectionWithCreator
      } else {
        const result = await supabase
          .from("team_reflections")
          .insert({ ...base, created_by_profile_id: profileId })
          .select(REFLECTION_WITH_CREATOR_SELECT)
          .single()
        if (result.error) throw result.error
        data = result.data as TeamReflectionWithCreator
      }

      toast.success(initial ? "Reflexe aktualizována" : "Reflexe vytvořena")
      onSuccess(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznámá chyba")
      toast.error("Nepodařilo se uložit reflexi")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="month">Měsíc reflexe</Label>
        {initial ? (
          <Input id="month" value={monthLabel(month)} disabled />
        ) : (
          <select
            id="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {availableMonths().map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="what-went-well">Co se povedlo</Label>
        <Textarea
          id="what-went-well"
          value={whatWentWell}
          onChange={(e) => setWhatWentWell(e.target.value)}
          placeholder="Úspěchy a pozitiva za uplynulý měsíc"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="what-didnt-go-well">Co se nepovedlo</Label>
        <Textarea
          id="what-didnt-go-well"
          value={whatDidntGoWell}
          onChange={(e) => setWhatDidntGoWell(e.target.value)}
          placeholder="Problémy a výzvy, které nastaly"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="what-we-do-differently">Co uděláme jinak</Label>
        <Textarea
          id="what-we-do-differently"
          value={whatWeDoDifferently}
          onChange={(e) => setWhatWeDoDifferently(e.target.value)}
          placeholder="Změny přístupu do budoucna"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="action-steps">Plánované akční kroky</Label>
        <Textarea
          id="action-steps"
          value={plannedActionSteps}
          onChange={(e) => setPlannedActionSteps(e.target.value)}
          placeholder="Konkrétní kroky ke zlepšení"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="responsible-person">Zodpovědná osoba za AK</Label>
        <Input
          id="responsible-person"
          value={responsiblePerson}
          onChange={(e) => setResponsiblePerson(e.target.value)}
          placeholder="Jméno člena týmu"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Zrušit
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {initial ? "Uložit změny" : "Vytvořit reflexi"}
        </Button>
      </div>
    </form>
  )
}
