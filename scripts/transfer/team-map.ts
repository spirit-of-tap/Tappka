export interface TeamIdentity {
  readonly id: string;
  readonly name: string;
}

export interface TeamNameMatch {
  readonly name: string;
  readonly sourceId: string;
  readonly targetId: string;
}

export interface TeamMap {
  /** source team id -> target team id. Every source team resolves. */
  readonly byId: ReadonlyMap<string, string>;
  /** Matched on id, already identical in both environments. */
  readonly matchedById: readonly string[];
  /** Matched on normalized name but under a different id in the target. */
  readonly matchedByName: readonly TeamNameMatch[];
  /** Source teams with no target counterpart — these must be created. */
  readonly missing: readonly TeamIdentity[];
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Resolves source team ids onto target team ids.
 *
 * Preview shares team UUIDs with local, so every team matches by id and the map
 * is the identity. Production was populated independently: its team ids differ
 * entirely, some names differ only by case (`Timace`/`TIMACE`, `WEAM`/`Weam`),
 * and several source teams do not exist there at all. Matching therefore falls
 * back to the normalized name, and anything still unmatched is reported as
 * `missing` so it can be created with its source id — after which the map entry
 * is the identity.
 */
export function buildTeamMap(
  source: readonly TeamIdentity[],
  target: readonly TeamIdentity[],
): TeamMap {
  const targetIds = new Set(target.map((team) => team.id));

  const targetIdsByName = new Map<string, string[]>();
  for (const team of target) {
    const key = normalizeName(team.name);
    targetIdsByName.set(key, [...(targetIdsByName.get(key) ?? []), team.id]);
  }

  for (const [name, ids] of targetIdsByName) {
    if (ids.length > 1) {
      throw new Error(
        `Ambiguous target teams — normalized name "${name}" appears in teams ${ids.join(", ")}. Cannot resolve source teams by name.`,
      );
    }
  }

  const byId = new Map<string, string>();
  const matchedById: string[] = [];
  const matchedByName: TeamNameMatch[] = [];
  const missing: TeamIdentity[] = [];

  for (const team of source) {
    if (targetIds.has(team.id)) {
      byId.set(team.id, team.id);
      matchedById.push(team.id);
      continue;
    }

    const namedId = targetIdsByName.get(normalizeName(team.name))?.[0];
    if (namedId !== undefined) {
      byId.set(team.id, namedId);
      matchedByName.push({ name: team.name, sourceId: team.id, targetId: namedId });
      continue;
    }

    // Created with its source id, so the mapping is the identity.
    byId.set(team.id, team.id);
    missing.push(team);
  }

  return { byId, matchedById, matchedByName, missing };
}

export function remapTeamId(map: TeamMap, id: string | null): string | null {
  if (id === null) return null;
  const mapped = map.byId.get(id);
  if (mapped === undefined) {
    throw new Error(
      `Unmapped team id "${id}" — it is referenced by a profile but absent from source teams`,
    );
  }
  return mapped;
}
