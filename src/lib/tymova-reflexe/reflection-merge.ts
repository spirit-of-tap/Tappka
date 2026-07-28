/**
 * Generic per-field autosave helpers shared by the monthly team reflection
 * and the semester reflection topic entries. Both are "many people may have
 * this open at once, one autosaves per field" documents, so both need the
 * same protection: never let an incoming save from someone else clobber a
 * field the local user has an unsaved edit in.
 */

type FieldRecord<F extends string> = Record<F, string | null>

/**
 * Builds a partial update payload containing only the fields the user has
 * actually touched, so a save never overwrites a field someone else edited.
 */
export function buildSavePayload<F extends string>(
  current: FieldRecord<F>,
  dirtyFields: ReadonlySet<F>,
): Partial<Record<F, string | null>> {
  const payload: Partial<Record<F, string | null>> = {}
  for (const field of dirtyFields) {
    const trimmed = current[field]?.trim() ?? ""
    payload[field] = trimmed || null
  }
  return payload
}

export function fieldsUnchangedSince<F extends string>(
  snapshot: FieldRecord<F>,
  latest: FieldRecord<F>,
  fields: Iterable<F>,
): F[] {
  const unchanged: F[] = []
  for (const field of fields) {
    if (snapshot[field] === latest[field]) unchanged.push(field)
  }
  return unchanged
}

export interface RecordMergeResult<T, F extends string> {
  merged: T
  conflicts: F[]
}

/**
 * Merges a broadcast update into local state. Fields the local user is
 * currently editing (unsaved) are never overwritten by the incoming value —
 * otherwise a teammate's save would wipe out mid-sentence keystrokes. If the
 * incoming value for a locally-dirty field also diverged from the baseline
 * the local edit started from, that's a genuine same-field conflict worth
 * surfacing rather than silently resolving.
 */
export function mergeIncomingRecord<T extends FieldRecord<F>, F extends string>(
  incoming: T,
  local: T,
  editableFields: readonly F[],
  dirtyFields: ReadonlySet<F>,
  baselines: Partial<Record<F, string | null>>,
): RecordMergeResult<T, F> {
  const merged: T = { ...incoming }
  const conflicts: F[] = []

  for (const field of editableFields) {
    if (!dirtyFields.has(field)) continue
    merged[field] = local[field]
    const baseline = baselines[field] ?? null
    if (incoming[field] !== baseline) conflicts.push(field)
  }

  return { merged, conflicts }
}
