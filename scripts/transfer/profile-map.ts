export interface ProfileIdentity {
  readonly id: string;
  readonly work_email: string;
}

export interface ProfileCollision {
  readonly workEmail: string;
  readonly sourceId: string;
  readonly targetId: string;
}

export interface ProfileMap {
  readonly byId: ReadonlyMap<string, string>;
  readonly collisions: readonly ProfileCollision[];
  readonly insertIds: ReadonlySet<string>;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Builds the source-id → target-id mapping. The collision key is
 * `profiles_work_email_key`, not the primary key (spec R2). Non-colliding
 * profiles map to themselves and are inserted verbatim.
 *
 * Throws on ambiguous matches:
 * - Two or more target profiles with the same normalized email
 * - Two or more source profiles mapping to the same target id
 */
export function buildProfileMap(
  source: readonly ProfileIdentity[],
  target: readonly ProfileIdentity[],
): ProfileMap {
  // First pass: build targetByEmail and detect duplicate target emails
  const targetByEmail = new Map<string, string>();
  const targetIdsByEmail = new Map<string, string[]>();

  for (const profile of target) {
    const email = normalizeEmail(profile.work_email);
    if (!targetIdsByEmail.has(email)) {
      targetIdsByEmail.set(email, []);
    }
    targetIdsByEmail.get(email)!.push(profile.id);
    targetByEmail.set(email, profile.id);
  }

  // Check for duplicate target emails
  for (const [email, ids] of targetIdsByEmail) {
    if (ids.length > 1) {
      throw new Error(
        `Ambiguous target profiles — normalized email "${email}" appears in profiles ${ids.join(", ")}`,
      );
    }
  }

  const byId = new Map<string, string>();
  const collisions: ProfileCollision[] = [];
  const insertIds = new Set<string>();
  const sourceIdsByTargetId = new Map<string, string[]>();

  for (const profile of source) {
    const email = normalizeEmail(profile.work_email);
    const existingId = targetByEmail.get(email);
    if (existingId === undefined) {
      byId.set(profile.id, profile.id);
      insertIds.add(profile.id);
      continue;
    }
    byId.set(profile.id, existingId);
    collisions.push({ workEmail: email, sourceId: profile.id, targetId: existingId });

    // Track source profiles mapping to the same target
    if (!sourceIdsByTargetId.has(existingId)) {
      sourceIdsByTargetId.set(existingId, []);
    }
    sourceIdsByTargetId.get(existingId)!.push(profile.id);
  }

  // Check for multiple source profiles mapping to the same target id
  for (const [targetId, sourceIds] of sourceIdsByTargetId) {
    if (sourceIds.length > 1) {
      // Get the normalized email for the error message
      const firstSourceProfile = source.find((p) => p.id === sourceIds[0])!;
      const email = normalizeEmail(firstSourceProfile.work_email);
      throw new Error(
        `Ambiguous source profiles — normalized email "${email}" maps source ids ${sourceIds.join(", ")} to target "${targetId}"`,
      );
    }
  }

  return { byId, collisions, insertIds };
}

export function remapProfileId(map: ProfileMap, id: string): string {
  const mapped = map.byId.get(id);
  if (mapped === undefined) {
    throw new Error(
      `Unmapped profile id "${id}" — it is referenced by a row but absent from source profiles`,
    );
  }
  return mapped;
}

export function remapOptionalProfileId(map: ProfileMap, id: string | null): string | null {
  return id === null ? null : remapProfileId(map, id);
}
