"use client"

import { useEffect, useRef, useState } from "react"
import { ImagePlus, Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { optimizeImageToFit } from "@/lib/storage/image-optimizer"
import { getTransformedImageUrl } from "@/lib/storage/public-url"
import { ALLOWED_IMAGE_TYPES } from "@/lib/storage/validation"
import { TEAM_ACTIVITY_IMAGE } from "@/lib/tymovy-denik/image"
import type { TeamActivity, TeamActivityWithCreator, TeamMemberProfile } from "@/lib/tymovy-denik/types"
import type { TeamActivityAttendeeInput } from "@/app/api/tymovy-denik/activities/_shared"
import { AttendanceSelector } from "./attendance-selector"

const PREVIEW_WIDTH = 352
const PREVIEW_HEIGHT = 224

interface TeamActivityMutationResponse {
  data?: TeamActivityWithCreator
  error?: string
}

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

interface TeamActivityFormProps {
  initial?: TeamActivity | TeamActivityWithCreator
  teamMembers?: TeamMemberProfile[]
  onSuccess: (activity: TeamActivityWithCreator) => void
  onCancel: () => void
}

export function TeamActivityForm({
  initial,
  teamMembers = [],
  onSuccess,
  onCancel,
}: TeamActivityFormProps) {
  const initialAttendees: TeamActivityAttendeeInput[] =
    (initial as TeamActivityWithCreator | undefined)?.attendees?.map((a) => ({
      profileId: a.profile_id,
      status: a.status,
    })) ?? (initial ? [] : teamMembers.map((m) => ({ profileId: m.id, status: "present" as const })))

  const [loading, setLoading] = useState(false)
  const [optimizingPhoto, setOptimizingPhoto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [occurredAt, setOccurredAt] = useState(initial?.occurred_at ?? today())
  const [activityType, setActivityType] = useState(initial?.activity_type ?? "")
  const [attendees, setAttendees] = useState<TeamActivityAttendeeInput[]>(initialAttendees)
  const [reason, setReason] = useState(initial?.reason ?? "")
  const [reflection, setReflection] = useState(initial?.reflection ?? "")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoSelectionRef = useRef(0)
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false)

  useEffect(() => {
    if (!pendingPhoto) {
      setPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(pendingPhoto)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [pendingPhoto])

  const currentPhotoSrc =
    previewUrl ??
    (initial?.image_path && !removeExistingPhoto
      ? getTransformedImageUrl("images", initial.image_path, {
          width: PREVIEW_WIDTH,
          height: PREVIEW_HEIGHT,
          quality: 72,
          resize: "cover",
        })
      : null)

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Povolené formáty: JPEG, PNG, WebP")
      return
    }
    if (file.size > TEAM_ACTIVITY_IMAGE.maxSourceBytes) {
      toast.error("Maximální velikost souboru je 10 MB")
      return
    }

    const selectionId = ++photoSelectionRef.current
    setOptimizingPhoto(true)
    try {
      const optimized = await optimizeImageToFit(file, {
        maxEdge: TEAM_ACTIVITY_IMAGE.maxEdge,
        quality: TEAM_ACTIVITY_IMAGE.quality,
        format: "image/webp",
      })
      if (selectionId !== photoSelectionRef.current) return
      if (optimized.size > TEAM_ACTIVITY_IMAGE.maxUploadBytes) {
        toast.error("Fotografii se nepodařilo zmenšit pod 3 MB")
        return
      }

      setPendingPhoto(optimized)
      setRemoveExistingPhoto(false)
    } catch {
      if (selectionId === photoSelectionRef.current) {
        toast.error("Fotografii se nepodařilo zpracovat")
      }
    } finally {
      if (selectionId === photoSelectionRef.current) setOptimizingPhoto(false)
    }
  }

  function handleRemovePhoto() {
    photoSelectionRef.current += 1
    setPendingPhoto(null)
    setRemoveExistingPhoto(Boolean(initial?.image_path))
    setOptimizingPhoto(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!occurredAt) { setError("Zadejte datum akce."); return }
    if (!activityType.trim()) { setError("Zadejte typ akce."); return }

    setLoading(true)
    try {
      const payload = {
        occurredAt,
        activityType: activityType.trim(),
        participants: null,
        attendees,
        reason: reason.trim(),
        reflection: reflection.trim(),
        photoAction: pendingPhoto ? "replace" : removeExistingPhoto ? "remove" : "keep",
        ...(initial ? { expectedUpdatedAt: initial.updated_at } : {}),
      }
      const formData = new FormData()
      formData.set("payload", JSON.stringify(payload))
      if (pendingPhoto) formData.set("photo", pendingPhoto)

      const response = await fetch(
        initial ? `/api/tymovy-denik/activities/${initial.id}` : "/api/tymovy-denik/activities",
        { method: initial ? "PATCH" : "POST", body: formData },
      )
      const body = await response.json().catch(() => null) as TeamActivityMutationResponse | null
      if (!response.ok) throw new Error(body?.error ?? "Akci se nepodařilo uložit")
      if (!body?.data) throw new Error("Server nevrátil uloženou akci")

      toast.success(initial ? "Akce aktualizována" : "Akce přidána")
      onSuccess(body.data)
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
        <Label htmlFor="activity-photo">Fotografie</Label>
        <input
          ref={fileInputRef}
          id="activity-photo"
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={handlePhotoChange}
          aria-label="Vybrat fotografii"
          disabled={loading || optimizingPhoto}
        />
        {currentPhotoSrc ? (
          <div className="space-y-2">
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentPhotoSrc}
                alt=""
                width={PREVIEW_WIDTH / 2}
                height={PREVIEW_HEIGHT / 2}
                className="h-28 w-44 rounded-lg border border-border/50 object-cover"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute -right-2 -top-2 size-7 rounded-full bg-background"
                onClick={handleRemovePhoto}
                aria-label="Odebrat fotografii"
                disabled={loading || optimizingPhoto}
              >
                <X className="size-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || optimizingPhoto}
            >
              <ImagePlus className="size-4" />
              Nahradit fotografii
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || optimizingPhoto}
          >
            {optimizingPhoto ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {optimizingPhoto ? "Zpracovávám fotografii…" : "Přidat fotografii"}
          </Button>
        )}
        {pendingPhoto && (
          <p className="text-xs text-muted-foreground">Fotografie se nahraje při uložení.</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            placeholder="Např. Cabin in the Woods, Learning Circus"
          />
        </div>
      </div>

      <AttendanceSelector
        teamMembers={teamMembers}
        value={attendees}
        onChange={setAttendees}
        disabled={loading}
      />

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
        <Button type="submit" disabled={loading || optimizingPhoto}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {initial?.id ? "Uložit změny" : "Přidat akci"}
        </Button>
      </div>
    </form>
  )
}
