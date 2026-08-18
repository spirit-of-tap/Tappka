"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE } from "@/lib/storage/validation"
import type { PersonalityTest } from "@/lib/personality-tests/types"
import { PERSONALITY_TEST_TYPES, PERSONALITY_TEST_TYPE_LABELS } from "@/lib/personality-tests/types"

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

interface PersonalityTestFormProps {
  profileId: string
  initial?: PersonalityTest
  onSuccess: (test: PersonalityTest) => void
  onCancel: () => void
}

export function PersonalityTestForm({ profileId, initial, onSuccess, onCancel }: PersonalityTestFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testType, setTestType] = useState<string>(initial?.test_type ?? "")
  const [testTypeOther, setTestTypeOther] = useState(initial?.test_type_other ?? "")
  const [testedOn, setTestedOn] = useState(initial?.tested_on ?? today())
  const [file, setFile] = useState<File | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!(PERSONALITY_TEST_TYPES as readonly string[]).includes(testType)) {
      setError("Vyberte typ testu.")
      return
    }
    if (testType === "other" && !testTypeOther.trim()) {
      setError("Zadejte název testu.")
      return
    }
    if (!testedOn) {
      setError("Zadejte datum testu.")
      return
    }
    if (!initial && !file) {
      setError("Nahrajte soubor s výsledky.")
      return
    }
    if (file && !(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(file.type)) {
      setError("Povolené formáty: PDF, PNG, JPEG, WebP.")
      return
    }
    if (file && file.size > MAX_DOCUMENT_SIZE) {
      setError(`Maximální velikost souboru je ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB.`)
      return
    }

    setLoading(true)
    try {
      let newKey: string | null = null
      let fileName: string | null = null
      let fileSize: number | null = null

      if (file) {
        const presignRes = await fetch("/api/storage/presign-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: "personality-test",
            entityId: profileId,
            contentType: file.type,
            fileSize: file.size,
          }),
        })
        const presignJson = await presignRes.json()
        if (!presignRes.ok || !presignJson.data) {
          throw new Error(presignJson.error ?? "Nepodařilo se připravit nahrávání")
        }
        const { url, key } = presignJson.data as { url: string; key: string }

        const putRes = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        })
        if (!putRes.ok) throw new Error("Nepodařilo se nahrát soubor")

        newKey = key
        fileName = file.name
        fileSize = file.size
      }

      let result: PersonalityTest
      if (initial?.id) {
        const patchRes = await fetch(`/api/personality-tests/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            testType,
            testTypeOther: testType === "other" ? testTypeOther.trim() : null,
            testedOn,
            ...(newKey ? { newKey, fileName, fileSize } : {}),
          }),
        })
        const patchJson = await patchRes.json()
        if (!patchRes.ok) throw new Error(patchJson.error ?? "Nepodařilo se uložit změny")
        result = patchJson.data as PersonalityTest
        toast.success("Test aktualizován")
      } else {
        const createRes = await fetch("/api/personality-tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId,
            key: newKey!,
            testType,
            testTypeOther: testType === "other" ? testTypeOther.trim() : null,
            testedOn,
            fileName,
            fileSize,
          }),
        })
        const createJson = await createRes.json()
        if (!createRes.ok) throw new Error(createJson.error ?? "Nepodařilo se uložit test")
        result = createJson.data as PersonalityTest
        toast.success("Test nahrán")
      }

      onSuccess(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznámá chyba")
      toast.error("Nepodařilo se uložit test")
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
        <Label htmlFor="test-type">Typ testu</Label>
        <Select value={testType} onValueChange={setTestType}>
          <SelectTrigger id="test-type" className="w-full">
            <SelectValue placeholder="Vyberte typ testu" />
          </SelectTrigger>
          <SelectContent>
            {PERSONALITY_TEST_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {PERSONALITY_TEST_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {testType === "other" && (
        <div className="space-y-2">
          <Label htmlFor="test-type-other">Název testu</Label>
          <Input
            id="test-type-other"
            value={testTypeOther}
            onChange={(e) => setTestTypeOther(e.target.value)}
            placeholder="Např. Hogan Assessment"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="tested-on">Datum testu</Label>
        <Input
          id="tested-on"
          type="date"
          value={testedOn}
          onChange={(e) => setTestedOn(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="test-file">Soubor s výsledky</Label>
        <Input
          id="test-file"
          type="file"
          accept=".pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          {initial?.file_name
            ? `Aktuální soubor: ${initial.file_name} — nový soubor ho nahradí.`
            : `PDF, PNG, JPEG nebo WebP · max ${MAX_DOCUMENT_SIZE / 1024 / 1024} MB`}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Zrušit
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {initial?.id ? "Uložit změny" : "Nahrát test"}
        </Button>
      </div>
    </form>
  )
}
