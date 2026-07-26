# Essay Data Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one re-runnable script that copies the corrected legacy essay import from the local Supabase database to the preview branch, and later to production, without disturbing data those environments already own.

**Architecture:** A single CLI entry point (`scripts/transfer/transfer-essays.ts`) selects a target by `--target=preview|production` and runs ordered stages: preflight → profiles → catalog → storage → essays → verify. All I/O goes over PostgREST and the Storage API using service-role keys, because direct Postgres to preview is unreachable from the development machine. Pure logic (URL rewriting, profile id mapping, preflight assertions) lives in dependency-free modules with unit tests; I/O modules are thin wrappers over `fetch`.

**Tech Stack:** TypeScript (strict), Node 24, `tsx` 4.23.1 for execution, `vitest` (`unit` project) for tests, global `fetch` only — no new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-07-26-essay-data-transfer-design.md`. Requirement ids (R1–R7) below refer to it.

## Global Constraints

- **TypeScript strict mode. Never use `any`.** Use `interface` over `type`, except derived DB types which must be `type`. Prefer `??` over `||`.
- **Never hand-write DB row types.** Derive them: `import type { Tables, TablesInsert } from "@/lib/supabase/database.types"`. `tsconfig.json` maps `@/*` → `./src/*` and includes `**/*.ts`, so `pnpm typecheck` covers `scripts/`.
- **Naming:** PascalCase types, camelCase functions/vars, UPPER_SNAKE_CASE constants, kebab-case filenames.
- **Never hardcode magic values** — extract named constants or `as const` objects.
- **R1: preserve `created_at` and `updated_at`** on every inserted row. Essays span 2019-10-23 → 2026-07-23 across 1400 distinct days.
- **R2: derive the profile map from `work_email` at runtime.** Never hardcode profile UUIDs.
- **R3: never update an existing target profile except `team_id`.** Preview holds two `admin` accounts that local calls `student`.
- **Writes always use `Prefer: return=minimal,resolution=ignore-duplicates`** (`ON CONFLICT DO NOTHING`). Never `merge-duplicates` — `handle_updated_at` is `BEFORE UPDATE` and would overwrite `updated_at`, breaking R1 on resume runs.
- **Errors are fatal.** Any non-2xx response throws and stops the run before the next stage. Never swallow per-row errors and report success.
- **Never insert `teams`.** Preview already has all 15 with identical UUIDs; a mismatch aborts the run.
- **Never transfer** `users`, `reservations`, `rooms`, `essay_views`, `essay_votes`, `dashboard_layouts`.
- **Credentials** come only from the gitignored `.env.transfer.local`, loaded via `node --env-file`. Never commit secrets.
- Run `pnpm typecheck` and `pnpm test:unit` before every commit.

## Constants fixed by the environment

Copy these verbatim where needed:

- Local public image prefix: `http://127.0.0.1:54321/storage/v1/object/public/images`
- Preview base URL: `https://wykcqwmrxvgoomltrrlo.supabase.co`
- Bucket: `images` (public in local, preview, and production)
- Storage "missing object" is HTTP **400**, not 404 — treat any non-200 HEAD as missing.
- Synthetic audit profile (`System`): `f06ccaea-2556-4a1d-badb-de879ac936dc`, `admin@studenti.czu.cz`. All 6595 essays, 6595 revisions, and 220 comments reference it, and all 64 self-referencing `profiles.created_by_profile_id` values point at it. It must be inserted **first**.
- Expected source counts: `profiles` 193, `books` 618, `tags` 8, `book_tags` 616, `essays` 6595, `essay_revisions` 6595, `essay_comments` 220.
- Expected distinct local image srcs: **1745** (storage holds 1746 objects; one is unreferenced and must not be uploaded).

## File Structure

| File | Responsibility |
| --- | --- |
| `scripts/transfer/config.ts` | Resolve source/target endpoints from env; build URL prefixes |
| `scripts/transfer/content-rewrite.ts` | Pure: rewrite local storage URLs in `content_json`; collect object paths |
| `scripts/transfer/profile-map.ts` | Pure: build `work_email` → target id map; remap ids |
| `scripts/transfer/rest.ts` | PostgREST: paginated select, count, insert, patch, delete; `chunk` |
| `scripts/transfer/storage.ts` | Storage API: head/download/upload; path encoding; concurrency pool |
| `scripts/transfer/preflight.ts` | Pure assertions (teams aligned, target empty) + `gatherPlan` I/O + plan formatting |
| `scripts/transfer/stage-profiles.ts` | Insert 190 profiles; PATCH `team_id` on the 3 collisions |
| `scripts/transfer/stage-catalog.ts` | Insert `books`, `tags`, `book_tags` |
| `scripts/transfer/stage-storage.ts` | Ensure every referenced object exists in target |
| `scripts/transfer/stage-essays.ts` | Load revisions; insert `essays`, `essay_revisions`, `essay_comments` |
| `scripts/transfer/verify.ts` | Post-run assertions |
| `scripts/transfer/rollback.ts` | Delete only rows this transfer inserted |
| `scripts/transfer/transfer-essays.ts` | CLI: flag parsing, stage orchestration, reporting |
| `tests/unit/transfer/*.test.ts` | Unit tests (must live under `tests/unit/`; the `unit` vitest project only matches `src/lib/**/*.test.ts` and `tests/unit/**/*.test.ts`) |

---

### Task 1: Project wiring and endpoint config

**Files:**
- Modify: `package.json` (commit the already-present `tsx` devDependency; add two scripts)
- Create: `scripts/transfer/config.ts`
- Test: `tests/unit/transfer/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface Endpoint { restUrl: string; storageApiUrl: string; publicImagePrefix: string; serviceKey: string }`; `type TargetName = "preview" | "production"`; `buildEndpoint(baseUrl: string, serviceKey: string): Endpoint`; `resolveSource(env?: NodeJS.ProcessEnv): Endpoint`; `resolveTarget(name: string, env?: NodeJS.ProcessEnv): Endpoint & { name: TargetName }`; `const IMAGES_BUCKET = "images"`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/transfer/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildEndpoint, resolveSource, resolveTarget } from "../../../scripts/transfer/config";

const ENV = {
  LOCAL_SUPABASE_URL: "http://127.0.0.1:54321",
  LOCAL_SERVICE_ROLE_KEY: "local-key",
  PREVIEW_SUPABASE_URL: "https://preview.supabase.co/",
  PREVIEW_SERVICE_ROLE_KEY: "preview-key",
} satisfies NodeJS.ProcessEnv;

describe("buildEndpoint", () => {
  it("derives rest, storage and public image URLs", () => {
    const endpoint = buildEndpoint("https://x.supabase.co", "k");

    expect(endpoint.restUrl).toBe("https://x.supabase.co/rest/v1");
    expect(endpoint.storageApiUrl).toBe("https://x.supabase.co/storage/v1");
    expect(endpoint.publicImagePrefix).toBe(
      "https://x.supabase.co/storage/v1/object/public/images",
    );
    expect(endpoint.serviceKey).toBe("k");
  });

  it("strips trailing slashes so prefixes never double up", () => {
    expect(buildEndpoint("https://x.supabase.co///", "k").restUrl).toBe(
      "https://x.supabase.co/rest/v1",
    );
  });
});

describe("resolveTarget", () => {
  it("resolves preview from env", () => {
    const target = resolveTarget("preview", ENV);

    expect(target.name).toBe("preview");
    expect(target.publicImagePrefix).toBe(
      "https://preview.supabase.co/storage/v1/object/public/images",
    );
    expect(target.serviceKey).toBe("preview-key");
  });

  it("rejects an unknown target name", () => {
    expect(() => resolveTarget("staging", ENV)).toThrow(/Unknown target "staging"/);
  });

  it("names the missing variable when a key is absent", () => {
    expect(() => resolveTarget("production", ENV)).toThrow(
      /PRODUCTION_SUPABASE_URL/,
    );
  });

  it("treats a blank value as missing", () => {
    expect(() => resolveTarget("preview", { ...ENV, PREVIEW_SERVICE_ROLE_KEY: "   " })).toThrow(
      /PREVIEW_SERVICE_ROLE_KEY/,
    );
  });
});

