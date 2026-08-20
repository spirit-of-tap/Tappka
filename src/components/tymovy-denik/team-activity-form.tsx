"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { TeamActivity, TeamActivityWithCreator } from "@/lib/tymovy-denik/types"
import { ACTIVITY_WITH_CREATOR_SELECT } from "@/lib/tymovy-denik/types"

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

interface TeamActivityFormProps {
  teamId: string
  profileId: string
  initial?: TeamActivity
  onSuccess: (activity: TeamActivityWithCreator) => void
  onCancel: () => void
}

export function TeamActivityForm({ teamId, profileId, initial, onSuccess, onCancel }: TeamActivityFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [occurredAt, setOccurredAt] = useState(initial?.occurred_at ?? today())
  const [activityType, setActivityType] = useState(initial?.activity_type ?? "")
  const [participants, setParticipants] = useState(initial?.participants ?? "")
  const [reason, setReason] = useState(initial?.reason ?? "")
  const [reflection, setReflection] = useState(initial?.reflection ?? "")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!occurredAt) { setError("Zadejte datum akce."); return }
    if (!activityType.trim()) { setError("Zadejte typ akce."); return }

    setLoading(true)
    try {
      const supabase = createClient()
      const base = {
        team_id: teamId,
        occurred_at: occurredAt,
        activity_type: activityType.trim(),
        participants: participants.trim() || null,
        reason: reason.trim() || null,
        reflection: reflection.trim() || null,
        updated_by_profile_id: profileId,
      }

      let data: TeamActivityWithCreator
      if (initial?.id) {
        const result = await supabase
          .from("team_activities")
          .update(base)
          .eq("id", initial.id)
          .select(ACTIVITY_WITH_CREATOR_SELECT)
          .single()
        if (result.error) throw result.error
        data = result.data as TeamActivityWithCreator
        toast.success("Akce aktualizována")
      } else {
        const result = await supabase
          .from("team_activities")
          .insert({ ...base, created_by_profile_id: profileId })
          .select(ACTIVITY_WITH_CREATOR_SELECT)
          .single()
        if (result.error) throw result.error
        data = result.data as TeamActivityWithCreator
        toast.success("Akce přidána")
      }

      onSuccess(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznámá chyba")
      toast.error("Nepodařilo se uložit akci")
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
        <Label htmlFor="occurred-at">Datum</Label>
        <Input
          id="occurred-at"
          type="date"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="activity-type">Typ akce</Label>
        <Input
          id="activity-type"
          value={activityType}
          onChange={(e) => setActivityType(e.target.value)}
          placeholder="Např. Cabin in the Woods, Learning Circus, team building"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="participants">Účast</Label>
        <Input
          id="participants"
          value={participants}
          onChange={(e) => setParticipants(e.target.value)}
          placeholder="Kdo se zúčastnil — např. celý tým, jména"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Proč jsme tam byli</Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Cíl akce, co jsme chtěli zjistit nebo vyřešit"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reflection">Co jsme si odnesli?</Label>
        <Textarea
          id="reflection"
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="Přínos, postřeh nebo poučení z akce"
          rows={3}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Zrušit
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {initial?.id ? "Uložit změny" : "Přidat akci"}
        </Button>
      </div>
    </form>
  )
}
