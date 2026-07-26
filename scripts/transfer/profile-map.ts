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
 */
export function buildProfileMap(
  source: readonly ProfileIdentity[],
  target: readonly ProfileIdentity[],
): ProfileMap {
  const targetByEmail = new Map<string, string>();
  for (const profile of target) {
    targetByEmail.set(normalizeEmail(profile.work_email), profile.id);
  }

  const byId = new Map<string, string>();
  const collisions: ProfileCollision[] = [];
  const insertIds = new Set<string>();

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
