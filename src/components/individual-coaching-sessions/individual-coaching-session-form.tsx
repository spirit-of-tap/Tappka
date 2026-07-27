"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { IndividualCoachingSession, IndividualCoachingSessionWithCoach } from "@/lib/individual-coaching-sessions/types"
import { SESSION_WITH_COACH_SELECT } from "@/lib/individual-coaching-sessions/types"
import type { Profile } from "@/lib/auth-helpers"

const EXTERNAL_COACH_VALUE = "__external__"

interface IndividualCoachingSessionFormProps {
  profileId: string
  coachProfiles: Pick<Profile, "id" | "name" | "picture">[]
  initial?: Partial<IndividualCoachingSession>
  onSuccess: (session: IndividualCoachingSessionWithCoach) => void
  onCancel: () => void
}

export function IndividualCoachingSessionForm({ profileId, coachProfiles, initial, onSuccess, onCancel }: IndividualCoachingSessionFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coachSelection, setCoachSelection] = useState(
    initial?.coach_profile_id ?? (initial?.external_coach_name ? EXTERNAL_COACH_VALUE : ""),
  )
  const [externalCoachName, setExternalCoachName] = useState(initial?.external_coach_name ?? "")
  const [sessionAt, setSessionAt] = useState(
    initial?.session_at ? initial.session_at.slice(0, 16) : "",
  )
  const [keyTakeaways, setKeyTakeaways] = useState(initial?.key_takeaways ?? "")
  const [actionSteps, setActionSteps] = useState(initial?.action_steps ?? "")

  const isExternal = coachSelection === EXTERNAL_COACH_VALUE

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!coachSelection) { setError("Vyber kouče"); return }
    if (isExternal && !externalCoachName.trim()) { setError("Zadej jméno externího kouče"); return }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { throw new Error("Nepřihlášen") }

      const isEdit = !!initial?.id
      const base = {
        coach_profile_id: isExternal ? null : coachSelection,
        external_coach_name: isExternal ? externalCoachName.trim() : null,
        session_at: sessionAt || null,
        key_takeaways: keyTakeaways.trim() || null,
        action_steps: actionSteps.trim() || null,
        updated_by_profile_id: profileId,
      }

      let data: IndividualCoachingSessionWithCoach
      if (isEdit) {
        const result = await supabase
          .from("individual_coaching_sessions")
          .update(base)
          .eq("id", initial!.id!)
          .select(SESSION_WITH_COACH_SELECT)
          .single()
        if (result.error) throw result.error
        data = result.data as IndividualCoachingSessionWithCoach
      } else {
        const result = await supabase
          .from("individual_coaching_sessions")
          .insert({ ...base, profile_id: profileId, created_by_profile_id: profileId })
          .select(SESSION_WITH_COACH_SELECT)
          .single()
        if (result.error) throw result.error
        data = result.data as IndividualCoachingSessionWithCoach
      }

      toast.success(initial ? "Sezení aktualizováno" : "Sezení vytvořeno")
      onSuccess(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznámá chyba")
      toast.error("Nepodařilo se uložit sezení")
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="coach-select">Kouč *</Label>
          <Select value={coachSelection} onValueChange={setCoachSelection}>
            <SelectTrigger id="coach-select">
              <SelectValue placeholder="Vyber kouče" />
            </SelectTrigger>
            <SelectContent>
              {coachProfiles.map((coach) => (
                <SelectItem key={coach.id} value={coach.id}>
                  {coach.name}
                </SelectItem>
              ))}
              <SelectItem value={EXTERNAL_COACH_VALUE}>Někdo mimo tým</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="session-at">Datum sezení</Label>
          <Input
            id="session-at"
            type="datetime-local"
            value={sessionAt}
            onChange={(e) => setSessionAt(e.target.value)}
          />
        </div>
      </div>

      {isExternal && (
        <div className="space-y-2">
          <Label htmlFor="external-coach-name">Jméno externího kouče *</Label>
          <Input
            id="external-coach-name"
            value={externalCoachName}
            onChange={(e) => setExternalCoachName(e.target.value)}
            placeholder="Jméno a příjmení"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="key-takeaways">Co jsem si odnesl / uvědomění</Label>
        <Textarea
          id="key-takeaways"
          value={keyTakeaways}
          onChange={(e) => setKeyTakeaways(e.target.value)}
          placeholder="Hlavní myšlenky a insighty ze sezení"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="action-steps">Akční kroky po koučování</Label>
        <Textarea
          id="action-steps"
          value={actionSteps}
          onChange={(e) => setActionSteps(e.target.value)}
          placeholder="Konkrétní úkoly a kroky, které z koučování vyplynuly"
          rows={3}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Zrušit
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {initial ? "Uložit změny" : "Vytvořit sezení"}
        </Button>
      </div>
    </form>
  )
}
