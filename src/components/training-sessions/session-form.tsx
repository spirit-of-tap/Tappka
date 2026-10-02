"use client"

import { Calendar, Check, Info, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { ProfileAvatar } from "@/components/profile-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { pragueLocalToUtcISO } from "@/lib/reservations/utils"
import { TS_LIMITS, TS_ROUTES } from "@/lib/training-sessions/constants"
import { pragueDateKey, toTimeInputValue } from "@/lib/training-sessions/format"
import type { UpcomingSlot } from "@/lib/training-sessions/slots"
import { FACILITATOR_REQUIRED_MESSAGE } from "@/lib/training-sessions/validation"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"

import { SlotChips } from "./slot-chips"

const FACILITATOR_ERROR_ID = "ts-facilitator-error"
const NO_ROOM = "none"

export interface SessionFormValues {
  topic: string
  description: string
  date: string
  startTime: string
  endTime: string
  roomId: string | null
  locationNote: string
  guestCapacity: number
  facilitatorIds: string[]
}

interface SessionFormProps {
  mode: { kind: "create" } | { kind: "edit"; id: string }
  initial: SessionFormValues
  rooms: { id: string; code: string; name: string }[]
  teamMembers: TeamMemberProfile[]
  slots: UpcomingSlot[]
}

export function SessionForm({ mode, initial, rooms, teamMembers, slots }: SessionFormProps) {
  const router = useRouter()
  const [values, setValues] = useState(initial)
  const [pending, setPending] = useState(false)
  const [facilitatorError, setFacilitatorError] = useState(false)
  const set = <K extends keyof SessionFormValues>(key: K, value: SessionFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  function pickSlot(slot: UpcomingSlot) {
    setValues((v) => ({
      ...v,
      date: pragueDateKey(slot.startsAt),
      startTime: toTimeInputValue(slot.startsAt),
      endTime: toTimeInputValue(slot.endsAt),
      roomId: slot.roomId,
    }))
  }

  function toggleFacilitator(id: string) {
    setFacilitatorError(false)
    set(
      "facilitatorIds",
      values.facilitatorIds.includes(id) ? values.facilitatorIds.filter((x) => x !== id) : [...values.facilitatorIds, id],
    )
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (values.facilitatorIds.length === 0) {
      setFacilitatorError(true)
      return
    }
    setPending(true)
    try {
      const payload = {
        topic: values.topic,
        description: values.description,
        startsAt: pragueLocalToUtcISO(values.date, values.startTime),
        endsAt: pragueLocalToUtcISO(values.date, values.endTime),
        roomId: values.roomId,
        locationNote: values.locationNote,
        guestCapacity: values.guestCapacity,
        facilitatorIds: values.facilitatorIds,
      }
      const res = await fetch(mode.kind === "create" ? "/api/training-sessions" : `/api/training-sessions/${mode.id}`, {
        method: mode.kind === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode.kind === "create" ? payload : { kind: "update", ...payload }),
      })
      const body = (await res.json().catch(() => ({}))) as { data?: { id: string }; error?: string }
      if (!res.ok || !body.data) {
        toast.error(body.error ?? "TS se nepodařilo uložit")
        setPending(false)
        return
      }
      toast.success(mode.kind === "create" ? "TS vytvořeno" : "TS uloženo")
      router.push(TS_ROUTES.detail(body.data.id))
      router.refresh()
    } catch {
      toast.error("TS se nepodařilo uložit")
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {mode.kind === "create" && <SlotChips slots={slots} rooms={rooms} onPick={pickSlot} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Info className="size-4 text-primary" aria-hidden />
            <span>Základní informace</span>
          </CardTitle>
          <CardDescription>Pojmenuj setkání a stručně popiš jeho záměr pro tým i hostující.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ts-topic">Téma</Label>
            <Input
              id="ts-topic"
              required
              maxLength={TS_LIMITS.topicMax}
              placeholder="např. Zpětná vazba na projekty, AI nástroje…"
              value={values.topic}
              onChange={(e) => set("topic", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ts-description">Krátký popis</Label>
            <Textarea
              id="ts-description"
              maxLength={TS_LIMITS.descriptionMax}
              placeholder="Co se bude na TS probírat a čeho chcete dosáhnout?"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="size-4 text-primary" aria-hidden />
            <span>Termín a místo</span>
          </CardTitle>
          <CardDescription>Kdy a kde se setkání uskuteční.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="ts-date">Datum</Label>
              <Input id="ts-date" type="date" required value={values.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ts-start">Začátek</Label>
              <Input id="ts-start" type="time" required value={values.startTime} onChange={(e) => set("startTime", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ts-end">Konec</Label>
              <Input id="ts-end" type="time" required value={values.endTime} onChange={(e) => set("endTime", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ts-room">Místnost</Label>
              <Select value={values.roomId ?? NO_ROOM} onValueChange={(v) => set("roomId", v === NO_ROOM ? null : v)}>
                <SelectTrigger id="ts-room" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ROOM}>Bez místnosti</SelectItem>
                  {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ts-location">Poznámka k místu</Label>
              <Input
                id="ts-location"
                maxLength={TS_LIMITS.locationNoteMax}
                placeholder="např. venku v parku, online na Meetu…"
                value={values.locationNote}
                onChange={(e) => set("locationNote", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="size-4 text-primary" aria-hidden />
            <span>Facilitace a kapacita</span>
          </CardTitle>
          <CardDescription>Kdo setkání vede a kolik míst nabízíte pro členy jiných týmů.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset className="space-y-2" aria-describedby={facilitatorError ? FACILITATOR_ERROR_ID : undefined}>
            <legend className="text-sm font-medium">Facilitace (vyber aspoň jednu osobu)</legend>
            <div className="flex flex-wrap gap-2">
              {teamMembers.map((m) => {
                const selected = values.facilitatorIds.includes(m.id)
                return (
                  <Button
                    key={m.id}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    aria-pressed={selected}
                    className="gap-2"
                    onClick={() => toggleFacilitator(m.id)}
                  >
                    <span aria-hidden="true" className="inline-flex shrink-0">
                      <ProfileAvatar picture={m.picture} name={m.name} size={18} />
                    </span>
                    <span>{m.name ?? "Bez jména"}</span>
                    {selected && <Check className="size-3.5 shrink-0" aria-hidden />}
                  </Button>
                )
              })}
            </div>
            {facilitatorError && (
              <p id={FACILITATOR_ERROR_ID} role="alert" className="text-sm font-medium text-destructive">
                {FACILITATOR_REQUIRED_MESSAGE}
              </p>
            )}
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="ts-capacity">Místa pro jiné týmy</Label>
            <div className="flex items-center gap-3">
              <Input
                id="ts-capacity"
                type="number"
                min={0}
                max={TS_LIMITS.guestCapacityMax}
                className="w-32"
                value={values.guestCapacity}
                onChange={(e) => set("guestCapacity", e.target.value === "" ? 0 : Number(e.target.value))}
              />
              <div className="flex flex-wrap gap-1.5">
                {[0, 1, 2, 3, 5].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={values.guestCapacity === preset ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => set("guestCapacity", preset)}
                  >
                    {preset === 0 ? "Jen pro tým (0)" : `${preset} ${preset === 1 ? "místo" : preset < 5 ? "místa" : "míst"}`}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Zadej 0, pokud je setkání určeno pouze pro tvůj tým. Jinak se volná místa zobrazí v sekci Objevovat.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {mode.kind === "create" ? "Vytvořit TS" : "Uložit změny"}
        </Button>
        <Button asChild variant="outline">
          <Link href={mode.kind === "create" ? TS_ROUTES.overview : TS_ROUTES.detail(mode.id)}>
            Zrušit
          </Link>
        </Button>
      </div>
    </form>
  )
}

