"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { TeamReflection } from "@/lib/tymova-reflexe/types"

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
}

export function TeamReflectionForm({ teamId, profileId }: TeamReflectionFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(getCurrentMonth())
  const [whatWentWell, setWhatWentWell] = useState("")
  const [whatDidntGoWell, setWhatDidntGoWell] = useState("")
  const [whatWeDoDifferently, setWhatWeDoDifferently] = useState("")
  const [plannedActionSteps, setPlannedActionSteps] = useState("")
  const [responsiblePerson, setResponsiblePerson] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Nepřihlášen")

      const { data: inserted, error: insertError } = await supabase
        .from("team_reflections")
        .insert({
          team_id: teamId,
          month,
          what_went_well: whatWentWell.trim() || null,
          what_didnt_go_well: whatDidntGoWell.trim() || null,
          what_we_do_differently: whatWeDoDifferently.trim() || null,
          planned_action_steps: plannedActionSteps.trim() || null,
          responsible_person: responsiblePerson.trim() || null,
          created_by_profile_id: profileId,
          updated_by_profile_id: profileId,
        })
        .select("id")
        .single()

      if (insertError) throw insertError

      toast.success("Reflexe vytvořena")
      router.push(`/tymova-reflexe/${inserted.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznámá chyba")
      toast.error("Nepodařilo se vytvořit reflexi")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="month">Měsíc reflexe</Label>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="what-went-well">Co se povedlo</Label>
          <Textarea
            id="what-went-well"
            value={whatWentWell}
            onChange={(e) => setWhatWentWell(e.target.value)}
            placeholder="Úspěchy a pozitiva za uplynulý měsíc"
            rows={5}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="what-didnt-go-well">Co se nepovedlo</Label>
          <Textarea
            id="what-didnt-go-well"
            value={whatDidntGoWell}
            onChange={(e) => setWhatDidntGoWell(e.target.value)}
            placeholder="Problémy a výzvy, které nastaly"
            rows={5}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="what-we-do-differently">Co uděláme jinak</Label>
        <Textarea
          id="what-we-do-differently"
          value={whatWeDoDifferently}
          onChange={(e) => setWhatWeDoDifferently(e.target.value)}
          placeholder="Změny přístupu do budoucna"
          rows={4}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="action-steps">Plánované akční kroky</Label>
          <Textarea
            id="action-steps"
            value={plannedActionSteps}
            onChange={(e) => setPlannedActionSteps(e.target.value)}
            placeholder="Konkrétní kroky ke zlepšení"
            rows={4}
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
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/tymova-reflexe")}>
          Zrušit
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          Vytvořit reflexi
        </Button>
      </div>
    </form>
  )
}
