"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { optimizeImageToFit } from "@/lib/storage/image-optimizer"
import { getPublicStorageUrl } from "@/lib/storage/public-url"
import type { TeamActivity, TeamActivityWithCreator } from "@/lib/tymovy-denik/types"
import { ACTIVITY_WITH_CREATOR_SELECT } from "@/lib/tymovy-denik/types"

/** Photos are downscaled client-side before upload (longest edge, px). */
const PHOTO_MAX_EDGE = 1600

interface PendingPhoto {
  file: File
  previewUrl: string
}

interface RemovedPhoto {
  key: string
}

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null)
  const [removedPhoto, setRemovedPhoto] = useState<RemovedPhoto | null>(
    initial?.image_path ? { key: initial.image_path } : null,
  )

  const currentPhotoSrc =
    pendingPhoto?.previewUrl ??
    (initial?.image_path && !removedPhoto
      ? getPublicStorageUrl("images", initial.image_path)
      : null)

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Povolené formáty: JPEG, PNG, WebP")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Maximální velikost souboru je 10MB")
      return
    }
    setPendingPhoto({ file, previewUrl: URL.createObjectURL(file) })
    setRemovedPhoto(initial?.image_path ? { key: initial.image_path } : null)
  }

  function handleRemovePhoto() {
    setPendingPhoto(null)
    setRemovedPhoto(initial?.image_path ? { key: initial.image_path } : null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  /** Uploads the pending photo (if any); returns its storage key. */
  async function uploadPendingPhoto(): Promise<string | null> {
    if (!pendingPhoto) return null

    const optimized = await optimizeImageToFit(pendingPhoto.file, {
      maxEdge: PHOTO_MAX_EDGE,
      quality: 0.82,
      format: "image/webp",
    })

    const formData = new FormData()
    formData.set("file", optimized)
    formData.set("teamId", teamId)
    const response = await fetch("/api/tymovy-denik/upload-image", {
      method: "POST",
      body: formData,
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.error ?? "Nahrávání fotky selhalo")
    }
    const { key } = await response.json()
    return key as string
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!occurredAt) { setError("Zadejte datum akce."); return }
    if (!activityType.trim()) { setError("Zadejte typ akce."); return }

    setLoading(true)
    try {
      const supabase = createClient()

      // Photo resolution order: newly uploaded wins; explicit removal clears;
      // otherwise keep whatever the row already references.
      const imagePathFromUpload = await uploadPendingPhoto()
      const imagePath = imagePathFromUpload ?? (removedPhoto ? null : initial?.image_path ?? null)

      const base = {
        team_id: teamId,
        occurred_at: occurredAt,
        activity_type: activityType.trim(),
        participants: participants.trim() || null,
        reason: reason.trim() || null,
        reflection: reflection.trim() || null,
        image_path: imagePath,
        updated_by_profile_id: profileId,
      }

      // Best-effort cleanup of a replaced/removed photo's old object.
      const oldKey = removedPhoto?.key
      if (oldKey && oldKey !== base.image_path) {
        void supabase.storage.from("images").remove([oldKey]).catch(() => {})
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
        <Label>Fotografie</Label>
        {currentPhotoSrc ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPhotoSrc}
              alt="Fotografie akce"
              className="h-28 w-44 rounded-lg border border-border/50 object-cover"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute -right-2 -top-2 size-7 rounded-full bg-background"
              onClick={handleRemovePhoto}
              aria-label="Odebrat fotografii"
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="size-4" />
              Přidat fotografii
            </Button>
          </>
        )}
        {pendingPhoto && (
          <p className="text-xs text-muted-foreground">Fotografie se nahraje při uložení.</p>
        )}
      </div>

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
