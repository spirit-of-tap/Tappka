import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { buildSavePayload, fieldsUnchangedSince, mergeIncomingRecord } from "./reflection-merge"

const AUTO_SAVE_DELAY = 2000

type Identifiable<F extends string> = { id: string; updated_at: string } & Record<F, string | null>

interface UseFieldAutosaveOptions<T extends Identifiable<F>, F extends string> {
  initial: T
  fields: readonly F[]
  save: (payload: Partial<Record<F, string | null>>, current: T) => Promise<T>
  onConflict?: (fields: F[]) => void
}

/**
 * Drives a "many people may have this open at once, autosave per field"
 * editable record: debounced per-field saves, and broadcast merges that
 * never clobber a field the local user is still mid-edit on. Shared by the
 * monthly team reflection and each semester reflection topic entry.
 */
export function useFieldAutosave<T extends Identifiable<F>, F extends string>({
  initial,
  fields,
  save,
  onConflict,
}: UseFieldAutosaveOptions<T, F>) {
  const [data, setData] = useState(initial)
  const [dirtyFields, setDirtyFields] = useState<Set<F>>(new Set())
  const [saving, setSaving] = useState(false)

  const dataRef = useRef(data)
  dataRef.current = data
  const dirtyFieldsRef = useRef(dirtyFields)
  dirtyFieldsRef.current = dirtyFields
  const baselinesRef = useRef<Partial<Record<F, string | null>>>({})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSave = useCallback(async () => {
    const fieldsSnapshot = new Set(dirtyFieldsRef.current)
    if (fieldsSnapshot.size === 0) return

    const snapshotValues = dataRef.current
    const payload = buildSavePayload(snapshotValues, fieldsSnapshot)

    setSaving(true)
    try {
      const updated = await save(payload, snapshotValues)

      const unchanged = fieldsUnchangedSince(snapshotValues, dataRef.current, fieldsSnapshot)
      const remainingDirty = new Set(dirtyFieldsRef.current)
      for (const field of unchanged) remainingDirty.delete(field)
      for (const field of fieldsSnapshot) {
        if (!remainingDirty.has(field)) delete baselinesRef.current[field]
      }

      setDirtyFields(remainingDirty)
      setData((prev) => {
        const merged = { ...updated }
        for (const field of fields) {
          if (remainingDirty.has(field)) merged[field] = prev[field]
        }
        return merged
      })
    } catch {
      toast.error("Nepodařilo se uložit")
    } finally {
      setSaving(false)
    }
  }, [save, fields])

  useEffect(() => {
    if (dirtyFields.size === 0) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void doSave(), AUTO_SAVE_DELAY)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [data, dirtyFields, doSave])

  const setField = useCallback((field: F, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }))
    setDirtyFields((prev) => {
      if (prev.has(field)) return prev
      baselinesRef.current[field] = dataRef.current[field]
      const next = new Set(prev)
      next.add(field)
      return next
    })
  }, [])

  const applyIncoming = useCallback(
    (incoming: T) => {
      if (incoming.id !== dataRef.current.id) return
      if (incoming.updated_at === dataRef.current.updated_at) return

      const { merged, conflicts, nextBaselines } = mergeIncomingRecord(
        incoming,
        dataRef.current,
        fields,
        dirtyFieldsRef.current,
        baselinesRef.current,
      )
      baselinesRef.current = nextBaselines
      setData(merged)
      if (conflicts.length > 0) onConflict?.(conflicts)
    },
    [fields, onConflict],
  )

  return { data, setField, dirtyFields, saving, applyIncoming }
}
