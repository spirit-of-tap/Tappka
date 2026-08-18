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
import { TOOL_TYPES, getToolTypeInfo } from "@/lib/nastroje-techniky/constants"
import type { ToolType } from "@/lib/nastroje-techniky/constants"
import type { ToolTechnique } from "@/lib/nastroje-techniky/types"

interface ToolTechniqueFormProps {
  profileId: string
  initial?: ToolTechnique
  onSuccess: (item: ToolTechnique) => void
  onCancel: () => void
}

export function ToolTechniqueForm({ profileId, initial, onSuccess, onCancel }: ToolTechniqueFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toolType, setToolType] = useState<ToolType | "">(initial?.tool_type ?? "")
  const [name, setName] = useState(initial?.name ?? "")
  const [reflection, setReflection] = useState(initial?.reflection ?? "")

  const selectedTypeInfo = toolType ? getToolTypeInfo(toolType) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!toolType) { setError("Vyber oblast (model, technika nebo nástroj)."); return }
    if (!name.trim()) { setError("Zadej název."); return }
    if (!reflection.trim()) { setError("Doplň vlastní reflexi."); return }

    setLoading(true)
    try {
      const supabase = createClient()
      const base = {
        tool_type: toolType,
        name: name.trim(),
        reflection: reflection.trim(),
        updated_by_profile_id: profileId,
      }

      let data: ToolTechnique
      if (initial?.id) {
        const result = await supabase
          .from("tools_techniques")
          .update(base)
          .eq("id", initial.id)
          .select("*")
          .single()
        if (result.error) throw result.error
        data = result.data as ToolTechnique
        toast.success("Záznam aktualizován")
      } else {
        const result = await supabase
          .from("tools_techniques")
          .insert({ ...base, profile_id: profileId, created_by_profile_id: profileId })
          .select("*")
          .single()
        if (result.error) throw result.error
        data = result.data as ToolTechnique
        toast.success("Záznam přidán")
      }

      onSuccess(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznámá chyba")
      toast.error("Nepodařilo se uložit záznam")
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
        <Label htmlFor="tool-type">Oblast *</Label>
        <Select value={toolType} onValueChange={(v) => setToolType(v as ToolType)}>
          <SelectTrigger id="tool-type">
            <SelectValue placeholder="Vyber oblast" />
          </SelectTrigger>
          <SelectContent>
            {TOOL_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <span className="flex flex-col gap-0.5 py-0.5">
                  <span className="font-medium">{type.label}</span>
                  <span className="text-xs text-muted-foreground">{type.description}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedTypeInfo && (
          <p className="text-xs text-muted-foreground">
            {selectedTypeInfo.description} → {selectedTypeInfo.benefit}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Název *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Např. SWOT, brainstorming, Trello"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reflection">Vlastní reflexe *</Label>
        <Textarea
          id="reflection"
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="Kdy a jak ho používáš, co ti přináší a jak ho hodnotíš"
          rows={4}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Zrušit
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {initial?.id ? "Uložit změny" : "Přidat záznam"}
        </Button>
      </div>
    </form>
  )
}