describe("resolveSource", () => {
  it("resolves the local endpoint", () => {
    expect(resolveSource(ENV).restUrl).toBe("http://127.0.0.1:54321/rest/v1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/transfer/config.test.ts`
Expected: FAIL — cannot resolve `../../../scripts/transfer/config`.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/transfer/config.ts`:

```ts
export const IMAGES_BUCKET = "images";

export type TargetName = "preview" | "production";

const TARGET_NAMES = ["preview", "production"] as const;

export interface Endpoint {
  readonly restUrl: string;
  readonly storageApiUrl: string;
  readonly publicImagePrefix: string;
  readonly serviceKey: string;
}

export function buildEndpoint(baseUrl: string, serviceKey: string): Endpoint {
  const base = baseUrl.replace(/\/+$/, "");
  return {
    restUrl: `${base}/rest/v1`,
    storageApiUrl: `${base}/storage/v1`,
    publicImagePrefix: `${base}/storage/v1/object/public/${IMAGES_BUCKET}`,
    serviceKey,
  };
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required env var ${key} — set it in .env.transfer.local`);
  }
  return value.trim();
}

export function resolveSource(env: NodeJS.ProcessEnv = process.env): Endpoint {
  return buildEndpoint(
    requireEnv(env, "LOCAL_SUPABASE_URL"),
    requireEnv(env, "LOCAL_SERVICE_ROLE_KEY"),
  );
}

export function resolveTarget(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): Endpoint & { readonly name: TargetName } {
  if (!TARGET_NAMES.includes(name as TargetName)) {
    throw new Error(
      `Unknown target "${name}" — expected one of ${TARGET_NAMES.join(", ")}`,
    );
  }
  const targetName = name as TargetName;
  const prefix = targetName.toUpperCase();
  return {
    name: targetName,
    ...buildEndpoint(
      requireEnv(env, `${prefix}_SUPABASE_URL`),
      requireEnv(env, `${prefix}_SERVICE_ROLE_KEY`),
    ),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit tests/unit/transfer/config.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Add the run scripts to `package.json`**

In the `"scripts"` block, after `"db:doctor"`, add:

```json
"transfer:essays": "node --env-file=.env.transfer.local --import tsx scripts/transfer/transfer-essays.ts",
"transfer:essays:dry": "node --env-file=.env.transfer.local --import tsx scripts/transfer/transfer-essays.ts --target=preview --dry-run",
```

- [ ] **Step 6: Verify typecheck and the wiring**

Run: `pnpm typecheck`
Expected: no errors.

Run: `pnpm transfer:essays:dry`
Expected: fails with "Cannot find module .../transfer-essays.ts" — confirms env loading and `tsx` resolution work before that file exists.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml scripts/transfer/config.ts tests/unit/transfer/config.test.ts
git commit -m "feat(transfer): add endpoint config for essay data transfer"
```

---

### Task 2: `content_json` URL rewriting (pure)

Highest-risk logic in the project: it edits 6595 documents. R5 requires that only the 1745 local-storage srcs change, and that 67 external `https://` plus 11 junk srcs (`/forpsi-errors/…`, `blob:…`) stay byte-identical.

**Files:**
- Create: `scripts/transfer/content-rewrite.ts`
- Test: `tests/unit/transfer/content-rewrite.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface RewriteResult<T> { value: T; rewritten: number }`; `rewriteLocalStorageUrls<T>(node: T, fromPrefix: string, toPrefix: string): RewriteResult<T>`; `collectLocalObjectPaths(node: unknown, fromPrefix: string): string[]`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/transfer/content-rewrite.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  collectLocalObjectPaths,
  rewriteLocalStorageUrls,
} from "../../../scripts/transfer/content-rewrite";

const FROM = "http://127.0.0.1:54321/storage/v1/object/public/images";
const TO = "https://preview.supabase.co/storage/v1/object/public/images";

const DOC = {
  type: "doc",
  content: [
    {
      type: "image",
      attrs: { src: `${FROM}/essay-images/import/1897/Image_910.png`, alt: "local" },
    },
    {
      type: "image",
      attrs: { src: "https://upload.wikimedia.org/wikipedia/commons/3/37/x.jpg" },
    },
    { type: "image", attrs: { src: "/forpsi-errors/images/logo.gif" } },
    { type: "image", attrs: { src: "blob:https://tiimiakatemia.cz/1a991f5f" } },
    {
      type: "paragraph",
      content: [{ type: "text", text: "no url here" }],
    },
  ],
};

describe("rewriteLocalStorageUrls", () => {
  it("replaces only the local storage prefix", () => {
    const { value } = rewriteLocalStorageUrls(DOC, FROM, TO);

    expect(value.content[0].attrs.src).toBe(
      `${TO}/essay-images/import/1897/Image_910.png`,
    );
  });

  it("leaves external https, root-relative and blob srcs byte-identical", () => {
    const { value } = rewriteLocalStorageUrls(DOC, FROM, TO);

    expect(value.content[1].attrs.src).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/3/37/x.jpg",
    );
    expect(value.content[2].attrs.src).toBe("/forpsi-errors/images/logo.gif");
    expect(value.content[3].attrs.src).toBe("blob:https://tiimiakatemia.cz/1a991f5f");
  });

  it("reports how many strings it rewrote", () => {
    expect(rewriteLocalStorageUrls(DOC, FROM, TO).rewritten).toBe(1);
  });

  it("does not mutate the input document", () => {
    const before = JSON.stringify(DOC);
    rewriteLocalStorageUrls(DOC, FROM, TO);

    expect(JSON.stringify(DOC)).toBe(before);
  });

  it("preserves non-string leaves and nulls", () => {
    const input = { a: 1, b: true, c: null, d: [1, "x"] };

    expect(rewriteLocalStorageUrls(input, FROM, TO).value).toEqual(input);
  });

  it("rewrites every occurrence, including repeats", () => {
    const input = {
      a: `${FROM}/one.png`,
      b: [`${FROM}/one.png`, `${FROM}/two.png`],
    };
    const { value, rewritten } = rewriteLocalStorageUrls(input, FROM, TO);

    expect(rewritten).toBe(3);
    expect(value.b[1]).toBe(`${TO}/two.png`);
  });

  it("does not rewrite a string that merely contains the prefix mid-way", () => {
    const input = { src: `see ${FROM}/x.png` };

    expect(rewriteLocalStorageUrls(input, FROM, TO).rewritten).toBe(0);
  });
});

describe("collectLocalObjectPaths", () => {
  it("returns deduplicated object paths without the prefix", () => {
    const input = {
      a: `${FROM}/essay-images/import/1897/Image_910.png`,
      b: `${FROM}/essay-images/import/1897/Image_910.png`,
      c: `${FROM}/essay-images/import/test/1002_Image_399.jpeg`,
    };

    expect(collectLocalObjectPaths(input, FROM).sort()).toEqual([
      "essay-images/import/1897/Image_910.png",
      "essay-images/import/test/1002_Image_399.jpeg",
    ]);
  });

  it("ignores non-local srcs", () => {
    expect(collectLocalObjectPaths(DOC, FROM)).toEqual([
      "essay-images/import/1897/Image_910.png",
    ]);
  });

  it("percent-decodes paths so they match storage object names", () => {
    expect(collectLocalObjectPaths({ src: `${FROM}/a%20b/c%2Bd.png` }, FROM)).toEqual([
      "a b/c+d.png",
    ]);
  });

  it("skips a bare prefix with no object path", () => {
    expect(collectLocalObjectPaths({ src: `${FROM}/` }, FROM)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/transfer/content-rewrite.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/transfer/content-rewrite.ts`:

```ts
export interface RewriteResult<T> {
  readonly value: T;
  readonly rewritten: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Replaces `fromPrefix` with `toPrefix` on every string that *starts with*
 * `fromPrefix`. Exact-prefix matching, so external and malformed srcs are
 * returned byte-identical (spec R5).
 */
export function rewriteLocalStorageUrls<T>(
  node: T,
  fromPrefix: string,
  toPrefix: string,
): RewriteResult<T> {
  let rewritten = 0;

  const walk = (value: unknown): unknown => {
    if (typeof value === "string") {
      if (value.startsWith(fromPrefix)) {
        rewritten += 1;
        return `${toPrefix}${value.slice(fromPrefix.length)}`;
      }
      return value;
    }
    if (Array.isArray(value)) return value.map(walk);
    if (isPlainObject(value)) {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(value)) out[key] = walk(child);
      return out;
    }
    return value;
  };

  return { value: walk(node) as T, rewritten };
}

/**
 * Collects the distinct storage object paths referenced by local URLs, decoded
 * so they match `storage.objects.name`.
 */
export function collectLocalObjectPaths(node: unknown, fromPrefix: string): string[] {
  const paths = new Set<string>();

  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      if (!value.startsWith(fromPrefix)) return;
      const raw = value.slice(fromPrefix.length).replace(/^\/+/, "");
      if (raw === "") return;
      paths.add(decodeURIComponent(raw));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (isPlainObject(value)) {
      Object.values(value).forEach(walk);
    }
  };

  walk(node);
  return [...paths];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit tests/unit/transfer/content-rewrite.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/transfer/content-rewrite.ts tests/unit/transfer/content-rewrite.test.ts
git commit -m "feat(transfer): rewrite local storage URLs in essay content_json"
```

---

### Task 3: Profile id mapping (pure)

**Files:**
- Create: `scripts/transfer/profile-map.ts`
- Test: `tests/unit/transfer/profile-map.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface ProfileIdentity { id: string; work_email: string }`; `interface ProfileCollision { workEmail: string; sourceId: string; targetId: string }`; `interface ProfileMap { byId: ReadonlyMap<string, string>; collisions: readonly ProfileCollision[]; insertIds: ReadonlySet<string> }`; `buildProfileMap(source: readonly ProfileIdentity[], target: readonly ProfileIdentity[]): ProfileMap`; `remapProfileId(map: ProfileMap, id: string): string`; `remapOptionalProfileId(map: ProfileMap, id: string | null): string | null`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/transfer/profile-map.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildProfileMap,
  remapOptionalProfileId,
  remapProfileId,
} from "../../../scripts/transfer/profile-map";

const SOURCE = [
  { id: "src-kulo", work_email: "xkulo007@studenti.czu.cz" },
  { id: "src-system", work_email: "admin@studenti.czu.cz" },
  { id: "src-other", work_email: "xnovy001@studenti.czu.cz" },
];

const TARGET = [{ id: "tgt-kulo", work_email: "XKulo007@studenti.czu.cz" }];

describe("buildProfileMap", () => {
  it("maps a colliding source id to the existing target id", () => {
    expect(buildProfileMap(SOURCE, TARGET).byId.get("src-kulo")).toBe("tgt-kulo");
  });

  it("maps a non-colliding source id to itself", () => {
    expect(buildProfileMap(SOURCE, TARGET).byId.get("src-other")).toBe("src-other");
  });

  it("matches work_email case-insensitively and ignores surrounding space", () => {
    const map = buildProfileMap(
      [{ id: "s", work_email: " Foo@pef.czu.cz " }],
      [{ id: "t", work_email: "foo@pef.czu.cz" }],
    );

    expect(map.byId.get("s")).toBe("t");
    expect(map.insertIds.has("s")).toBe(false);
  });

  it("lists only non-colliding ids as inserts", () => {
    const { insertIds } = buildProfileMap(SOURCE, TARGET);

    expect([...insertIds].sort()).toEqual(["src-other", "src-system"]);
  });

  it("reports collisions with both ids and the matched email", () => {
    expect(buildProfileMap(SOURCE, TARGET).collisions).toEqual([
      {
        workEmail: "xkulo007@studenti.czu.cz",
        sourceId: "src-kulo",
        targetId: "tgt-kulo",
      },
    ]);
  });

  it("produces no collisions when the target is empty", () => {
    const map = buildProfileMap(SOURCE, []);

    expect(map.collisions).toEqual([]);
    expect(map.insertIds.size).toBe(3);
  });
});

describe("remapProfileId", () => {
  it("resolves a known id", () => {
    expect(remapProfileId(buildProfileMap(SOURCE, TARGET), "src-kulo")).toBe("tgt-kulo");
  });

  it("throws on an unknown id rather than passing it through", () => {
    expect(() => remapProfileId(buildProfileMap(SOURCE, TARGET), "ghost")).toThrow(
      /Unmapped profile id "ghost"/,
    );
  });
});

describe("remapOptionalProfileId", () => {
  it("passes null through", () => {
    expect(remapOptionalProfileId(buildProfileMap(SOURCE, TARGET), null)).toBeNull();
  });

  it("resolves a non-null id", () => {
    expect(remapOptionalProfileId(buildProfileMap(SOURCE, TARGET), "src-kulo")).toBe(
      "tgt-kulo",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/transfer/profile-map.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/transfer/profile-map.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit tests/unit/transfer/profile-map.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/transfer/profile-map.ts tests/unit/transfer/profile-map.test.ts
git commit -m "feat(transfer): map profile ids by work_email"
```

---

### Task 4: PostgREST client

**Files:**
- Create: `scripts/transfer/rest.ts`
- Test: `tests/unit/transfer/rest.test.ts`

**Interfaces:**
- Consumes: `Endpoint` from `./config`.
- Produces: `chunk<T>(items: readonly T[], size: number): T[][]`; `selectAll<T>(endpoint: Endpoint, table: string, select?: string): Promise<T[]>`; `countRows(endpoint: Endpoint, table: string): Promise<number>`; `insertRows(endpoint: Endpoint, table: string, rows: readonly unknown[], onConflict?: string): Promise<void>`; `patchRows(endpoint: Endpoint, table: string, filter: string, patch: Record<string, unknown>): Promise<void>`; `deleteRows(endpoint: Endpoint, table: string, filter: string): Promise<void>`; `const PAGE_SIZE = 1000`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/transfer/rest.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildEndpoint } from "../../../scripts/transfer/config";
import {
  chunk,
  countRows,
  deleteRows,
  insertRows,
  patchRows,
  selectAll,
} from "../../../scripts/transfer/rest";

const ENDPOINT = buildEndpoint("https://x.supabase.co", "svc-key");

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit;
}

function stubFetch(responses: readonly Response[]): FetchCall[] {
  const calls: FetchCall[] = [];
  let index = 0;
  vi.stubGlobal("fetch", (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return Promise.resolve(response);
  });
  return calls;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chunk", () => {
  it("splits into fixed-size batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns an empty array for no items", () => {
    expect(chunk([], 10)).toEqual([]);
  });
});

describe("selectAll", () => {
  it("stops after a short page", async () => {
    const calls = stubFetch([jsonResponse([{ id: "a" }])]);

    await expect(selectAll(ENDPOINT, "teams")).resolves.toEqual([{ id: "a" }]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/rest/v1/teams?select=*");
    expect(calls[0].url).toContain("offset=0");
  });

  it("pages until a short page arrives", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ id: String(i) }));
    const calls = stubFetch([jsonResponse(full), jsonResponse([{ id: "last" }])]);

    const rows = await selectAll<{ id: string }>(ENDPOINT, "essays");

    expect(rows).toHaveLength(1001);
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toContain("offset=1000");
  });

  it("sends the service key on both headers", async () => {
    const calls = stubFetch([jsonResponse([])]);
    await selectAll(ENDPOINT, "teams");
    const headers = calls[0].init.headers as Record<string, string>;

    expect(headers.apikey).toBe("svc-key");
    expect(headers.Authorization).toBe("Bearer svc-key");
  });

  it("throws with status and body on failure", async () => {
    stubFetch([new Response("nope", { status: 401 })]);

    await expect(selectAll(ENDPOINT, "teams")).rejects.toThrow(/401.*nope/s);
  });
});

describe("countRows", () => {
  it("parses the total out of content-range", async () => {
    stubFetch([
      jsonResponse([], { headers: { "Content-Range": "0-0/6595" } }),
    ]);

    await expect(countRows(ENDPOINT, "essays")).resolves.toBe(6595);
  });

  it("throws when content-range is missing", async () => {
    stubFetch([jsonResponse([])]);

    await expect(countRows(ENDPOINT, "essays")).rejects.toThrow(/content-range/i);
  });
});

describe("insertRows", () => {
  it("never updates existing rows", async () => {
    const calls = stubFetch([new Response(null, { status: 201 })]);
    await insertRows(ENDPOINT, "essays", [{ id: "a" }]);
    const headers = calls[0].init.headers as Record<string, string>;

    expect(headers.Prefer).toBe("return=minimal,resolution=ignore-duplicates");
    expect(headers.Prefer).not.toContain("merge-duplicates");
  });

  it("passes on_conflict for composite keys", async () => {
    const calls = stubFetch([new Response(null, { status: 201 })]);
    await insertRows(ENDPOINT, "essay_revisions", [{ essay_id: "a" }], "essay_id,revision_no");

    expect(calls[0].url).toContain("on_conflict=essay_id%2Crevision_no");
  });

  it("skips the request entirely for zero rows", async () => {
    const calls = stubFetch([new Response(null, { status: 201 })]);
    await insertRows(ENDPOINT, "essays", []);

    expect(calls).toHaveLength(0);
  });

  it("throws on a failed insert", async () => {
    stubFetch([new Response("fk violation", { status: 409 })]);

    await expect(insertRows(ENDPOINT, "essays", [{ id: "a" }])).rejects.toThrow(
      /essays.*409.*fk violation/s,
    );
  });
});

describe("patchRows", () => {
  it("PATCHes with the filter in the query string", async () => {
    const calls = stubFetch([new Response(null, { status: 204 })]);
    await patchRows(ENDPOINT, "profiles", "id=eq.abc", { team_id: "t1" });

    expect(calls[0].init.method).toBe("PATCH");
    expect(calls[0].url).toBe("https://x.supabase.co/rest/v1/profiles?id=eq.abc");
    expect(calls[0].init.body).toBe(JSON.stringify({ team_id: "t1" }));
  });
});

describe("deleteRows", () => {
  it("DELETEs with the filter in the query string", async () => {
    const calls = stubFetch([new Response(null, { status: 204 })]);
    await deleteRows(ENDPOINT, "essays", "id=in.(a,b)");

    expect(calls[0].init.method).toBe("DELETE");
    expect(calls[0].url).toBe("https://x.supabase.co/rest/v1/essays?id=in.(a,b)");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/transfer/rest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/transfer/rest.ts`:

```ts
import type { Endpoint } from "./config";

export const PAGE_SIZE = 1000;

const INSERT_PREFER = "return=minimal,resolution=ignore-duplicates";

function headers(endpoint: Endpoint, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: endpoint.serviceKey,
    Authorization: `Bearer ${endpoint.serviceKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function failure(action: string, response: Response): Promise<Error> {
  const body = await response.text().catch(() => "");
  return new Error(`${action} failed: ${response.status} ${body}`);
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function selectAll<T>(
  endpoint: Endpoint,
  table: string,
  select = "*",
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = `${endpoint.restUrl}/${table}?select=${encodeURIComponent(select)}&limit=${PAGE_SIZE}&offset=${offset}`;
    const response = await fetch(url, { headers: headers(endpoint) });
    if (!response.ok) throw await failure(`GET ${table}`, response);
    const page = (await response.json()) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function countRows(endpoint: Endpoint, table: string): Promise<number> {
  const response = await fetch(`${endpoint.restUrl}/${table}?select=*&limit=1`, {
    headers: headers(endpoint, { Prefer: "count=exact", Range: "0-0" }),
  });
  if (!response.ok) throw await failure(`COUNT ${table}`, response);

  const contentRange = response.headers.get("content-range");
  const total = Number(contentRange?.split("/")[1]);
  if (contentRange === null || !Number.isFinite(total)) {
    throw new Error(`COUNT ${table} failed: missing or unparsable content-range "${contentRange}"`);
  }
  return total;
}

export async function insertRows(
  endpoint: Endpoint,
  table: string,
  rows: readonly unknown[],
  onConflict?: string,
): Promise<void> {
  if (rows.length === 0) return;

  const query = onConflict === undefined
    ? ""
    : `?${new URLSearchParams({ on_conflict: onConflict }).toString()}`;

  const response = await fetch(`${endpoint.restUrl}/${table}${query}`, {
    method: "POST",
    headers: headers(endpoint, { Prefer: INSERT_PREFER }),
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw await failure(`INSERT ${table} (${rows.length} rows)`, response);
}

export async function patchRows(
  endpoint: Endpoint,
  table: string,
  filter: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${endpoint.restUrl}/${table}?${filter}`, {
    method: "PATCH",
    headers: headers(endpoint, { Prefer: "return=minimal" }),
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw await failure(`PATCH ${table} (${filter})`, response);
}

export async function deleteRows(
  endpoint: Endpoint,
  table: string,
  filter: string,
): Promise<void> {
  const response = await fetch(`${endpoint.restUrl}/${table}?${filter}`, {
    method: "DELETE",
    headers: headers(endpoint, { Prefer: "return=minimal" }),
  });
  if (!response.ok) throw await failure(`DELETE ${table} (${filter})`, response);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit tests/unit/transfer/rest.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/transfer/rest.ts tests/unit/transfer/rest.test.ts
git commit -m "feat(transfer): add PostgREST client with insert-or-skip semantics"
```

---

### Task 5: Storage client

**Files:**
- Create: `scripts/transfer/storage.ts`
- Test: `tests/unit/transfer/storage.test.ts`

**Interfaces:**
- Consumes: `Endpoint`, `IMAGES_BUCKET` from `./config`.
- Produces: `encodeObjectPath(path: string): string`; `contentTypeFor(path: string): string`; `interface ObjectHead { exists: boolean; size: number | null }`; `headObject(endpoint: Endpoint, path: string): Promise<ObjectHead>`; `downloadObject(endpoint: Endpoint, path: string): Promise<{ bytes: Uint8Array; contentType: string }>`; `uploadObject(endpoint: Endpoint, path: string, bytes: Uint8Array, contentType: string): Promise<void>`; `mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/transfer/storage.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildEndpoint } from "../../../scripts/transfer/config";
import {
  contentTypeFor,
  downloadObject,
  encodeObjectPath,
  headObject,
  mapWithConcurrency,
  uploadObject,
} from "../../../scripts/transfer/storage";

const ENDPOINT = buildEndpoint("https://x.supabase.co", "svc-key");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("encodeObjectPath", () => {
  it("keeps slashes but encodes each segment", () => {
    expect(encodeObjectPath("essay-images/import/a b/c+d.png")).toBe(
      "essay-images/import/a%20b/c%2Bd.png",
    );
  });

  it("leaves a plain path untouched", () => {
    expect(encodeObjectPath("essay-images/import/1897/Image_910.png")).toBe(
      "essay-images/import/1897/Image_910.png",
    );
  });
});

describe("contentTypeFor", () => {
  it("maps known image extensions case-insensitively", () => {
    expect(contentTypeFor("a.JPG")).toBe("image/jpeg");
    expect(contentTypeFor("a.jpeg")).toBe("image/jpeg");
    expect(contentTypeFor("a.png")).toBe("image/png");
    expect(contentTypeFor("a.gif")).toBe("image/gif");
    expect(contentTypeFor("a.webp")).toBe("image/webp");
  });

  it("falls back to a generic binary type", () => {
    expect(contentTypeFor("a.bin")).toBe("application/octet-stream");
  });
});

describe("headObject", () => {
  it("reports an existing object with its size", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response(null, { status: 200, headers: { "Content-Length": "135158" } })),
    );

    await expect(headObject(ENDPOINT, "a/b.png")).resolves.toEqual({
      exists: true,
      size: 135158,
    });
  });

  it("treats HTTP 400 as missing, because Supabase storage returns 400 not 404", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response(null, { status: 400 })));

    await expect(headObject(ENDPOINT, "a/b.png")).resolves.toEqual({
      exists: false,
      size: null,
    });
  });

  it("requests the public URL with HEAD", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url}`);
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    await headObject(ENDPOINT, "a/b.png");

    expect(calls[0]).toBe(
      "HEAD https://x.supabase.co/storage/v1/object/public/images/a/b.png",
    );
  });
});

describe("downloadObject", () => {
  it("returns bytes and the served content type", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      ),
    );

    const result = await downloadObject(ENDPOINT, "a/b.png");

    expect([...result.bytes]).toEqual([1, 2, 3]);
    expect(result.contentType).toBe("image/png");
  });

  it("falls back to the extension when no content type is served", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response(new Uint8Array([1]), { status: 200 })),
    );

    await expect(
      downloadObject(ENDPOINT, "a/b.gif").then((r) => r.contentType),
    ).resolves.toBe("image/gif");
  });

  it("throws when the source object is missing", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("gone", { status: 400 })));

    await expect(downloadObject(ENDPOINT, "a/b.png")).rejects.toThrow(/a\/b\.png.*400/s);
  });
});

describe("uploadObject", () => {
  it("POSTs to the object API with upsert enabled", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(null, { status: 200 }));
    });

    await uploadObject(ENDPOINT, "a/b.png", new Uint8Array([1]), "image/png");
    const headers = calls[0].init.headers as Record<string, string>;

    expect(calls[0].url).toBe("https://x.supabase.co/storage/v1/object/images/a/b.png");
    expect(calls[0].init.method).toBe("POST");
    expect(headers["x-upsert"]).toBe("true");
    expect(headers["Content-Type"]).toBe("image/png");
    expect(headers.Authorization).toBe("Bearer svc-key");
  });

  it("throws on a failed upload", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("denied", { status: 403 })));

    await expect(
      uploadObject(ENDPOINT, "a/b.png", new Uint8Array([1]), "image/png"),
    ).rejects.toThrow(/403.*denied/s);
  });
});

describe("mapWithConcurrency", () => {
  it("preserves input order in the results", async () => {
    const result = await mapWithConcurrency([3, 1, 2], 2, async (n) => {
      await new Promise((resolve) => setTimeout(resolve, n));
      return n * 10;
    });

    expect(result).toEqual([30, 10, 20]);
  });

  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;

    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return null;
    });

    expect(peak).toBeLessThanOrEqual(4);
  });

  it("handles an empty input", async () => {
    await expect(mapWithConcurrency([], 4, async () => 1)).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/transfer/storage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/transfer/storage.ts`:

```ts
import { IMAGES_BUCKET, type Endpoint } from "./config";

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
} as const;

const FALLBACK_CONTENT_TYPE = "application/octet-stream";

export interface ObjectHead {
  readonly exists: boolean;
  readonly size: number | null;
}

export function encodeObjectPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function contentTypeFor(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return FALLBACK_CONTENT_TYPE;
  const extension = path.slice(dot).toLowerCase();
  return CONTENT_TYPES[extension as keyof typeof CONTENT_TYPES] ?? FALLBACK_CONTENT_TYPE;
}

/**
 * Supabase storage answers a missing public object with HTTP 400, not 404, so
 * anything other than 200 counts as absent.
 */
export async function headObject(endpoint: Endpoint, path: string): Promise<ObjectHead> {
  const response = await fetch(`${endpoint.publicImagePrefix}/${encodeObjectPath(path)}`, {
    method: "HEAD",
  });
  if (!response.ok) return { exists: false, size: null };

  const length = response.headers.get("content-length");
  return { exists: true, size: length === null ? null : Number(length) };
}

export async function downloadObject(
  endpoint: Endpoint,
  path: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const response = await fetch(`${endpoint.publicImagePrefix}/${encodeObjectPath(path)}`);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GET object ${path} failed: ${response.status} ${body}`);
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? contentTypeFor(path),
  };
}

export async function uploadObject(
  endpoint: Endpoint,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const response = await fetch(
    `${endpoint.storageApiUrl}/object/${IMAGES_BUCKET}/${encodeObjectPath(path)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${endpoint.serviceKey}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    },
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`PUT object ${path} failed: ${response.status} ${body}`);
  }
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit tests/unit/transfer/storage.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/transfer/storage.ts tests/unit/transfer/storage.test.ts
git commit -m "feat(transfer): add storage client with concurrency pool"
```

---

### Task 6: Preflight assertions and plan gathering

**Files:**
- Create: `scripts/transfer/preflight.ts`
- Test: `tests/unit/transfer/preflight.test.ts`

**Interfaces:**
- Consumes: `Endpoint` from `./config`; `selectAll`, `countRows` from `./rest`; `buildProfileMap`, `ProfileMap` from `./profile-map`.
- Produces: `const DATA_TABLES` (6 tables that must be empty); `type DataTable`; `interface TeamIdentity { id: string; name: string }`; `assertTeamsAligned(source: readonly TeamIdentity[], target: readonly TeamIdentity[]): void`; `assertTargetEmpty(counts: Readonly<Record<DataTable, number>>, resume: boolean): void`; `interface TransferPlan { sourceProfiles; targetProfiles; profileMap; sourceCounts; targetCounts }`; `gatherPlan(source: Endpoint, target: Endpoint): Promise<TransferPlan>`; `formatPlan(plan: TransferPlan): string`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/transfer/preflight.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  assertTargetEmpty,
  assertTeamsAligned,
  type DataTable,
} from "../../../scripts/transfer/preflight";

const TEAMS = [
  { id: "t1", name: "Aconditor" },
  { id: "t2", name: "BASED" },
];

const EMPTY_COUNTS: Record<DataTable, number> = {
  books: 0,
  tags: 0,
  book_tags: 0,
  essays: 0,
  essay_revisions: 0,
  essay_comments: 0,
};

describe("assertTeamsAligned", () => {
  it("accepts identical teams", () => {
    expect(() => assertTeamsAligned(TEAMS, [...TEAMS].reverse())).not.toThrow();
  });

  it("accepts extra teams in the target", () => {
    expect(() =>
      assertTeamsAligned(TEAMS, [...TEAMS, { id: "t3", name: "Extra" }]),
    ).not.toThrow();
  });

  it("rejects a source team missing from the target", () => {
    expect(() => assertTeamsAligned(TEAMS, [TEAMS[0]])).toThrow(/t2.*BASED/s);
  });

  it("rejects a team whose name differs, since ids must line up by identity", () => {
    expect(() =>
      assertTeamsAligned(TEAMS, [TEAMS[0], { id: "t2", name: "Renamed" }]),
    ).toThrow(/t2.*BASED.*Renamed/s);
  });
});

describe("assertTargetEmpty", () => {
  it("accepts an empty target", () => {
    expect(() => assertTargetEmpty(EMPTY_COUNTS, false)).not.toThrow();
  });

  it("rejects a non-empty target without --resume, naming the table and count", () => {
    expect(() => assertTargetEmpty({ ...EMPTY_COUNTS, essays: 12 }, false)).toThrow(
      /essays.*12.*--resume/s,
    );
  });

  it("allows a non-empty target with --resume", () => {
    expect(() => assertTargetEmpty({ ...EMPTY_COUNTS, essays: 12 }, true)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/transfer/preflight.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/transfer/preflight.ts`:

```ts
import type { Tables } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import { buildProfileMap, type ProfileMap } from "./profile-map";
import { countRows, selectAll } from "./rest";

export const DATA_TABLES = [
  "books",
  "tags",
  "book_tags",
  "essays",
  "essay_revisions",
  "essay_comments",
] as const;

export type DataTable = (typeof DATA_TABLES)[number];

export interface TeamIdentity {
  readonly id: string;
  readonly name: string;
}

export interface TransferPlan {
  readonly sourceProfiles: readonly Tables<"profiles">[];
  readonly targetProfiles: readonly Tables<"profiles">[];
  readonly profileMap: ProfileMap;
  readonly sourceCounts: Readonly<Record<DataTable, number>>;
  readonly targetCounts: Readonly<Record<DataTable, number>>;
}

/**
 * Teams are never inserted (spec: preview already holds all 15 with identical
 * UUIDs). Any divergence means profile.team_id values would dangle, so abort.
 */
export function assertTeamsAligned(
  source: readonly TeamIdentity[],
  target: readonly TeamIdentity[],
): void {
  const targetById = new Map(target.map((team) => [team.id, team.name]));

  for (const team of source) {
    const targetName = targetById.get(team.id);
    if (targetName === undefined) {
      throw new Error(
        `Team ${team.id} ("${team.name}") is missing from the target. Teams are never inserted by this transfer — create it first, then re-run.`,
      );
    }
    if (targetName !== team.name) {
      throw new Error(
        `Team ${team.id} name mismatch: source "${team.name}" vs target "${targetName}". Refusing to transfer against divergent teams.`,
      );
    }
  }
}

export function assertTargetEmpty(
  counts: Readonly<Record<DataTable, number>>,
  resume: boolean,
): void {
  if (resume) return;

  const populated = DATA_TABLES.filter((table) => counts[table] > 0);
  if (populated.length === 0) return;

  const detail = populated.map((table) => `${table}=${counts[table]}`).join(", ");
  throw new Error(
    `Target already holds data (${detail}). Re-run with --resume to continue an interrupted transfer, or --rollback to clear it.`,
  );
}

async function countAll(
  endpoint: Endpoint,
): Promise<Record<DataTable, number>> {
  const entries = await Promise.all(
    DATA_TABLES.map(async (table) => [table, await countRows(endpoint, table)] as const),
  );
  return Object.fromEntries(entries) as Record<DataTable, number>;
}

export async function gatherPlan(source: Endpoint, target: Endpoint): Promise<TransferPlan> {
  const [sourceTeams, targetTeams] = await Promise.all([
    selectAll<TeamIdentity>(source, "teams", "id,name"),
    selectAll<TeamIdentity>(target, "teams", "id,name"),
  ]);
  assertTeamsAligned(sourceTeams, targetTeams);

  const [sourceProfiles, targetProfiles] = await Promise.all([
    selectAll<Tables<"profiles">>(source, "profiles"),
    selectAll<Tables<"profiles">>(target, "profiles"),
  ]);

  const [sourceCounts, targetCounts] = await Promise.all([
    countAll(source),
    countAll(target),
  ]);

  return {
    sourceProfiles,
    targetProfiles,
    profileMap: buildProfileMap(sourceProfiles, targetProfiles),
    sourceCounts,
    targetCounts,
  };
}

export function formatPlan(plan: TransferPlan): string {
  const lines: string[] = [];

  lines.push("profiles:");
  lines.push(`  source ${plan.sourceProfiles.length}, target ${plan.targetProfiles.length}`);
  lines.push(`  insert ${plan.profileMap.insertIds.size}, reuse ${plan.profileMap.collisions.length}`);
  for (const collision of plan.profileMap.collisions) {
    lines.push(`    reuse ${collision.workEmail}: ${collision.sourceId} -> ${collision.targetId}`);
  }

  lines.push("tables:");
  for (const table of DATA_TABLES) {
    lines.push(`  ${table}: source ${plan.sourceCounts[table]}, target ${plan.targetCounts[table]}`);
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit tests/unit/transfer/preflight.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/transfer/preflight.ts tests/unit/transfer/preflight.test.ts
git commit -m "feat(transfer): add preflight assertions and plan gathering"
```

---

### Task 7: CLI skeleton with working dry run

First task that talks to preview. Read-only.

**Files:**
- Create: `scripts/transfer/transfer-essays.ts`
- Test: manual dry run against preview (no unit test — this file is I/O orchestration only)

**Interfaces:**
- Consumes: `resolveSource`, `resolveTarget` from `./config`; `gatherPlan`, `formatPlan`, `assertTargetEmpty` from `./preflight`.
- Produces: `interface CliOptions { target: string; dryRun: boolean; resume: boolean; rollback: boolean; confirmProduction: boolean }`; `parseArgs(argv: readonly string[]): CliOptions`.

- [ ] **Step 1: Write the CLI with parsing, guards, and dry run**

Create `scripts/transfer/transfer-essays.ts`:

```ts
import { resolveSource, resolveTarget } from "./config";
import { assertTargetEmpty, formatPlan, gatherPlan } from "./preflight";

const PRODUCTION_CONFIRM_FLAG = "--i-know-this-is-production";

export interface CliOptions {
  readonly target: string;
  readonly dryRun: boolean;
  readonly resume: boolean;
  readonly rollback: boolean;
  readonly confirmProduction: boolean;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  const targetArg = argv.find((arg) => arg.startsWith("--target="));
  if (targetArg === undefined) {
    throw new Error("Missing --target=preview|production");
  }
  return {
    target: targetArg.slice("--target=".length),
    dryRun: argv.includes("--dry-run"),
    resume: argv.includes("--resume"),
    rollback: argv.includes("--rollback"),
    confirmProduction: argv.includes(PRODUCTION_CONFIRM_FLAG),
  };
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const source = resolveSource();
  const target = resolveTarget(options.target);

  if (target.name === "production" && !options.confirmProduction) {
    throw new Error(
      `Refusing to touch production without ${PRODUCTION_CONFIRM_FLAG}`,
    );
  }

  section(`Preflight: local -> ${target.name}`);
  const plan = await gatherPlan(source, target);
  console.log(formatPlan(plan));

  if (options.dryRun) {
    console.log("\nDry run — nothing was written.");
    return;
  }

  assertTargetEmpty(plan.targetCounts, options.resume);

  console.log("\nStages not yet implemented.");
}

main().catch((error: unknown) => {
  console.error(`\nFATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Run the dry run against preview**

Run: `pnpm transfer:essays:dry`

Expected output — preflight succeeds and reports exactly:
- `profiles: source 193, target 3`
- `insert 190, reuse 3`
- three `reuse` lines for `xkulo007@studenti.czu.cz`, `xprot040@studenti.czu.cz`, `xscho008@studenti.czu.cz`
- `books: source 618, target 0`, `tags: source 8, target 0`, `book_tags: source 616, target 0`, `essays: source 6595, target 0`, `essay_revisions: source 6595, target 0`, `essay_comments: source 220, target 0`
- `Dry run — nothing was written.`

**If the team assertion throws, stop and report** — it means preview teams drifted and the plan's central assumption is void.

- [ ] **Step 4: Verify the production guard**

Run: `node --env-file=.env.transfer.local --import tsx scripts/transfer/transfer-essays.ts --target=production --dry-run`
Expected: FATAL naming `--i-know-this-is-production` (it fails on the guard before needing production credentials).

- [ ] **Step 5: Commit**

```bash
git add scripts/transfer/transfer-essays.ts
git commit -m "feat(transfer): add CLI with preflight dry run and production guard"
```

---

### Task 8: Rollback

Built before any write stage, so a safety net exists before the first mutation.

**Files:**
- Create: `scripts/transfer/rollback.ts`
- Modify: `scripts/transfer/transfer-essays.ts`
- Test: `tests/unit/transfer/rollback.test.ts`

**Interfaces:**
- Consumes: `Endpoint`; `TransferPlan` from `./preflight`; `chunk`, `deleteRows`, `selectAll` from `./rest`.
- Produces: `const DELETE_CHUNK = 100`; `inFilter(column: string, ids: readonly string[]): string`; `rollbackTransfer(source: Endpoint, target: Endpoint, plan: TransferPlan): Promise<void>`.

Storage objects are deliberately **not** deleted: object paths are deterministic, orphaned images are harmless, and preview already held most of them before this work. Documented in the spec's Failure handling.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/transfer/rollback.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { inFilter } from "../../../scripts/transfer/rollback";

describe("inFilter", () => {
  it("builds a PostgREST in.() filter", () => {
    expect(inFilter("id", ["a", "b"])).toBe("id=in.(a,b)");
  });

  it("quotes ids defensively so a stray comma cannot widen the filter", () => {
    expect(inFilter("id", ["a,b"])).toBe('id=in.("a,b")');
  });

  it("rejects an empty id list, which would otherwise delete nothing silently", () => {
    expect(() => inFilter("id", [])).toThrow(/empty/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/transfer/rollback.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/transfer/rollback.ts`:

```ts
import type { Tables } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import type { TransferPlan } from "./preflight";
import { chunk, deleteRows, patchRows, selectAll } from "./rest";

export const DELETE_CHUNK = 100;

export function inFilter(column: string, ids: readonly string[]): string {
  if (ids.length === 0) {
    throw new Error(`Refusing to build an in.() filter for ${column} from an empty id list`);
  }
  const encoded = ids.map((id) => (id.includes(",") ? `"${id}"` : id)).join(",");
  return `${column}=in.(${encoded})`;
}

async function deleteByIds(
  target: Endpoint,
  table: string,
  column: string,
  ids: readonly string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  for (const batch of chunk(ids, DELETE_CHUNK)) {
    await deleteRows(target, table, inFilter(column, batch));
  }
  return ids.length;
}

/**
 * Deletes only what this transfer inserts, identified by source ids. Never
 * touches pre-existing target profiles or any team.
 */
export async function rollbackTransfer(
  source: Endpoint,
  target: Endpoint,
  plan: TransferPlan,
): Promise<void> {
  const [essays, comments, books, tags] = await Promise.all([
    selectAll<Pick<Tables<"essays">, "id">>(source, "essays", "id"),
    selectAll<Pick<Tables<"essay_comments">, "id">>(source, "essay_comments", "id"),
    selectAll<Pick<Tables<"books">, "id">>(source, "books", "id"),
    selectAll<Pick<Tables<"tags">, "id">>(source, "tags", "id"),
  ]);

  const essayIds = essays.map((row) => row.id);

  // Child rows first: essay_comments and essay_revisions reference essays.
  console.log(`  essay_comments: ${await deleteByIds(target, "essay_comments", "id", comments.map((r) => r.id))}`);
  console.log(`  essay_revisions: ${await deleteByIds(target, "essay_revisions", "essay_id", essayIds)}`);
  console.log(`  essays: ${await deleteByIds(target, "essays", "id", essayIds)}`);

  const bookIds = books.map((row) => row.id);
  console.log(`  book_tags: ${await deleteByIds(target, "book_tags", "book_id", bookIds)}`);
  console.log(`  tags: ${await deleteByIds(target, "tags", "id", tags.map((r) => r.id))}`);
  console.log(`  books: ${await deleteByIds(target, "books", "id", bookIds)}`);

  // Revert the team_id patch on reused profiles, but only where it still holds
  // the value this transfer wrote. Filtering on team_id makes this safe to run
  // even if someone has since set a different team by hand.
  for (const collision of plan.profileMap.collisions) {
    const sourceProfile = plan.sourceProfiles.find((p) => p.id === collision.sourceId);
    if (sourceProfile?.team_id == null) continue;
    await patchRows(
      target,
      "profiles",
      `id=eq.${collision.targetId}&team_id=eq.${sourceProfile.team_id}`,
      { team_id: null },
    );
  }

  const insertedProfileIds = plan.sourceProfiles
    .filter((profile) => plan.profileMap.insertIds.has(profile.id))
    .map((profile) => profile.id);
  console.log(`  profiles: ${await deleteByIds(target, "profiles", "id", insertedProfileIds)}`);

  console.log("  teams: untouched by design");
  console.log("  storage: untouched by design (orphaned objects are harmless)");
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm vitest run --project unit tests/unit/transfer/rollback.test.ts`
Expected: PASS (3 tests).

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Wire `--rollback` into the CLI**

In `scripts/transfer/transfer-essays.ts`, add the import:

```ts
import { rollbackTransfer } from "./rollback";
```

and insert this immediately after `console.log(formatPlan(plan));`:

```ts
  if (options.rollback) {
    section("Rollback");
    await rollbackTransfer(source, target, plan);
    console.log("\nRollback complete.");
    return;
  }
```

- [ ] **Step 6: Verify rollback is a safe no-op on an empty target**

Run: `node --env-file=.env.transfer.local --import tsx scripts/transfer/transfer-essays.ts --target=preview --rollback`
Expected: each line reports the source-side count it attempted; preview counts stay at 0 for the data tables and `profiles` stays at 3.

Confirm with:
Run: `pnpm transfer:essays:dry`
Expected: still `profiles: source 193, target 3` and all data tables `target 0`.

- [ ] **Step 7: Commit**

```bash
git add scripts/transfer/rollback.ts scripts/transfer/transfer-essays.ts tests/unit/transfer/rollback.test.ts
git commit -m "feat(transfer): add scoped rollback for transferred rows"
```

---

### Task 9: Profiles stage

**Files:**
- Create: `scripts/transfer/stage-profiles.ts`
- Modify: `scripts/transfer/transfer-essays.ts`
- Test: `tests/unit/transfer/stage-profiles.test.ts`

**Interfaces:**
- Consumes: `Endpoint`; `TransferPlan`; `remapOptionalProfileId`, `ProfileMap`; `insertRows`, `patchRows`.
- Produces: `const SYSTEM_PROFILE_EMAIL = "admin@studenti.czu.cz"`; `interface ProfileStageReport { inserted: number; teamPatched: number }`; `buildProfileInsertRows(plan: TransferPlan): TablesInsert<"profiles">[]`; `transferProfiles(target: Endpoint, plan: TransferPlan): Promise<ProfileStageReport>`.

`buildProfileInsertRows` is pure and carries the R1/R3/R7 guarantees, so it is the unit-tested part. It returns the `System` profile first, because all 64 self-referencing `created_by_profile_id` values point at it.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/transfer/stage-profiles.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { Tables } from "@/lib/supabase/database.types";

import { buildProfileMap } from "../../../scripts/transfer/profile-map";
import type { TransferPlan } from "../../../scripts/transfer/preflight";
import { buildProfileInsertRows } from "../../../scripts/transfer/stage-profiles";

function profile(overrides: Partial<Tables<"profiles">>): Tables<"profiles"> {
  return {
    id: "p1",
    name: "Somebody",
    picture: null,
    user_id: null,
    work_email: "somebody@studenti.czu.cz",
    role: "student",
    team_id: null,
    phone_number: null,
    personal_email: null,
    date_of_birth: null,
    access_removed_at: null,
    access_removed_by_profile_id: null,
    beta_access_granted_at: null,
    created_at: "2020-01-01T00:00:00+00:00",
    updated_at: "2020-01-02T00:00:00+00:00",
    created_by_profile_id: null,
    updated_by_profile_id: null,
    ...overrides,
  };
}

const SYSTEM = profile({
  id: "sys",
  name: "System",
  work_email: "admin@studenti.czu.cz",
  role: "admin",
});

const STUDENT = profile({
  id: "stu",
  work_email: "xnovy001@studenti.czu.cz",
  created_by_profile_id: "sys",
  updated_by_profile_id: "sys",
  user_id: "local-user-1",
  created_at: "2021-05-05T10:00:00+00:00",
  updated_at: "2021-05-06T10:00:00+00:00",
});

const REUSED = profile({
  id: "src-kulo",
  work_email: "xkulo007@studenti.czu.cz",
  role: "student",
  team_id: "team-1",
});

function makePlan(): TransferPlan {
  const sourceProfiles = [STUDENT, SYSTEM, REUSED];
  const targetProfiles = [profile({ id: "tgt-kulo", work_email: "xkulo007@studenti.czu.cz", role: "admin" })];
  const counts = {
    books: 0, tags: 0, book_tags: 0, essays: 0, essay_revisions: 0, essay_comments: 0,
  };
  return {
    sourceProfiles,
    targetProfiles,
    profileMap: buildProfileMap(sourceProfiles, targetProfiles),
    sourceCounts: counts,
    targetCounts: counts,
  };
}

describe("buildProfileInsertRows", () => {
  it("excludes profiles that already exist in the target (R3)", () => {
    const ids = buildProfileInsertRows(makePlan()).map((row) => row.id);

    expect(ids).not.toContain("src-kulo");
    expect(ids.sort()).toEqual(["stu", "sys"]);
  });

  it("puts the System profile first, since other rows reference it", () => {
    expect(buildProfileInsertRows(makePlan())[0].id).toBe("sys");
  });

  it("preserves created_at and updated_at (R1)", () => {
    const row = buildProfileInsertRows(makePlan()).find((r) => r.id === "stu");

    expect(row?.created_at).toBe("2021-05-05T10:00:00+00:00");
    expect(row?.updated_at).toBe("2021-05-06T10:00:00+00:00");
  });

  it("forces user_id to null (R7)", () => {
    const row = buildProfileInsertRows(makePlan()).find((r) => r.id === "stu");

    expect(row?.user_id).toBeNull();
  });

  it("remaps audit columns through the profile map", () => {
    const row = buildProfileInsertRows(makePlan()).find((r) => r.id === "stu");

    expect(row?.created_by_profile_id).toBe("sys");
    expect(row?.updated_by_profile_id).toBe("sys");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/transfer/stage-profiles.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/transfer/stage-profiles.ts`:

```ts
import type { Tables, TablesInsert } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import type { TransferPlan } from "./preflight";
import { remapOptionalProfileId } from "./profile-map";
import { insertRows, patchRows } from "./rest";

export const SYSTEM_PROFILE_EMAIL = "admin@studenti.czu.cz";

export interface ProfileStageReport {
  readonly inserted: number;
  readonly teamPatched: number;
}

function toInsertRow(
  profile: Tables<"profiles">,
  plan: TransferPlan,
): TablesInsert<"profiles"> {
  return {
    ...profile,
    // Auth users are environment-specific (R7).
    user_id: null,
    access_removed_by_profile_id: remapOptionalProfileId(
      plan.profileMap,
      profile.access_removed_by_profile_id,
    ),
    created_by_profile_id: remapOptionalProfileId(
      plan.profileMap,
      profile.created_by_profile_id,
    ),
    updated_by_profile_id: remapOptionalProfileId(
      plan.profileMap,
      profile.updated_by_profile_id,
    ),
  };
}

/**
 * Rows to insert, System first: every self-referencing
 * `created_by_profile_id` in the source points at it.
 */
export function buildProfileInsertRows(plan: TransferPlan): TablesInsert<"profiles">[] {
  const rows = plan.sourceProfiles
    .filter((profile) => plan.profileMap.insertIds.has(profile.id))
    .map((profile) => toInsertRow(profile, plan));

  return rows.sort((a, b) => {
    const aSystem = a.work_email === SYSTEM_PROFILE_EMAIL ? 0 : 1;
    const bSystem = b.work_email === SYSTEM_PROFILE_EMAIL ? 0 : 1;
    return aSystem - bSystem;
  });
}

export async function transferProfiles(
  target: Endpoint,
  plan: TransferPlan,
): Promise<ProfileStageReport> {
  const rows = buildProfileInsertRows(plan);

  // One request: self-references resolve because FK triggers fire at statement end.
  await insertRows(target, "profiles", rows);

  let teamPatched = 0;
  for (const collision of plan.profileMap.collisions) {
    const sourceProfile = plan.sourceProfiles.find((p) => p.id === collision.sourceId);
    if (sourceProfile?.team_id == null) continue;

    // team_id is the ONLY column written to an existing target profile (R3).
    await patchRows(target, "profiles", `id=eq.${collision.targetId}`, {
      team_id: sourceProfile.team_id,
    });
    teamPatched += 1;
  }

  return { inserted: rows.length, teamPatched };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit tests/unit/transfer/stage-profiles.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Wire the stage into the CLI**

Add the import to `scripts/transfer/transfer-essays.ts`:

```ts
import { transferProfiles } from "./stage-profiles";
```

Replace `console.log("\nStages not yet implemented.");` with:

```ts
  section("Profiles");
  const profiles = await transferProfiles(target, plan);
  console.log(`  inserted ${profiles.inserted}, team_id patched ${profiles.teamPatched}`);
```

- [ ] **Step 6: Run against preview and verify**

Run: `pnpm typecheck && pnpm test:unit`
Expected: all pass.

Run: `pnpm transfer:essays --target=preview`
Expected: `inserted 190, team_id patched 2` (Protiva has no local team, so 2 not 3).

Verify with:

```bash
set -a && . ./.env.transfer.local && set +a
curl -s "$PREVIEW_SUPABASE_URL/rest/v1/profiles?select=id&limit=1" \
  -H "apikey: $PREVIEW_SERVICE_ROLE_KEY" -H "Authorization: Bearer $PREVIEW_SERVICE_ROLE_KEY" \
  -H "Prefer: count=exact" -H "Range: 0-0" -D - -o /dev/null | grep -i content-range
curl -s "$PREVIEW_SUPABASE_URL/rest/v1/profiles?select=work_email,role,team_id,user_id&work_email=in.(xkulo007@studenti.czu.cz,xprot040@studenti.czu.cz,xscho008@studenti.czu.cz)" \
  -H "apikey: $PREVIEW_SERVICE_ROLE_KEY" -H "Authorization: Bearer $PREVIEW_SERVICE_ROLE_KEY"
```

Expected: count `0-0/193`; the two admins still `admin` with their `user_id` intact; `xkulo007` and `xscho008` now have non-null `team_id`.

**If either admin's role changed, stop immediately and roll back** — R3 was violated.

- [ ] **Step 7: Commit**

```bash
git add scripts/transfer/stage-profiles.ts scripts/transfer/transfer-essays.ts tests/unit/transfer/stage-profiles.test.ts
git commit -m "feat(transfer): transfer profiles and patch reused team_id"
```

---

### Task 10: Catalog stage (books, tags, book_tags)

**Files:**
- Create: `scripts/transfer/stage-catalog.ts`
- Modify: `scripts/transfer/transfer-essays.ts`
- Test: `tests/unit/transfer/stage-catalog.test.ts`

**Interfaces:**
- Consumes: `Endpoint`; `TransferPlan`; `remapProfileId`, `remapOptionalProfileId`; `chunk`, `insertRows`, `selectAll`.
- Produces: `const INSERT_CHUNK = 200`; `interface CatalogStageReport { books: number; tags: number; bookTags: number }`; `buildBookInsertRows(books: readonly Tables<"books">[], plan: TransferPlan): TablesInsert<"books">[]`; `transferCatalog(source: Endpoint, target: Endpoint, plan: TransferPlan): Promise<CatalogStageReport>`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/transfer/stage-catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { Tables } from "@/lib/supabase/database.types";

import { buildProfileMap } from "../../../scripts/transfer/profile-map";
import type { TransferPlan } from "../../../scripts/transfer/preflight";
import { buildBookInsertRows } from "../../../scripts/transfer/stage-catalog";

const COUNTS = {
  books: 0, tags: 0, book_tags: 0, essays: 0, essay_revisions: 0, essay_comments: 0,
};

function plan(): TransferPlan {
  const sourceProfiles = [
    { id: "src-kulo", work_email: "xkulo007@studenti.czu.cz" },
    { id: "sys", work_email: "admin@studenti.czu.cz" },
  ] as unknown as Tables<"profiles">[];
  const targetProfiles = [
    { id: "tgt-kulo", work_email: "xkulo007@studenti.czu.cz" },
  ] as unknown as Tables<"profiles">[];

  return {
    sourceProfiles,
    targetProfiles,
    profileMap: buildProfileMap(sourceProfiles, targetProfiles),
    sourceCounts: COUNTS,
    targetCounts: COUNTS,
  };
}

const BOOK = {
  id: "b1",
  created_by_profile_id: "sys",
  updated_by_profile_id: "src-kulo",
  status_changed_by_profile_id: "src-kulo",
  created_at: "2019-10-23T08:00:00+00:00",
  updated_at: "2019-10-24T08:00:00+00:00",
  title_cs: "Kniha",
} as unknown as Tables<"books">;

describe("buildBookInsertRows", () => {
  it("remaps a colliding audit profile id", () => {
    const [row] = buildBookInsertRows([BOOK], plan());

    expect(row.updated_by_profile_id).toBe("tgt-kulo");
    expect(row.status_changed_by_profile_id).toBe("tgt-kulo");
  });

  it("leaves a non-colliding audit profile id alone", () => {
    expect(buildBookInsertRows([BOOK], plan())[0].created_by_profile_id).toBe("sys");
  });

  it("preserves created_at and updated_at (R1)", () => {
    const [row] = buildBookInsertRows([BOOK], plan());

    expect(row.created_at).toBe("2019-10-23T08:00:00+00:00");
    expect(row.updated_at).toBe("2019-10-24T08:00:00+00:00");
  });

  it("passes a null status_changed_by_profile_id through", () => {
    const rows = buildBookInsertRows(
      [{ ...BOOK, status_changed_by_profile_id: null }],
      plan(),
    );

    expect(rows[0].status_changed_by_profile_id).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/transfer/stage-catalog.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/transfer/stage-catalog.ts`:

```ts
import type { Tables, TablesInsert } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import type { TransferPlan } from "./preflight";
import { remapOptionalProfileId, remapProfileId } from "./profile-map";
import { chunk, insertRows, selectAll } from "./rest";

export const INSERT_CHUNK = 200;

export interface CatalogStageReport {
  readonly books: number;
  readonly tags: number;
  readonly bookTags: number;
}

export function buildBookInsertRows(
  books: readonly Tables<"books">[],
  plan: TransferPlan,
): TablesInsert<"books">[] {
  return books.map((book) => ({
    ...book,
    created_by_profile_id: remapProfileId(plan.profileMap, book.created_by_profile_id),
    updated_by_profile_id: remapProfileId(plan.profileMap, book.updated_by_profile_id),
    status_changed_by_profile_id: remapOptionalProfileId(
      plan.profileMap,
      book.status_changed_by_profile_id,
    ),
  }));
}

async function insertChunked(
  target: Endpoint,
  table: string,
  rows: readonly unknown[],
  onConflict?: string,
): Promise<number> {
  for (const batch of chunk(rows, INSERT_CHUNK)) {
    await insertRows(target, table, batch, onConflict);
  }
  return rows.length;
}

export async function transferCatalog(
  source: Endpoint,
  target: Endpoint,
  plan: TransferPlan,
): Promise<CatalogStageReport> {
  const books = await selectAll<Tables<"books">>(source, "books");
  const bookCount = await insertChunked(target, "books", buildBookInsertRows(books, plan));

  const tags = await selectAll<Tables<"tags">>(source, "tags");
  const tagCount = await insertChunked(target, "tags", tags);

  const bookTags = await selectAll<Tables<"book_tags">>(source, "book_tags");
  const bookTagCount = await insertChunked(
    target,
    "book_tags",
    bookTags,
    "book_id,tag_id",
  );

  return { books: bookCount, tags: tagCount, bookTags: bookTagCount };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit tests/unit/transfer/stage-catalog.test.ts`
Expected: PASS (4 tests).

If `tags` or `book_tags` has audit columns referencing profiles, `pnpm typecheck` will not catch it (they are plain inserts). Confirm with:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "\d book_tags" -c "\d tags"
```

If either has a `*_profile_id` column, remap it exactly as `buildBookInsertRows` does and add a matching test before continuing.

- [ ] **Step 5: Wire the stage into the CLI**

Add the import:

```ts
import { transferCatalog } from "./stage-catalog";
```

Append after the profiles block:

```ts
  section("Catalog");
  const catalog = await transferCatalog(source, target, plan);
  console.log(
    `  books ${catalog.books}, tags ${catalog.tags}, book_tags ${catalog.bookTags}`,
  );
```

- [ ] **Step 6: Run against preview and verify**

Run: `pnpm typecheck && pnpm test:unit`
Expected: all pass.

Run: `pnpm transfer:essays --target=preview --resume`
Expected: `books 618, tags 8, book_tags 616`.

Run: `pnpm transfer:essays:dry`
Expected: `books: source 618, target 618`, `tags: source 8, target 8`, `book_tags: source 616, target 616`.

- [ ] **Step 7: Commit**

```bash
git add scripts/transfer/stage-catalog.ts scripts/transfer/transfer-essays.ts tests/unit/transfer/stage-catalog.test.ts
git commit -m "feat(transfer): transfer books, tags and book_tags"
```

---

### Task 11: Storage sync stage

**Files:**
- Create: `scripts/transfer/stage-storage.ts`
- Modify: `scripts/transfer/transfer-essays.ts`
- Test: `tests/unit/transfer/stage-storage.test.ts`

**Interfaces:**
- Consumes: `Endpoint`; `collectLocalObjectPaths`; `headObject`, `downloadObject`, `uploadObject`, `mapWithConcurrency`; `selectAll`.
- Produces: `const STORAGE_CONCURRENCY = 8`; `interface StorageStageReport { referenced: number; alreadyPresent: number; uploaded: number }`; `collectAllObjectPaths(revisions: readonly Pick<Tables<"essay_revisions">, "content_json">[], localPrefix: string): string[]`; `syncStorage(source: Endpoint, target: Endpoint, paths: readonly string[]): Promise<StorageStageReport>`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/transfer/stage-storage.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { collectAllObjectPaths } from "../../../scripts/transfer/stage-storage";

const PREFIX = "http://127.0.0.1:54321/storage/v1/object/public/images";

describe("collectAllObjectPaths", () => {
  it("deduplicates paths across revisions", () => {
    const revisions = [
      { content_json: { attrs: { src: `${PREFIX}/a/1.png` } } },
      { content_json: { attrs: { src: `${PREFIX}/a/1.png` } } },
      { content_json: { attrs: { src: `${PREFIX}/b/2.png` } } },
    ];

    expect(collectAllObjectPaths(revisions, PREFIX).sort()).toEqual(["a/1.png", "b/2.png"]);
  });

  it("ignores revisions with no local images", () => {
    const revisions = [
      { content_json: { attrs: { src: "https://example.com/x.png" } } },
      { content_json: { type: "doc", content: [] } },
    ];

    expect(collectAllObjectPaths(revisions, PREFIX)).toEqual([]);
  });

  it("returns an empty list for no revisions", () => {
    expect(collectAllObjectPaths([], PREFIX)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/transfer/stage-storage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/transfer/stage-storage.ts`:

```ts
import type { Tables } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import { collectLocalObjectPaths } from "./content-rewrite";
import {
  downloadObject,
  headObject,
  mapWithConcurrency,
  uploadObject,
} from "./storage";

export const STORAGE_CONCURRENCY = 8;

export interface StorageStageReport {
  readonly referenced: number;
  readonly alreadyPresent: number;
  readonly uploaded: number;
}

export function collectAllObjectPaths(
  revisions: readonly Pick<Tables<"essay_revisions">, "content_json">[],
  localPrefix: string,
): string[] {
  const paths = new Set<string>();
  for (const revision of revisions) {
    for (const path of collectLocalObjectPaths(revision.content_json, localPrefix)) {
      paths.add(path);
    }
  }
  return [...paths];
}

/**
 * Ensures every referenced object exists in the target. Driven by referenced
 * paths, so unreferenced source objects are never uploaded.
 */
export async function syncStorage(
  source: Endpoint,
  target: Endpoint,
  paths: readonly string[],
): Promise<StorageStageReport> {
  let alreadyPresent = 0;
  let uploaded = 0;
  let processed = 0;

  await mapWithConcurrency(paths, STORAGE_CONCURRENCY, async (path) => {
    const [targetHead, sourceHead] = await Promise.all([
      headObject(target, path),
      headObject(source, path),
    ]);

    if (!sourceHead.exists) {
      throw new Error(`Source object missing from local storage: ${path}`);
    }

    if (targetHead.exists && targetHead.size === sourceHead.size) {
      alreadyPresent += 1;
    } else {
      const object = await downloadObject(source, path);
      await uploadObject(target, path, object.bytes, object.contentType);
      uploaded += 1;
    }

    processed += 1;
    if (processed % 100 === 0) {
      process.stdout.write(`\r  ${processed}/${paths.length} (${uploaded} uploaded)`);
    }
  });

  process.stdout.write(`\r  ${paths.length}/${paths.length} (${uploaded} uploaded)\n`);
  return { referenced: paths.length, alreadyPresent, uploaded };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit tests/unit/transfer/stage-storage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the stage into the CLI**

Add imports:

```ts
import type { Tables } from "@/lib/supabase/database.types";

import { selectAll } from "./rest";
import { collectAllObjectPaths, syncStorage } from "./stage-storage";
```

Append after the catalog block:

```ts
  section("Revisions load");
  const revisions = await selectAll<Tables<"essay_revisions">>(source, "essay_revisions");
  console.log(`  loaded ${revisions.length} revisions`);

  section("Storage");
  const objectPaths = collectAllObjectPaths(revisions, source.publicImagePrefix);
  const storage = await syncStorage(source, target, objectPaths);
  console.log(
    `  referenced ${storage.referenced}, already present ${storage.alreadyPresent}, uploaded ${storage.uploaded}`,
  );
```

- [ ] **Step 6: Run against preview and verify**

Run: `pnpm typecheck && pnpm test:unit`
Expected: all pass.

Run: `pnpm transfer:essays --target=preview --resume`
Expected: `loaded 6595 revisions`; `referenced 1745`, and `already present + uploaded === 1745`. Most should already be present from the earlier partial runs; expect a small number of uploads.

**If `referenced` is not 1745, stop and investigate** — the source data or the prefix changed since the spec was written.

- [ ] **Step 7: Commit**

```bash
git add scripts/transfer/stage-storage.ts scripts/transfer/transfer-essays.ts tests/unit/transfer/stage-storage.test.ts
git commit -m "feat(transfer): sync referenced essay images to target storage"
```

---

### Task 12: Essays, revisions and comments stage

**Files:**
- Create: `scripts/transfer/stage-essays.ts`
- Modify: `scripts/transfer/transfer-essays.ts`
- Test: `tests/unit/transfer/stage-essays.test.ts`

**Interfaces:**
- Consumes: `Endpoint`; `TransferPlan`; `remapProfileId`, `remapOptionalProfileId`; `rewriteLocalStorageUrls`; `chunk`, `insertRows`, `selectAll`; `INSERT_CHUNK` from `./stage-catalog`.
- Produces: `interface EssayStageReport { essays: number; revisions: number; rewrittenUrls: number; comments: number }`; `buildEssayInsertRows(essays: readonly Tables<"essays">[], plan: TransferPlan): TablesInsert<"essays">[]`; `buildRevisionInsertRows(revisions: readonly Tables<"essay_revisions">[], plan: TransferPlan, fromPrefix: string, toPrefix: string): { rows: TablesInsert<"essay_revisions">[]; rewritten: number }`; `buildCommentInsertRows(comments: readonly Tables<"essay_comments">[], plan: TransferPlan): TablesInsert<"essay_comments">[]`; `transferEssays(source: Endpoint, target: Endpoint, plan: TransferPlan, revisions: readonly Tables<"essay_revisions">[]): Promise<EssayStageReport>`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/transfer/stage-essays.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { Tables } from "@/lib/supabase/database.types";

import { buildProfileMap } from "../../../scripts/transfer/profile-map";
import type { TransferPlan } from "../../../scripts/transfer/preflight";
import {
  buildCommentInsertRows,
  buildEssayInsertRows,
  buildRevisionInsertRows,
} from "../../../scripts/transfer/stage-essays";

const FROM = "http://127.0.0.1:54321/storage/v1/object/public/images";
const TO = "https://preview.supabase.co/storage/v1/object/public/images";

const COUNTS = {
  books: 0, tags: 0, book_tags: 0, essays: 0, essay_revisions: 0, essay_comments: 0,
};

function plan(): TransferPlan {
  const sourceProfiles = [
    { id: "src-kulo", work_email: "xkulo007@studenti.czu.cz" },
    { id: "sys", work_email: "admin@studenti.czu.cz" },
  ] as unknown as Tables<"profiles">[];
  const targetProfiles = [
    { id: "tgt-kulo", work_email: "xkulo007@studenti.czu.cz" },
  ] as unknown as Tables<"profiles">[];

  return {
    sourceProfiles,
    targetProfiles,
    profileMap: buildProfileMap(sourceProfiles, targetProfiles),
    sourceCounts: COUNTS,
    targetCounts: COUNTS,
  };
}

const ESSAY = {
  id: "e1",
  external_id: "1897",
  author_profile_id: "src-kulo",
  book_id: null,
  published_at: "2019-10-23T08:00:00+00:00",
  pinned_at: null,
  pinned_by_profile_id: null,
  removed_at: null,
  created_at: "2019-10-23T08:00:00+00:00",
  updated_at: "2019-10-23T09:00:00+00:00",
  created_by_profile_id: "sys",
  updated_by_profile_id: "sys",
} as unknown as Tables<"essays">;

describe("buildEssayInsertRows", () => {
  it("remaps the author to the existing target profile", () => {
    expect(buildEssayInsertRows([ESSAY], plan())[0].author_profile_id).toBe("tgt-kulo");
  });

  it("preserves created_at and updated_at (R1)", () => {
    const [row] = buildEssayInsertRows([ESSAY], plan());

    expect(row.created_at).toBe("2019-10-23T08:00:00+00:00");
    expect(row.updated_at).toBe("2019-10-23T09:00:00+00:00");
  });

  it("keeps the primary key and external_id", () => {
    const [row] = buildEssayInsertRows([ESSAY], plan());

    expect(row.id).toBe("e1");
    expect(row.external_id).toBe("1897");
  });

  it("passes a null pinned_by_profile_id through", () => {
    expect(buildEssayInsertRows([ESSAY], plan())[0].pinned_by_profile_id).toBeNull();
  });
});

describe("buildRevisionInsertRows", () => {
  const REVISION = {
    essay_id: "e1",
    revision_no: 1,
    title: "T",
    content_json: {
      content: [
        { type: "image", attrs: { src: `${FROM}/essay-images/import/1897/a.png` } },
        { type: "image", attrs: { src: "https://example.com/keep.png" } },
      ],
    },
    invalid_since: null,
    created_at: "2019-10-23T08:00:00+00:00",
    updated_at: "2019-10-23T08:00:00+00:00",
    created_by_profile_id: "sys",
    updated_by_profile_id: "src-kulo",
  } as unknown as Tables<"essay_revisions">;

  it("rewrites local srcs and counts them", () => {
    const { rows, rewritten } = buildRevisionInsertRows([REVISION], plan(), FROM, TO);
    const content = rows[0].content_json as { content: { attrs: { src: string } }[] };

    expect(content.content[0].attrs.src).toBe(`${TO}/essay-images/import/1897/a.png`);
    expect(rewritten).toBe(1);
  });

  it("leaves external srcs untouched", () => {
    const { rows } = buildRevisionInsertRows([REVISION], plan(), FROM, TO);
    const content = rows[0].content_json as { content: { attrs: { src: string } }[] };

    expect(content.content[1].attrs.src).toBe("https://example.com/keep.png");
  });

  it("remaps audit columns and preserves the composite key", () => {
    const { rows } = buildRevisionInsertRows([REVISION], plan(), FROM, TO);

    expect(rows[0].updated_by_profile_id).toBe("tgt-kulo");
    expect(rows[0].created_by_profile_id).toBe("sys");
    expect(rows[0].essay_id).toBe("e1");
    expect(rows[0].revision_no).toBe(1);
  });

  it("preserves created_at and updated_at (R1)", () => {
    const { rows } = buildRevisionInsertRows([REVISION], plan(), FROM, TO);

    expect(rows[0].created_at).toBe("2019-10-23T08:00:00+00:00");
  });
});

describe("buildCommentInsertRows", () => {
  const COMMENT = {
    id: "c1",
    essay_id: "e1",
    author_profile_id: "src-kulo",
    body: "hi",
    removed_at: null,
    created_at: "2020-01-01T00:00:00+00:00",
    updated_at: "2020-01-01T00:00:00+00:00",
    created_by_profile_id: "sys",
    updated_by_profile_id: "sys",
  } as unknown as Tables<"essay_comments">;

  it("remaps the author and preserves timestamps", () => {
    const [row] = buildCommentInsertRows([COMMENT], plan());

    expect(row.author_profile_id).toBe("tgt-kulo");
    expect(row.created_at).toBe("2020-01-01T00:00:00+00:00");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/transfer/stage-essays.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/transfer/stage-essays.ts`:

```ts
import type { Json, Tables, TablesInsert } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import { rewriteLocalStorageUrls } from "./content-rewrite";
import type { TransferPlan } from "./preflight";
import { remapOptionalProfileId, remapProfileId } from "./profile-map";
import { chunk, insertRows, selectAll } from "./rest";
import { INSERT_CHUNK } from "./stage-catalog";

const REVISION_ON_CONFLICT = "essay_id,revision_no";

export interface EssayStageReport {
  readonly essays: number;
  readonly revisions: number;
  readonly rewrittenUrls: number;
  readonly comments: number;
}

export function buildEssayInsertRows(
  essays: readonly Tables<"essays">[],
  plan: TransferPlan,
): TablesInsert<"essays">[] {
  return essays.map((essay) => ({
    ...essay,
    author_profile_id: remapProfileId(plan.profileMap, essay.author_profile_id),
    pinned_by_profile_id: remapOptionalProfileId(
      plan.profileMap,
      essay.pinned_by_profile_id,
    ),
    created_by_profile_id: remapProfileId(plan.profileMap, essay.created_by_profile_id),
    updated_by_profile_id: remapProfileId(plan.profileMap, essay.updated_by_profile_id),
  }));
}

export function buildRevisionInsertRows(
  revisions: readonly Tables<"essay_revisions">[],
  plan: TransferPlan,
  fromPrefix: string,
  toPrefix: string,
): { rows: TablesInsert<"essay_revisions">[]; rewritten: number } {
  let rewritten = 0;

  const rows = revisions.map((revision) => {
    const result = rewriteLocalStorageUrls(revision.content_json, fromPrefix, toPrefix);
    rewritten += result.rewritten;

    return {
      ...revision,
      content_json: result.value as Json,
      created_by_profile_id: remapProfileId(plan.profileMap, revision.created_by_profile_id),
      updated_by_profile_id: remapProfileId(plan.profileMap, revision.updated_by_profile_id),
    };
  });

  return { rows, rewritten };
}

export function buildCommentInsertRows(
  comments: readonly Tables<"essay_comments">[],
  plan: TransferPlan,
): TablesInsert<"essay_comments">[] {
  return comments.map((comment) => ({
    ...comment,
    author_profile_id: remapProfileId(plan.profileMap, comment.author_profile_id),
    created_by_profile_id: remapProfileId(plan.profileMap, comment.created_by_profile_id),
    updated_by_profile_id: remapProfileId(plan.profileMap, comment.updated_by_profile_id),
  }));
}

export async function transferEssays(
  source: Endpoint,
  target: Endpoint,
  plan: TransferPlan,
  revisions: readonly Tables<"essay_revisions">[],
): Promise<EssayStageReport> {
  const essays = await selectAll<Tables<"essays">>(source, "essays");
  const essayRows = buildEssayInsertRows(essays, plan);
  for (const batch of chunk(essayRows, INSERT_CHUNK)) {
    await insertRows(target, "essays", batch);
  }

  const revisionResult = buildRevisionInsertRows(
    revisions,
    plan,
    source.publicImagePrefix,
    target.publicImagePrefix,
  );
  for (const batch of chunk(revisionResult.rows, INSERT_CHUNK)) {
    await insertRows(target, "essay_revisions", batch, REVISION_ON_CONFLICT);
  }

  const comments = await selectAll<Tables<"essay_comments">>(source, "essay_comments");
  const commentRows = buildCommentInsertRows(comments, plan);
  for (const batch of chunk(commentRows, INSERT_CHUNK)) {
    await insertRows(target, "essay_comments", batch);
  }

  return {
    essays: essayRows.length,
    revisions: revisionResult.rows.length,
    rewrittenUrls: revisionResult.rewritten,
    comments: commentRows.length,
  };
}
```

If `Json` is not exported from `database.types.ts`, drop it from the import and use `result.value as Tables<"essay_revisions">["content_json"]` instead. Check with:

```bash
grep -n "^export type Json" src/lib/supabase/database.types.ts
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit tests/unit/transfer/stage-essays.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Wire the stage into the CLI**

Add the import:

```ts
import { transferEssays } from "./stage-essays";
```

Append after the storage block:

```ts
  section("Essays");
  const essays = await transferEssays(source, target, plan, revisions);
  console.log(
    `  essays ${essays.essays}, revisions ${essays.revisions} (${essays.rewrittenUrls} urls rewritten), comments ${essays.comments}`,
  );
```

- [ ] **Step 6: Run against preview and verify**

Run: `pnpm typecheck && pnpm test:unit`
Expected: all pass.

Run: `pnpm transfer:essays --target=preview --resume`
Expected: `essays 6595, revisions 6595 (1753 urls rewritten), comments 220`.

The rewritten count is **1753**, not 1745: 1745 is the number of *distinct* srcs, while 1753 counts every occurrence.

Verify chronology survived (the R1 guard):

```bash
set -a && . ./.env.transfer.local && set +a
curl -s "$PREVIEW_SUPABASE_URL/rest/v1/essays?select=created_at&order=created_at.asc&limit=1" \
  -H "apikey: $PREVIEW_SERVICE_ROLE_KEY" -H "Authorization: Bearer $PREVIEW_SERVICE_ROLE_KEY"
curl -s "$PREVIEW_SUPABASE_URL/rest/v1/essays?select=created_at&order=created_at.desc&limit=1" \
  -H "apikey: $PREVIEW_SERVICE_ROLE_KEY" -H "Authorization: Bearer $PREVIEW_SERVICE_ROLE_KEY"
```

Expected: earliest `2019-10-23`, latest `2026-07-23`. **If both are today's date, R1 was violated — roll back and fix before continuing.**

- [ ] **Step 7: Commit**

```bash
git add scripts/transfer/stage-essays.ts scripts/transfer/transfer-essays.ts tests/unit/transfer/stage-essays.test.ts
git commit -m "feat(transfer): transfer essays, revisions and comments"
```

---

### Task 13: Verification stage

**Files:**
- Create: `scripts/transfer/verify.ts`
- Modify: `scripts/transfer/transfer-essays.ts`
- Test: `tests/unit/transfer/verify.test.ts`

**Interfaces:**
- Consumes: `Endpoint`; `TransferPlan`, `DATA_TABLES`; `countRows`, `selectAll`; `headObject`.
- Produces: `interface Check { name: string; passed: boolean; detail: string }`; `compareCounts(sourceCounts, targetCounts): Check[]`; `verifyTransfer(source: Endpoint, target: Endpoint, plan: TransferPlan): Promise<Check[]>`.
- Also modifies: `scripts/transfer/rest.ts` — `selectAll` gains a fourth parameter `query = ""` for filters and ordering. Verification needs `order=`/`limit=`/`like.` clauses, and appending them to the `table` argument would emit a malformed URL with two `?`.

- [ ] **Step 1: Write the failing tests**

First extend `tests/unit/transfer/rest.test.ts` — add this inside the existing `describe("selectAll", …)` block:

```ts
  it("appends an extra query when given one", async () => {
    const calls = stubFetch([jsonResponse([])]);
    await selectAll(ENDPOINT, "essays", "id", "order=created_at.asc&limit=1");

    expect(calls[0].url).toContain("&order=created_at.asc&limit=1");
  });
```

Then create `tests/unit/transfer/verify.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { DataTable } from "../../../scripts/transfer/preflight";
import { compareCounts } from "../../../scripts/transfer/verify";

const SOURCE: Record<DataTable, number> = {
  books: 618, tags: 8, book_tags: 616, essays: 6595, essay_revisions: 6595, essay_comments: 220,
};

describe("compareCounts", () => {
  it("passes when every table matches", () => {
    expect(compareCounts(SOURCE, { ...SOURCE }).every((check) => check.passed)).toBe(true);
  });

  it("fails the specific table that differs", () => {
    const checks = compareCounts(SOURCE, { ...SOURCE, essays: 6594 });
    const failed = checks.filter((check) => !check.passed);

    expect(failed).toHaveLength(1);
    expect(failed[0].name).toBe("count:essays");
    expect(failed[0].detail).toContain("6595");
    expect(failed[0].detail).toContain("6594");
  });

  it("returns one check per data table", () => {
    expect(compareCounts(SOURCE, { ...SOURCE })).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit tests/unit/transfer/verify.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

First, in `scripts/transfer/rest.ts`, replace the `selectAll` implementation with this version (adds the `query` parameter, default `""`, so existing callers are unaffected):

```ts
export async function selectAll<T>(
  endpoint: Endpoint,
  table: string,
  select = "*",
  query = "",
): Promise<T[]> {
  const rows: T[] = [];
  const suffix = query === "" ? "" : `&${query}`;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = `${endpoint.restUrl}/${table}?select=${encodeURIComponent(select)}&limit=${PAGE_SIZE}&offset=${offset}${suffix}`;
    const response = await fetch(url, { headers: headers(endpoint) });
    if (!response.ok) throw await failure(`GET ${table}`, response);
    const page = (await response.json()) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}
```

Then create `scripts/transfer/verify.ts`:

```ts
import type { Tables } from "@/lib/supabase/database.types";

import type { Endpoint } from "./config";
import { DATA_TABLES, type DataTable, type TransferPlan } from "./preflight";
import { countRows, selectAll } from "./rest";
import { headObject } from "./storage";

const LOCALHOST_MARKER = "127.0.0.1";
const IMAGE_SAMPLE_SIZE = 25;

export interface Check {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export function compareCounts(
  sourceCounts: Readonly<Record<DataTable, number>>,
  targetCounts: Readonly<Record<DataTable, number>>,
): Check[] {
  return DATA_TABLES.map((table) => ({
    name: `count:${table}`,
    passed: sourceCounts[table] === targetCounts[table],
    detail: `source ${sourceCounts[table]}, target ${targetCounts[table]}`,
  }));
}

export async function verifyTransfer(
  source: Endpoint,
  target: Endpoint,
  plan: TransferPlan,
): Promise<Check[]> {
  const checks: Check[] = [];

  const targetCounts = Object.fromEntries(
    await Promise.all(
      DATA_TABLES.map(async (table) => [table, await countRows(target, table)] as const),
    ),
  ) as Record<DataTable, number>;
  checks.push(...compareCounts(plan.sourceCounts, targetCounts));

  const targetProfileCount = await countRows(target, "profiles");
  checks.push({
    name: "count:profiles",
    passed: targetProfileCount === plan.sourceProfiles.length,
    detail: `source ${plan.sourceProfiles.length}, target ${targetProfileCount}`,
  });

  const targetTeams = await selectAll<{ id: string }>(target, "teams", "id");
  const sourceTeams = await selectAll<{ id: string }>(source, "teams", "id");
  checks.push({
    name: "teams:unchanged",
    passed: targetTeams.length === sourceTeams.length,
    detail: `source ${sourceTeams.length}, target ${targetTeams.length}`,
  });

  // Reused profiles must keep their original role and user_id (R3).
  for (const collision of plan.profileMap.collisions) {
    const before = plan.targetProfiles.find((p) => p.id === collision.targetId);
    const [after] = await selectAll<Tables<"profiles">>(
      target,
      "profiles",
      "*",
    ).then((rows) => rows.filter((row) => row.id === collision.targetId));

    checks.push({
      name: `profile:preserved:${collision.workEmail}`,
      passed: after?.role === before?.role && after?.user_id === before?.user_id,
      detail: `role ${before?.role} -> ${after?.role}, user_id ${before?.user_id} -> ${after?.user_id}`,
    });
  }

  // No local URL may survive in the target (R5).
  const leaked = await selectAll<{ essay_id: string }>(
    target,
    "essay_revisions",
    "essay_id",
    `content_json=like.*${LOCALHOST_MARKER}*`,
  ).catch(() => null);
  checks.push({
    name: "content_json:no-localhost",
    passed: leaked !== null && leaked.length === 0,
    detail:
      leaked === null
        ? "query failed — check manually"
        : `${leaked.length} revisions still reference ${LOCALHOST_MARKER}`,
  });

  // Chronology survived (R1).
  const [earliest] = await selectAll<Pick<Tables<"essays">, "created_at">>(
    target,
    "essays",
    "created_at",
    "order=created_at.asc&limit=1",
  );
  const [sourceEarliest] = await selectAll<Pick<Tables<"essays">, "created_at">>(
    source,
    "essays",
    "created_at",
    "order=created_at.asc&limit=1",
  );
  checks.push({
    name: "essays:earliest-created_at",
    passed: earliest?.created_at === sourceEarliest?.created_at,
    detail: `source ${sourceEarliest?.created_at}, target ${earliest?.created_at}`,
  });

  // A sample of images actually resolves in the target.
  const revisions = await selectAll<Pick<Tables<"essay_revisions">, "content_json">>(
    target,
    "essay_revisions",
    "content_json",
  );
  const sampleUrls = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      if (value.startsWith(target.publicImagePrefix)) {
        sampleUrls.add(value.slice(`${target.publicImagePrefix}/`.length));
      }
      return;
    }
    if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === "object") Object.values(value).forEach(walk);
  };
  revisions.forEach((revision) => walk(revision.content_json));

  const sample = [...sampleUrls].slice(0, IMAGE_SAMPLE_SIZE);
  const heads = await Promise.all(sample.map((path) => headObject(target, decodeURIComponent(path))));
  const missing = heads.filter((head) => !head.exists).length;
  checks.push({
    name: "storage:sample-resolves",
    passed: missing === 0,
    detail: `${sample.length - missing}/${sample.length} sampled images resolve`,
  });

  return checks;
}
```

Note the `profile:preserved` check compares against `plan.targetProfiles`, captured during preflight *before* any write — that snapshot is what makes the R3 assertion meaningful.

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm test:unit`
Expected: all pass, including the new `selectAll` query test.

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Wire verification into the CLI**

Add the import:

```ts
import { verifyTransfer } from "./verify";
```

Append at the end of `main`, before it returns:

```ts
  section("Verification");
  const checks = await verifyTransfer(source, target, plan);
  for (const check of checks) {
    console.log(`  ${check.passed ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  }

  const failures = checks.filter((check) => !check.passed);
  if (failures.length > 0) {
    throw new Error(`${failures.length} verification check(s) failed`);
  }
  console.log("\nTransfer verified.");
```

- [ ] **Step 6: Run the full verification against preview**

Run: `pnpm transfer:essays --target=preview --resume`

Expected: every check PASS —
- `count:books source 618, target 618` and the same for `tags` 8, `book_tags` 616, `essays` 6595, `essay_revisions` 6595, `essay_comments` 220
- `count:profiles source 193, target 193`
- `teams:unchanged source 15, target 15`
- three `profile:preserved:*` checks showing role and `user_id` unchanged
- `content_json:no-localhost 0 revisions still reference 127.0.0.1`
- `essays:earliest-created_at source 2019-10-23…, target 2019-10-23…`
- `storage:sample-resolves 25/25`
- `Transfer verified.`

- [ ] **Step 7: Confirm idempotency by re-running**

Run: `pnpm transfer:essays --target=preview --resume`
Expected: identical PASS output, no duplicate-key errors, and counts unchanged — proving `resolution=ignore-duplicates` resumes rather than duplicating.

- [ ] **Step 8: Commit**

```bash
git add scripts/transfer/verify.ts scripts/transfer/rest.ts scripts/transfer/transfer-essays.ts tests/unit/transfer/verify.test.ts tests/unit/transfer/rest.test.ts
git commit -m "feat(transfer): verify transferred data and image availability"
```

---

### Task 14: Runbook and production readiness

**Files:**
- Create: `docs/runbooks/essay-data-transfer.md`
- Modify: `.env.transfer.local` is gitignored — document the required variables instead

- [ ] **Step 1: Write the runbook**

Create `docs/runbooks/essay-data-transfer.md` covering, in order:

1. **Purpose** — the local DB is the source of truth after manual post-import fixes; `scripts/essayimport/` cannot reproduce it.
2. **Required env vars** in `.env.transfer.local` (never committed): `LOCAL_SUPABASE_URL`, `LOCAL_SERVICE_ROLE_KEY`, `PREVIEW_SUPABASE_URL`, `PREVIEW_SERVICE_ROLE_KEY`, `PRODUCTION_SUPABASE_URL`, `PRODUCTION_SERVICE_ROLE_KEY`.
3. **Commands**: `pnpm transfer:essays:dry`, `pnpm transfer:essays --target=preview`, `--resume`, `--rollback`, and production's mandatory `--i-know-this-is-production`.
4. **Preconditions**: local Supabase running (`pnpm dev` or `pnpm supabase start`); target teams must already match by id and name.
5. **What is never touched**: `teams`, `users`, existing target profiles (except `team_id`), `reservations`, `rooms`, `essay_views`, `essay_votes`, `dashboard_layouts`, and target storage on rollback.
6. **Expected numbers** for preview, copied from Task 13's expected output, so a future operator can spot drift.
7. **Troubleshooting**: direct Postgres to preview is unreachable (IPv6-only, no pooler tenant) — the script uses PostgREST by design; storage "missing" is HTTP 400 not 404.

- [ ] **Step 2: Verify the docs link check passes**

Run: `pnpm wiki:doctor`
Expected: no broken links. If the runbook must be registered in a docs index, add it where the other runbooks in `docs/runbooks/` are listed.

- [ ] **Step 3: Run the test suite, typecheck and lint**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint`
Expected: all pass.

**Do not gate on `pnpm test`.** Verified 2026-07-26 at branch head `ea95b38`, before any transfer code existed: `src/components/essays/topic-pills.test.tsx` fails 4 tests (`Unable to find an element with the text: Podnikání`) because the component's topic list drifted from the test's expectations. That is pre-existing breakage in the `component` project, unrelated to this plan, and must be fixed separately before the branch merges. `pnpm test:unit` — the project this plan adds tests to — is clean.

- [ ] **Step 4: Commit**

```bash
git add docs/runbooks/essay-data-transfer.md
git commit -m "docs: add runbook for essay data transfer"
```

- [ ] **Step 5: Stop and hand back before production**

Do **not** run `--target=production`. Report to the user:
- preview verification output,
- that production credentials are still absent from `.env.transfer.local`,
- that production's profile collision set must be re-inspected first, because it will differ from preview's three.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
| --- | --- |
| R1 preserve timestamps | Tasks 9, 10, 12 (spread-based inserts, explicit tests); verified in 12 and 13 |
| R2 remap by `work_email` at runtime | Task 3; used in 9, 10, 12 |
| R3 never overwrite target profiles except `team_id` | Task 9; verified in 13 |
| R4 audit columns need no remap (System inserted first) | Task 9 (`buildProfileInsertRows` ordering) |
| R5 rewrite only local srcs | Task 2; applied in 12; verified in 13 |
| R6 sync from local storage | Task 11 |
| R6a trigger behaviour (`ignore-duplicates`) | Task 4 (`INSERT_PREFER`, test asserts no `merge-duplicates`) |
| R7 `user_id` always null | Task 9 |
| Transport = PostgREST | Tasks 4, 5 |
| Teams never inserted, abort on mismatch | Task 6 (`assertTeamsAligned`) |
| Excluded tables | Never referenced; documented in Task 14 |
| Idempotency / resume | Task 4 + verified in Task 13 Step 7 |
| Scoped rollback | Task 8 |
| Verification | Task 13 |
| Production reuse | Task 7 guard + Task 14 handoff |

**Placeholder scan:** no TBD/TODO; every code step contains real code. Task 14's runbook is specified as an enumerated content list rather than prose, which is deliberate — it is documentation, not code.

**Type consistency:** `Endpoint` (Task 1) is consumed unchanged throughout. `ProfileMap` (Task 3) is used by Tasks 6, 9, 10, 12. `TransferPlan` (Task 6) is consumed by Tasks 8, 9, 10, 12, 13. `DataTable`/`DATA_TABLES` (Task 6) are reused in Task 13. `INSERT_CHUNK` is defined once in Task 10 and imported by Task 12. `selectAll` gains a fourth parameter in Task 13 with a backwards-compatible default and a new test.

**Two defects found and fixed during this review:**

1. Task 8's `rollback.ts` contained a placeholder statement (`await deleteRows;`) with a follow-up instruction to replace it. Replaced with the correct `patchRows` call inline, and `patchRows` added to the import.
2. Task 13 originally passed query strings via `selectAll`'s `table` argument, producing URLs with two `?`. The `selectAll` signature change now happens in Task 13 Step 3 *before* `verify.ts` is written, with its test added in Step 1, so the broken form never appears.

**Ordering note verified against Postgres semantics:** Task 9 inserts all 190 profiles in a single request. FK constraint triggers are `AFTER ROW` and fire at statement end, so the 64 rows referencing the `System` profile resolve within the same statement. `buildProfileInsertRows` additionally sorts `System` first, so the insert does not depend on that timing detail.
