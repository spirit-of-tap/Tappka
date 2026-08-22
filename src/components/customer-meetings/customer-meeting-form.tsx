"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { CustomerMeeting } from "@/lib/customer-meetings/types"

/** Formats a Date for the datetime-local `max`/`value` attributes (local time). */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

interface CustomerMeetingFormProps {
  profileId: string
  initial?: Partial<CustomerMeeting>
  onSuccess: (meeting: CustomerMeeting) => void
  onCancel: () => void
}

export function CustomerMeetingForm({ profileId, initial, onSuccess, onCancel }: CustomerMeetingFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [company, setCompany] = useState(initial?.company ?? "")
  const [contactPerson, setContactPerson] = useState(initial?.contact_person ?? "")
  const [position, setPosition] = useState(initial?.position ?? "")
  const [meetingAt, setMeetingAt] = useState(
    initial?.meeting_at ? initial.meeting_at.slice(0, 16) : "",
  )
  const [objective, setObjective] = useState(initial?.objective ?? "")
  const [postMortem, setPostMortem] = useState(initial?.post_mortem ?? "")
  const [teamShare, setTeamShare] = useState(initial?.team_share ?? "")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!company.trim()) { setError("Společnost je povinná"); return }
    if (!contactPerson.trim()) { setError("Kontaktní osoba je povinná"); return }
    if (!objective.trim()) { setError("Cíl schůzky je povinný"); return }
    if (meetingAt && new Date(meetingAt).getTime() > Date.now()) {
      setError("Datum schůzky nemůže být v budoucnu")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { throw new Error("Nepřihlášen") }

      const isEdit = !!initial?.id
      const base = {
        company: company.trim(),
        contact_person: contactPerson.trim(),
        position: position.trim(),
        meeting_at: meetingAt || null,
        objective: objective.trim(),
        post_mortem: postMortem.trim() || null,
        team_share: teamShare.trim() || null,
        updated_by_profile_id: profileId,
      }

      let data: CustomerMeeting
      if (isEdit) {
        const result = await supabase
          .from("customer_meetings")
          .update(base)
          .eq("id", initial!.id!)
          .select()
          .single()
        if (result.error) throw result.error
        data = result.data
      } else {
        const result = await supabase
          .from("customer_meetings")
          .insert({ ...base, profile_id: profileId, created_by_profile_id: profileId })
          .select()
          .single()
        if (result.error) throw result.error
        data = result.data
      }

      toast.success(initial ? "Schůzka aktualizována" : "Schůzka vytvořena")
      onSuccess(data)
    } catch {
      setError("Nepodařilo se uložit schůzku.")
      toast.error("Nepodařilo se uložit schůzku")
    } finally {
      setLoading(false)
    }
  }

  return (
    // noValidate: our inline error box owns all messaging (consistent UI);
    // the datetime-local `max` stays as a picker hint, not a submit blocker.
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="company">Společnost *</Label>
          <Input
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Název firmy"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-person">Kontaktní osoba *</Label>
          <Input
            id="contact-person"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="Jméno a příjmení"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="position">Pozice</Label>
          <Input
            id="position"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="Např. CEO, nákupčí"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="meeting-at">Datum schůzky</Label>
        <Input
          id="meeting-at"
          type="datetime-local"
          value={meetingAt}
          max={toLocalInputValue(new Date())}
          onChange={(e) => setMeetingAt(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="objective">Cíl schůzky *</Label>
        <Textarea
          id="objective"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="Cíl schůzky vč. propojení s Learning Contractem"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-mortem">Post-mortem (follow up)</Label>
        <Textarea
          id="post-mortem"
          value={postMortem}
          onChange={(e) => setPostMortem(e.target.value)}
          placeholder="Vyhodnocení schůzky, co fungovalo, co ne"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="team-share">Co chci ze schůzky sdílet do týmu</Label>
        <Textarea
          id="team-share"
          value={teamShare}
          onChange={(e) => setTeamShare(e.target.value)}
          placeholder="Poznatky a informace pro tým"
          rows={3}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Zrušit
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {initial ? "Uložit změny" : "Vytvořit schůzku"}
        </Button>
      </div>
    </form>
  )
}
