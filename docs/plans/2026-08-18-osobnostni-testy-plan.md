# Osobnostní testy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Students can upload their personality test result files (PDF/images) with a test type and completion date, view them on a vertical timeline on their own community profile, and any verified user can open them from the profile's new "Osobnostní testy" tab. Issue #59.

**Architecture:** New `personality_tests` DB table (Drizzle schema, owner + verified-viewer RLS) storing the storage key and metadata. Files live in the existing private `documents` bucket, uploaded via the presign→PUT pattern, read via signed URLs. Server routes handle create/update/soft-delete/open; a client timeline component renders the vertical time axis. The community profile page gets tabs `Přehled / Eseje / Osobnostní testy`.

**Scope decisions:**
- No result/reflection/application fields (issue text is mostly wrong — the file IS the result).
- Test type = enum (gallup, mbti, disc, big_five, enneagram, belbin) + `other` with free text.
- Timeline ordered `tested_on` DESC (newest first), vertical axis with dots.
- `documents` bucket stays without storage RLS — server-mediated access (signed URLs), per the bucket's migration comment.

**Tech Stack:** Next.js 16, Supabase, Drizzle ORM (schema only), shadcn/ui, Tailwind CSS 4, Vitest, Playwright

**Reference feature:**
- `docs/plans/2026-08-18-tymovy-denik-plan.md` (task template — same module shape)
- `docs/plans/2026-08-18-osobnostni-testy-design.md` (validated design incl. UX analysis)
- `db/schema/team-activities.ts` + `supabase/migrations/20260818075139_melted_marvel_zombies.sql` (schema template)
- `supabase/migrations/20260818075419_wealthy_bloodscream.sql` (updated_at trigger custom-migration template)
- `src/lib/storage/*` + `src/app/api/storage/*` (storage plumbing to extend)
- `src/components/tymovy-denik/team-activity-form.tsx` (form pattern)
- `tests/integration/team-activities.int.test.ts` (RLS test template)
- `tests/e2e/tymovy-denik.spec.ts` + `tests/e2e/fixtures/auth.ts` (E2E template)

---

### Task 1: Database Schema — `personality_tests` table + updated_at trigger

**Files:**
- Create: `db/schema/personality-tests.ts`
- Create (via `pnpm db:generate`): `supabase/migrations/<timestamp>_*.sql`
- Create (via `pnpm db:generate:custom`): `supabase/migrations/<timestamp>_*.sql`
- Modify (regenerated): `src/lib/supabase/database.types.ts`

**Step 1: Create schema file**

```ts
// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, date, integer, index, check, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"

export const personalityTestType = pgEnum("personality_test_type", [
  "gallup",
  "mbti",
  "disc",
  "big_five",
  "enneagram",
  "belbin",
  "other",
])

export const personalityTests = pgTable("personality_tests", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  profileId: uuid("profile_id").notNull(),
  testType: personalityTestType("test_type").notNull(),
  testTypeOther: text("test_type_other"),
  testedOn: date("tested_on").notNull(),
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  index("personality_tests_profile_tested_on_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops"), table.testedOn.asc().nullsLast().op("date_ops")),
  foreignKey({
    columns: [table.profileId],
    foreignColumns: [profiles.id],
    name: "personality_tests_profile_id_fkey"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.createdByProfileId],
    foreignColumns: [profiles.id],
    name: "personality_tests_created_by_profile_id_fkey"
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.updatedByProfileId],
    foreignColumns: [profiles.id],
    name: "personality_tests_updated_by_profile_id_fkey"
  }).onDelete("restrict"),
  check("personality_tests_other_type_required", sql`(test_type <> 'other' OR (test_type_other IS NOT NULL AND length(trim(test_type_other)) > 0))`),
  pgPolicy("Verified users can view personality tests", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(removed_at IS NULL) AND (EXISTS (SELECT 1 FROM users WHERE (users.auth_user_id = (SELECT auth.uid()) AND users.verified_work_email IS NOT NULL)))` }),
  pgPolicy("Users can create their own personality tests", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(profile_id = current_profile_id())` }),
  pgPolicy("Users can update their own personality tests", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(profile_id = current_profile_id())`, withCheck: sql`(profile_id = current_profile_id())` }),
  pgPolicy("Users can delete their own personality tests", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(profile_id = current_profile_id())` }),
]).enableRLS()
```

**Step 2: Generate the table migration**

Run: `pnpm db:generate`
Expected: new `supabase/migrations/<timestamp>_*.sql` containing `CREATE TABLE "public"."personality_tests"`, the enum `CREATE TYPE "public"."personality_test_type"`, indexes, policies, and `ALTER TABLE "public"."personality_tests" ENABLE ROW LEVEL SECURITY`.

Verify manually: `grep -n "drop" supabase/migrations/<new-file>` → no unexpected drops.

**Step 3: Generate the custom trigger migration**

Run: `pnpm db:generate:custom`
Expected: new `supabase/migrations/<timestamp>_*.sql` containing only `-- Custom SQL migration file, put your code below! --`.

Replace its content with (template: `20260818075419_wealthy_bloodscream.sql`):

```sql
-- Custom SQL migration file, put your code below! --

-- Migration: updated_at trigger for personality_tests.
-- Mirrors the team_activities trigger (20260818075419_wealthy_bloodscream.sql):
-- without it, updated_at never changes on UPDATE.

drop trigger if exists personality_tests_updated_at_trigger on public.personality_tests;

create trigger personality_tests_updated_at_trigger
before update on public.personality_tests
for each row
execute function public.handle_updated_at();
```

**Step 4: Ask the user to apply the migration**

Per AGENTS.md, do NOT run `db:up` yourself. Ask the user to run `pnpm db:migrate` and to check the two new migrations for any unintended drops.

Run (by user): `pnpm db:migrate`
Expected: both migrations applied, `src/lib/supabase/database.types.ts` regenerated.

Verify manually:
- `grep -rn "personality_tests" src/lib/supabase/database.types.ts` → `personality_tests` table row shape present
- `grep -rn "personality_test_type" src/lib/supabase/database.types.ts` → enum union present

**Step 5: Commit**

```bash
git add db/schema/personality-tests.ts supabase/migrations/ src/lib/supabase/database.types.ts
git commit -m "feat(db): add personality_tests table"
```

---

### Task 2: Storage plumbing — `personality-test` context

**Files:**
- Modify: `src/lib/storage/types.ts:5`
- Modify: `src/lib/storage/buckets.ts:33-41`
- Modify: `src/lib/storage/authorization.ts:16-34`
- Modify: `src/lib/storage/validation.ts`
- Modify: `src/app/api/storage/presign-upload/route.ts`

**Step 1: Extend the StorageContext union**

`src/lib/storage/types.ts`:

```ts
export type StorageContext = "profile" | "team" | "book" | "personality-test";
```

**Step 2: Map the new context to the documents bucket**

`src/lib/storage/buckets.ts`, inside `contextToBucket` (the switch is exhaustive — TypeScript will flag this until added):

```ts
    case "personality-test":
      return "documents";
```

**Step 3: Authorize the new context**

`src/lib/storage/authorization.ts`, at the top of `authorizeAction` (before the `profile` branch):

```ts
  if (context === "personality-test") {
    if (entityId !== profile.id) {
      return "Nemůžeš nahrát soubor pro jinou osobu";
    }
    return null;
  }
```

**Step 4: Add document validation**

`src/lib/storage/validation.ts` — add after the existing image constants:

```ts
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

// Max size for personality test uploads (PDF reports with graphics)
export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20MB
```

Add after `validateImageUpload`:

```ts
/**
 * Validate personality test upload constraints
 */
export function validatePersonalityTestUpload(
  contentType: string,
  fileSize: number
): ValidationError | null {
  if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(contentType)) {
    return {
      field: "contentType",
      message: "Povolené formáty: PDF, PNG, JPEG, WebP",
    };
  }

  if (fileSize > MAX_DOCUMENT_SIZE) {
    return {
      field: "fileSize",
      message: `Maximální velikost souboru je ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB`,
    };
  }

  return null;
}
```

Extend `getFileExtension` map:

```ts
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };
```

**Step 5: Branch the presign route**

`src/app/api/storage/presign-upload/route.ts`:
- Add `validatePersonalityTestUpload` to the import from `@/lib/storage/validation`.
- Replace the file validation call (line ~49):

```ts
    // Validate file type and size
    const validationError =
      context === "personality-test"
        ? validatePersonalityTestUpload(contentType, fileSize)
        : validateImageUpload(contentType, fileSize);
```

- Add a context branch before the existing `if (context === "profile")` (line ~67):

```ts
    if (context === "personality-test") {
      // Users can only upload to their own profile
      if (entityId !== profile.id) {
        return NextResponse.json(
          { error: "Nemůžeš nahrát soubor pro jinou osobu" },
          { status: 403 }
        );
      }
    } else if (context === "profile") {
```

**Step 6: Verify and commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add src/lib/storage/ src/app/api/storage/presign-upload/route.ts
git commit -m "feat: add personality-test storage context and document validation"
```

---

### Task 3: Types, queries, format helpers (TDD)

**Files:**
- Create: `src/lib/personality-tests/types.ts`
- Create: `src/lib/personality-tests/queries.ts`
- Create: `src/lib/personality-tests/format.ts`
- Test: `src/lib/personality-tests/format.test.ts`

**Step 1: Write the failing test**

`src/lib/personality-tests/format.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { formatTestDate, formatFileSize } from "./format"
import { getTestTypeLabel } from "./types"

describe("personality test format helpers", () => {
  it("formats a date as day. month. year", () => {
    expect(formatTestDate("2026-03-12")).toBe("12. 3. 2026")
  })

  it("formats file sizes in B, KB and MB with a Czech decimal comma", () => {
    expect(formatFileSize(512)).toBe("512 B")
    expect(formatFileSize(2048)).toBe("2 KB")
    expect(formatFileSize(2 * 1024 * 1024 + 512 * 1024)).toBe("2,5 MB")
  })
})

describe("personality test type labels", () => {
  it("labels known types from the enum", () => {
    expect(getTestTypeLabel({ test_type: "mbti", test_type_other: null })).toBe("MBTI")
    expect(getTestTypeLabel({ test_type: "disc", test_type_other: null })).toBe("DISC")
  })

  it("uses the custom name for other", () => {
    expect(
      getTestTypeLabel({ test_type: "other", test_type_other: "Hogan Assessment" }),
    ).toBe("Hogan Assessment")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit src/lib/personality-tests/format.test.ts`
Expected: FAIL — module `./format` / `./types` not found.

**Step 3: Write the implementation**

`src/lib/personality-tests/types.ts`:

```ts
import type { Tables } from "@/lib/supabase/tables"

export type PersonalityTest = Tables<"personality_tests">

export const PERSONALITY_TEST_TYPES = [
  "gallup",
  "mbti",
  "disc",
  "big_five",
  "enneagram",
  "belbin",
  "other",
] as const

export type PersonalityTestType = (typeof PERSONALITY_TEST_TYPES)[number]

export const PERSONALITY_TEST_TYPE_LABELS: Record<PersonalityTestType, string> = {
  gallup: "Gallup",
  mbti: "MBTI",
  disc: "DISC",
  big_five: "Big Five",
  enneagram: "Enneagram",
  belbin: "Belbin",
  other: "Jiný test",
}

export function getTestTypeLabel(
  test: Pick<PersonalityTest, "test_type" | "test_type_other">,
): string {
  return test.test_type === "other"
    ? test.test_type_other ?? PERSONALITY_TEST_TYPE_LABELS.other
    : PERSONALITY_TEST_TYPE_LABELS[test.test_type]
}
```

`src/lib/personality-tests/queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { PersonalityTest } from "./types"

export async function listPersonalityTests(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<PersonalityTest[]> {
  const { data, error } = await supabase
    .from("personality_tests")
    .select("*")
    .is("removed_at", null)
    .eq("profile_id", profileId)
    .order("tested_on", { ascending: false })

  if (error) throw error
  return (data ?? []) as PersonalityTest[]
}
```

`src/lib/personality-tests/format.ts`:

```ts
export function formatTestDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${Number(day)}. ${Number(month)}. ${year}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit src/lib/personality-tests/format.test.ts`
Expected: PASS (all 4 tests green).

**Step 5: Commit**

```bash
git add src/lib/personality-tests/
git commit -m "feat: add personality test types, queries and format helpers"
```

---

### Task 4: API routes

**Files:**
- Create: `src/app/api/personality-tests/route.ts`
- Create: `src/app/api/personality-tests/[id]/route.ts`
- Create: `src/app/api/personality-tests/[id]/open/route.ts`

**Step 1: Create route — POST (create)**

`src/app/api/personality-tests/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { MAX_DOCUMENT_SIZE } from "@/lib/storage/validation";
import { PERSONALITY_TEST_TYPES } from "@/lib/personality-tests/types";
import type { Insertable } from "@/lib/supabase/tables";

interface CreatePersonalityTestRequest {
  profileId: string;
  key: string;
  testType: string;
  testTypeOther?: string;
  testedOn: string;
  fileName: string;
  fileSize: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 });
    }

    const body: CreatePersonalityTestRequest = await request.json();
    const { profileId, key, testType, testTypeOther, testedOn, fileName, fileSize } = body;

    if (profileId !== profile.id) {
      return NextResponse.json({ error: "Nemůžeš nahrát test pro jinou osobu" }, { status: 403 });
    }
    if (!(PERSONALITY_TEST_TYPES as readonly string[]).includes(testType)) {
      return NextResponse.json({ error: "Neplatný typ testu" }, { status: 400 });
    }
    if (testType === "other" && !testTypeOther?.trim()) {
      return NextResponse.json({ error: "Zadej název testu" }, { status: 400 });
    }
    if (!DATE_RE.test(testedOn)) {
      return NextResponse.json({ error: "Neplatné datum" }, { status: 400 });
    }
    if (!fileName?.trim() || fileName.length > 255) {
      return NextResponse.json({ error: "Neplatný název souboru" }, { status: 400 });
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_DOCUMENT_SIZE) {
      return NextResponse.json({ error: "Neplatná velikost souboru" }, { status: 400 });
    }
    if (!key.startsWith(`personality-test/${profileId}/`)) {
      return NextResponse.json({ error: "Neplatný klíč souboru" }, { status: 400 });
    }

    const payload: Insertable<"personality_tests"> = {
      profile_id: profileId,
      test_type: testType as Insertable<"personality_tests">["test_type"],
      test_type_other: testType === "other" ? testTypeOther.trim() : null,
      tested_on: testedOn,
      file_path: key,
      file_name: fileName.trim(),
      file_size: fileSize,
      created_by_profile_id: profile.id,
      updated_by_profile_id: profile.id,
    };

    const { data, error } = await supabase
      .from("personality_tests")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("POST /api/personality-tests insert error:", error);
      return NextResponse.json({ error: "Nepodařilo se uložit test" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("POST /api/personality-tests error:", error);
    return NextResponse.json({ error: "Nepodařilo se uložit test" }, { status: 500 });
  }
}
```

Note: the `test_type as Insertable<...>["test_type"]` cast is needed because the request body types the field as `string` while the generated DB type is the enum union (derived types per AGENTS.md — never hand-write them).

**Step 2: Create route — PATCH + DELETE**

`src/app/api/personality-tests/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { deleteFile } from "@/lib/storage/service";
import { MAX_DOCUMENT_SIZE } from "@/lib/storage/validation";
import { PERSONALITY_TEST_TYPES } from "@/lib/personality-tests/types";
import type { Updatable } from "@/lib/supabase/tables";

interface UpdatePersonalityTestRequest {
  testType?: string;
  testTypeOther?: string;
  testedOn?: string;
  newKey?: string;
  fileName?: string;
  fileSize?: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 });
    }

    const body: UpdatePersonalityTestRequest = await request.json();
    const { testType, testTypeOther, testedOn, newKey, fileName, fileSize } = body;

    const existing = await supabase
      .from("personality_tests")
      .select("id, profile_id, file_path, removed_at")
      .eq("id", id)
      .is("removed_at", null)
      .maybeSingle();

    if (existing.error || !existing.data) {
      return NextResponse.json({ error: "Test nenalezen" }, { status: 404 });
    }

    if (testType !== undefined && !(PERSONALITY_TEST_TYPES as readonly string[]).includes(testType)) {
      return NextResponse.json({ error: "Neplatný typ testu" }, { status: 400 });
    }
    if (testType === "other" && !testTypeOther?.trim()) {
      return NextResponse.json({ error: "Zadej název testu" }, { status: 400 });
    }
    if (testedOn !== undefined && !DATE_RE.test(testedOn)) {
      return NextResponse.json({ error: "Neplatné datum" }, { status: 400 });
    }
    if (newKey !== undefined) {
      if (!newKey.startsWith(`personality-test/${existing.data.profile_id}/`)) {
        return NextResponse.json({ error: "Neplatný klíč souboru" }, { status: 400 });
      }
      if (!fileName?.trim() || fileName.length > 255) {
        return NextResponse.json({ error: "Neplatný název souboru" }, { status: 400 });
      }
      if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_DOCUMENT_SIZE) {
        return NextResponse.json({ error: "Neplatná velikost souboru" }, { status: 400 });
      }
    }

    const update: Updatable<"personality_tests"> = { updated_by_profile_id: profile.id };
    if (testType !== undefined) {
      update.test_type = testType as Updatable<"personality_tests">["test_type"];
      update.test_type_other = testType === "other" ? testTypeOther.trim() : null;
    }
    if (testedOn !== undefined) {
      update.tested_on = testedOn;
    }
    if (newKey !== undefined) {
      update.file_path = newKey;
      update.file_name = fileName.trim();
      update.file_size = fileSize;
    }

    const { data: updated, error: updateError } = await supabase
      .from("personality_tests")
      .update(update)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Nepodařilo se uložit změny" }, { status: 403 });
    }

    if (newKey !== undefined && newKey !== existing.data.file_path) {
      try {
        await deleteFile("documents", existing.data.file_path);
      } catch (error) {
        console.error("Error deleting old personality test file:", error);
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PATCH /api/personality-tests/[id] error:", error);
    return NextResponse.json({ error: "Nepodařilo se uložit změny" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) {
      return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 });
    }

    const existing = await supabase
      .from("personality_tests")
      .select("id, file_path")
      .eq("id", id)
      .is("removed_at", null)
      .maybeSingle();

    if (existing.error || !existing.data) {
      return NextResponse.json({ error: "Test nenalezen" }, { status: 404 });
    }

    const { data: removed, error: updateError } = await supabase
      .from("personality_tests")
      .update({ removed_at: new Date().toISOString(), updated_by_profile_id: profile.id })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (updateError || !removed) {
      return NextResponse.json({ error: "Nepodařilo se odstranit test" }, { status: 403 });
    }

    try {
      await deleteFile("documents", existing.data.file_path);
    } catch (error) {
      console.error("Error deleting personality test file:", error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/personality-tests/[id] error:", error);
    return NextResponse.json({ error: "Nepodařilo se odstranit test" }, { status: 500 });
  }
}
```

**Step 3: Create route — GET (open)**

`src/app/api/personality-tests/[id]/open/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSignedStorageUrl } from "@/lib/storage/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("personality_tests")
      .select("file_path")
      .eq("id", id)
      .is("removed_at", null)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Test nenalezen" }, { status: 404 });
    }

    const url = await getSignedStorageUrl("documents", data.file_path);
    return NextResponse.redirect(url, 307);
  } catch (error) {
    console.error("GET /api/personality-tests/[id]/open error:", error);
    return NextResponse.json({ error: "Nepodařilo se otevřít soubor" }, { status: 500 });
  }
}
```

Note: the row select goes through RLS (`Verified users can view personality tests`), so an unverified user gets 404 — the signed URL is never created for them.

**Step 4: Verify and commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add src/app/api/personality-tests/
git commit -m "feat: add personality test API routes"
```

---

### Task 5: InfoCard component

**Files:**
- Create: `src/components/personality-tests/info-card.tsx`

**Step 1: Create InfoCard**

Copy the team-diary InfoCard shell, with the approved copy from the design doc:

```tsx
import { Info } from "lucide-react"

export function InfoCard() {
  return (
    <div className="flex gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
      <div className="space-y-1">
        <p>
          <strong>Osobnostní test</strong> slouží k hodnocení a pochopení charakterových rysů,
          chování a preferencí téček. Pomáhá identifikovat silné a slabé stránky, motivace
          a způsob interakce s okolím.
        </p>
        <p>
          Osobnostní test si každé téčko dělá v 1. semestru. Následně ho zkonzultuje
          s některým z koučů. Slouží jako podklad pro Learning contract.
        </p>
      </div>
    </div>
  )
}
```

Copy check: run the `inclusive-czech-writing` skill over both paragraphs. The text is user-provided — flag the phrase „s některým z koučů" (generic masculine, possible rewrite to „s někým z kouči:ek") and confirm with the user before changing it.

**Step 2: Commit**

```bash
git add src/components/personality-tests/info-card.tsx
git commit -m "feat: add personality test info card"
```

---

### Task 6: Form dialog (create + edit)

**Files:**
- Create: `src/components/personality-tests/personality-test-form.tsx`

**Step 1: Create the form**

Pattern: `team-activity-form.tsx` (controlled `useState` + manual validation — features do not use react-hook-form/zod).

```tsx
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
        <Label>Typ testu</Label>
        <Select value={testType} onValueChange={setTestType}>
          <SelectTrigger className="w-full">
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
            : "PDF, PNG, JPEG nebo WebP · max 20 MB"}
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
```

**Step 2: Commit**

```bash
git add src/components/personality-tests/personality-test-form.tsx
git commit -m "feat: add personality test form"
```

---

### Task 7: Timeline component

**Files:**
- Create: `src/components/personality-tests/personality-test-timeline.tsx`

**Step 1: Create the timeline**

Vertical time axis: the connector line is drawn per item (except the last) as a 1 px `bg-border` segment from just below the dot (`top-5`) to the next item's dot (`bottom-[-32px]`; items are spaced `space-y-6` = 24px, the next dot sits 8px below the next li's top). Dots are `size-3 bg-primary ring-4 ring-background` so the line visually stops at each dot. Decorative spans are `aria-hidden`; structure is a semantic `ol`/`li`.

```tsx
"use client"

import { useMemo, useState } from "react"
import { ExternalLink, FileText, Loader2, Pencil, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import { toast } from "sonner"
import { PersonalityTestForm } from "./personality-test-form"
import { formatFileSize, formatTestDate } from "@/lib/personality-tests/format"
import { getTestTypeLabel } from "@/lib/personality-tests/types"
import type { PersonalityTest } from "@/lib/personality-tests/types"

interface PersonalityTestTimelineProps {
  initialTests: PersonalityTest[]
  profileId: string
  isOwnProfile: boolean
}

export function PersonalityTestTimeline({ initialTests, profileId, isOwnProfile }: PersonalityTestTimelineProps) {
  const [items, setItems] = useState(initialTests)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalityTest | null>(null)
  const [deleting, setDeleting] = useState<PersonalityTest | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...items].sort((a, b) => b.tested_on.localeCompare(a.tested_on)),
    [items],
  )

  function handleCreated(test: PersonalityTest) {
    setItems((prev) => [...prev, test])
    setCreateOpen(false)
  }

  function handleUpdated(test: PersonalityTest) {
    setItems((prev) => prev.map((t) => (t.id === test.id ? test : t)))
    setEditing(null)
  }

  async function handleDelete() {
    if (!deleting) return
    setDeletingId(deleting.id)
    try {
      const res = await fetch(`/api/personality-tests/${deleting.id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Nepodařilo se odstranit test")
      setItems((prev) => prev.filter((t) => t.id !== deleting.id))
      toast.success("Test odstraněn")
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nepodařilo se odstranit test")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {isOwnProfile && (
        <div className="flex items-center justify-end">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Upload className="size-4" />
                Nahrát test
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Nový osobnostní test</DialogTitle>
              </DialogHeader>
              <PersonalityTestForm
                profileId={profileId}
                onSuccess={handleCreated}
                onCancel={() => setCreateOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}

      {sorted.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <FileText className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>
              {isOwnProfile ? "Zatím nemáš nahraný žádný osobnostní test" : "Zatím žádné osobnostní testy"}
            </EmptyTitle>
            <EmptyDescription>
              {isOwnProfile
                ? "Nahraj výsledky svého osobnostního testu jako soubor PDF nebo obrázek. Timeline ukáže, jak se v průběhu studia vyvíjíš."
                : "Tato osoba zatím nenahrála žádné osobnostní testy."}
            </EmptyDescription>
          </EmptyHeader>
          {isOwnProfile && (
            <EmptyContent>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Upload className="size-4" />
                Nahrát test
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <ol className="space-y-6">
          {sorted.map((test, index) => (
            <li key={test.id} className="relative pl-6 sm:pl-8">
              {index < sorted.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-0 top-5 bottom-[-32px] w-px bg-border"
                />
              )}
              <span
                aria-hidden
                className="absolute left-0 top-2 size-3 -translate-x-1/2 rounded-full bg-primary ring-4 ring-background"
              />
              <div className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{getTestTypeLabel(test)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatTestDate(test.tested_on)} · {test.file_name} · {formatFileSize(test.file_size)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`/api/personality-tests/${test.id}/open`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3.5" />
                      <span className="sr-only sm:not-sr-only sm:inline">Otevřít</span>
                    </a>
                  </Button>
                  {isOwnProfile && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label="Upravit test"
                        onClick={() => setEditing(test)}
                      >
                        <Pencil className="size-4" />
                        <span className="sr-only sm:not-sr-only sm:inline">Upravit</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        aria-label="Smazat test"
                        onClick={() => setDeleting(test)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only sm:not-sr-only sm:inline">Smazat</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upravit test</DialogTitle>
          </DialogHeader>
          {editing && (
            <PersonalityTestForm
              profileId={profileId}
              initial={editing}
              onSuccess={handleUpdated}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odstranit test?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  Test <strong>{getTestTypeLabel(deleting)}</strong> ({formatTestDate(deleting.tested_on)}){" "}
                  odebereš ze svého profilu. Nahraný soubor bude smazán.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId !== null && <Loader2 className="size-4 animate-spin" />}
              Odstranit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

Verify the timeline geometry visually in both themes and at mobile width (`sm:pl-8` padding vs `pl-6`): dots must sit on the line with no overhang above the first or below the last dot.

**Step 2: Commit**

```bash
git add src/components/personality-tests/personality-test-timeline.tsx
git commit -m "feat: add personality test timeline"
```

---

### Task 8: Profile page — tabs restructure

**Files:**
- Modify: `src/app/(main)/komunita/profil/[id]/page.tsx`

**Step 1: Restructure the page**

Add imports:

```tsx
import { UserRound, Brain } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger, TabsTriggerCount } from '@/components/ui/tabs';
import { InfoCard } from '@/components/personality-tests/info-card';
import { PersonalityTestTimeline } from '@/components/personality-tests/personality-test-timeline';
import { listPersonalityTests } from '@/lib/personality-tests/queries';
```

Change the `searchParams` type and add the tests fetch + active tab (after the existing `countIndividualCoachingSessions` query, line ~38-43):

```tsx
  const [essays, stats, meetingCount, coachingSessionCount, personalityTests] = await Promise.all([
    getEssays(supabase, { authorProfileId: id, sort: 'best', pageSize: 100 }),
    getUserBookPointsStats(supabase, id),
    countCustomerMeetings(supabase, id).catch(() => 0),
    countIndividualCoachingSessions(supabase, id).catch(() => 0),
    listPersonalityTests(supabase, id),
  ]);
```

```tsx
  const activeTab = tab === 'eseje' || tab === 'osobnostni-testy' ? tab : 'prehled';
```

Replace the stats/contact block (lines ~121-164) and the essays block (lines ~166-264) — everything between the profile header and the closing `</PageShell>` — with:

```tsx
        <Tabs defaultValue={activeTab} className="mt-4">
          <TabsList>
            <TabsTrigger value="prehled">
              <UserRound />
              Přehled
            </TabsTrigger>
            <TabsTrigger value="eseje">
              <BookOpen />
              Eseje
              <TabsTriggerCount count={essays.length} />
            </TabsTrigger>
            <TabsTrigger value="osobnostni-testy">
              <Brain />
              Osobnostní testy
              <TabsTriggerCount count={personalityTests.length} />
            </TabsTrigger>
          </TabsList>

          {/* Stats + contact */}
          <TabsContent value="prehled">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4 py-4">
              <div className="flex items-center gap-6">
                {[
                  { value: stats.approved_points, label: pts(stats.approved_points) },
                  { value: stats.essay_count,    label: eseje(stats.essay_count) },
                  { value: totalVotes,           label: hlasy(totalVotes) },
                  { value: meetingCount,         label: schuzky(meetingCount) },
                  { value: coachingSessionCount, label: koucovaniLabel },
                ].map(({ value, label }) => (
                  <div key={label} className="text-center">
                    <p className="text-xl font-bold tabular-nums leading-none">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <div className="h-8 w-px bg-border hidden sm:block" />

              <div className="flex flex-wrap gap-x-5 gap-y-1.5 min-w-0">
                <a href={`mailto:${profile.work_email}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors min-w-0">
                  <Mail className="size-3.5 shrink-0" /><span className="truncate">{profile.work_email}</span>
                </a>
                {profile.personal_email && (
                  <a href={`mailto:${profile.personal_email}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors min-w-0">
                    <Mail className="size-3.5 shrink-0" /><span className="truncate">{profile.personal_email}</span>
                  </a>
                )}
                {profile.phone_number && (
                  <a href={`tel:${profile.phone_number}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Phone className="size-3.5" />{profile.phone_number}
                  </a>
                )}
                {profile.date_of_birth && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Cake className="size-3.5" />
                    {new Date(profile.date_of_birth).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Essays */}
          <TabsContent value="eseje" className="mt-4">
            <div className="space-y-4">
              <h2 className="font-semibold text-base">
                Eseje
                {essays.length > 0 && <span className="ml-2 font-normal text-muted-foreground text-sm">{essays.length}</span>}
              </h2>

              {essays.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Zatím žádné eseje</p>
              ) : (
                <>
                  {bookEssays.length > 0 && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {[...bookEssays].sort((a, b) => {
                        if (a.pinned_at && !b.pinned_at) return -1;
                        if (!a.pinned_at && b.pinned_at) return 1;
                        return 0;
                      }).map((essay) => {
                        const excerpt = essay.content_text?.trim().replace(/\s+/g, ' ').slice(0, 120);
                        return (
                          <div key={essay.id} className="flex gap-3 rounded-xl border bg-card px-3.5 py-3 group hover:shadow-sm transition-shadow">
                            <Link href={`/cteni/eseje/${essay.id}`} className="focus-ring shrink-0 w-11 h-15 rounded-md overflow-hidden bg-muted flex items-center justify-center mt-0.5">
                              {essay.book!.google_books_cover_url ? (
                                <StorageImage storageKey={essay.book!.google_books_cover_url} alt={essay.book!.title_cs} width={44} height={60} className="w-full h-full object-cover" />
                              ) : (
                                <BookOpen className="size-4 text-muted-foreground/30" />
                              )}
                            </Link>
                            <div className="flex-1 min-w-0 space-y-1">
                              <Link href={`/cteni/eseje/${essay.id}`} className="focus-ring flex min-w-0 items-center gap-1.5 rounded-sm">
                                {essay.pinned_at && <Pin className="size-3 shrink-0 text-primary fill-primary" />}
                                <span className="font-semibold text-sm leading-snug truncate group-hover:text-primary transition-colors">
                                  {essay.title}
                                </span>
                              </Link>
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                                {essay.book!.title_cs}
                                <BookStatusBadges book={essay.book!} />
                                {pointsNumber(essay.book!.book_points) > 0 && <span className="ml-1 font-medium text-foreground">· {formatPointsWithLabel(essay.book!.book_points)}</span>}
                              </p>
                              {excerpt && excerpt.length > 20 && (
                                <p className="text-xs text-muted-foreground/60 line-clamp-2 leading-relaxed">{excerpt}…</p>
                              )}
                              <EssayVoteButton essayId={essay.id} initialVoteCount={essay.vote_count} initialVoted={votedIds.has(essay.id)} size="sm" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {topicEssays.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2 pt-2">
                        <Sparkles className="size-4 text-warning-strong" />
                        <h3 className="font-semibold text-sm text-warning-strong">
                          Nad rámec četby
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground/60 leading-relaxed -mt-1">
                        Myšlenky, postřehy a záznamy, které nevznikly z přečtené knihy, ale z vlastní potřeby sdílet — bez nároku na body.
                      </p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {[...topicEssays].sort((a, b) => {
                          if (a.pinned_at && !b.pinned_at) return -1;
                          if (!a.pinned_at && b.pinned_at) return 1;
                          return 0;
                        }).map((essay) => {
                          const excerpt = essay.content_text?.trim().replace(/\s+/g, ' ').slice(0, 120);
                          return (
                            <div key={essay.id} className="flex gap-3 rounded-xl border border-warning/20 bg-warning/10 px-3.5 py-3 group hover:shadow-sm transition-shadow">
                              <Link href={`/cteni/eseje/${essay.id}`} className="focus-ring shrink-0 w-11 h-15 rounded-md overflow-hidden bg-warning/10 flex items-center justify-center mt-0.5">
                                <Sparkles className="size-4 text-warning/40" />
                              </Link>
                              <div className="flex-1 min-w-0 space-y-1">
                                <Link href={`/cteni/eseje/${essay.id}`} className="focus-ring flex min-w-0 items-center gap-1.5 rounded-sm">
                                  {essay.pinned_at && <Pin className="size-3 shrink-0 text-primary fill-primary" />}
                                  <span className="font-semibold text-sm leading-snug truncate group-hover:text-warning-strong transition-colors">
                                    {essay.title}
                                  </span>
                                </Link>
                                <p className="text-xs text-warning-strong flex items-center gap-1">
                                  <Sparkles className="size-3" />
                                  Nad rámec četby
                                </p>
                                {excerpt && excerpt.length > 20 && (
                                  <p className="text-xs text-muted-foreground/60 line-clamp-2 leading-relaxed">{excerpt}…</p>
                                )}
                                <EssayVoteButton essayId={essay.id} initialVoteCount={essay.vote_count} initialVoted={votedIds.has(essay.id)} size="sm" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* Personality tests */}
          <TabsContent value="osobnostni-testy" className="mt-4 space-y-4">
            <InfoCard />
            <PersonalityTestTimeline
              initialTests={personalityTests}
              profileId={profile.id}
              isOwnProfile={isOwnProfile}
            />
          </TabsContent>
        </Tabs>
```

Also change `searchParams` in `PageProps`:

```tsx
  searchParams: Promise<{ from?: string; tab?: string }>;
```

and the destructure at the top of the component:

```tsx
  const { from, tab } = await searchParams;
```

Notes:
- The `border-y` on the stats block becomes a simple `py-4` (the tabs already separate the header).
- Check the tab bar at mobile width — the three triggers must not overflow; if they do, add `flex-wrap` to `TabsList` (the repo's custom TabsList variant handles most widths; verify in the browser).

**Step 2: Verify and commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add src/app/"(main)"/komunita/profil/"[id]"/page.tsx
git commit -m "feat: add tabs to community profile page with personality tests"
```

---

### Task 9: Integration RLS tests

**Files:**
- Create: `tests/integration/personality-tests.int.test.ts`

**Step 1: Create the test**

Mirror `tests/integration/team-activities.int.test.ts` (withRollback, insertAuthUser, asClaims):

```ts
import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import type { PoolClient } from "pg";

async function seed(client: PoolClient) {
  const ownerAuth = await insertAuthUser(client);
  const otherAuth = await insertAuthUser(client);
  const unverifiedAuth = await insertAuthUser(client);

  const { rows: ownerUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [ownerAuth.id],
  );
  const { rows: otherUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [otherAuth.id],
  );
  const { rows: unverifiedUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [unverifiedAuth.id],
  );

  // owner + other verified, unverified stays unverified
  await client.query(
    "update public.users set verified_work_email = google_email, verified_work_email_at = now() where id = any($1)",
    [[ownerUserRows[0].id, otherUserRows[0].id]],
  );

  const profile = async (name: string, email: string, userId: string) => {
    const { rows } = await client.query(
      `insert into public.profiles (name, work_email, user_id, role)
       values ($1, $2, $3, 'student') returning id`,
      [name, email, userId],
    );
    return rows[0].id as string;
  };

  const ownerProfileId = await profile("Owner", "pt-owner@studenti.czu.cz", ownerUserRows[0].id);
  const otherProfileId = await profile("Other", "pt-other@studenti.czu.cz", otherUserRows[0].id);
  const unverifiedProfileId = await profile("Unverified", "pt-unverified@studenti.czu.cz", unverifiedUserRows[0].id);

  return {
    ownerProfileId,
    otherProfileId,
    unverifiedProfileId,
    ownerAuthId: ownerAuth.id as string,
    otherAuthId: otherAuth.id as string,
    unverifiedAuthId: unverifiedAuth.id as string,
  };
}

async function insertTest(
  client: PoolClient,
  profileId: string,
  testType = "mbti",
  overrides: { testTypeOther?: string | null } = {},
) {
  const { rows } = await client.query(
    `insert into public.personality_tests
       (profile_id, test_type, test_type_other, tested_on, file_path, file_name, file_size, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $3, '2026-03-10', 'personality-test/p1/x.pdf', 'x.pdf', 1024, $4, $4)
     returning id`,
    [profileId, testType, overrides.testTypeOther ?? null, profileId],
  );
  return rows[0].id as string;
}

describe("personality_tests RLS", () => {
  it("lets the owner insert and another verified user select their tests", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId, otherAuthId } = await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await insertTest(client, ownerProfileId);

      await asClaims(client, { sub: otherAuthId });
      const { rows } = await client.query(
        "select test_type from public.personality_tests where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].test_type).toBe("mbti");
    });
  });

  it("does not let an unverified user select tests", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId, unverifiedAuthId } = await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await insertTest(client, ownerProfileId);

      await asClaims(client, { sub: unverifiedAuthId });
      const { rows } = await client.query(
        "select id from public.personality_tests where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows).toHaveLength(0); // RLS filters it out silently
    });
  });

  it("does not let another user insert a test for someone else", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, otherAuthId } = await seed(client);

      await asClaims(client, { sub: otherAuthId });
      await expect(
        client.query(
          `insert into public.personality_tests
             (profile_id, test_type, tested_on, file_path, file_name, file_size, created_by_profile_id, updated_by_profile_id)
           values ($1, 'mbti', '2026-03-10', 'personality-test/p1/x.pdf', 'x.pdf', 1024, $2, $2)`,
          [ownerProfileId, otherAuthId],
        ),
      ).rejects.toThrow();
    });
  });

  it("lets the owner update and soft-delete their test; other users cannot", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId, otherAuthId } = await seed(client);
      const testId = await insertTest(client, ownerProfileId);

      await asClaims(client, { sub: ownerAuthId });
      await client.query(
        `update public.personality_tests
           set tested_on = '2026-04-01', updated_by_profile_id = $2
         where id = $1`,
        [testId, ownerProfileId],
      );
      await client.query(
        `update public.personality_tests
           set removed_at = now(), updated_by_profile_id = $2
         where id = $1`,
        [testId, ownerProfileId],
      );

      const { rows } = await client.query(
        "select tested_on, removed_at from public.personality_tests where id = $1",
        [testId],
      );
      expect(rows[0].tested_on).toBe("2026-04-01");
      expect(rows[0].removed_at).not.toBeNull();

      const { rows: activeRows } = await client.query(
        "select id from public.personality_tests where profile_id = $1 and removed_at is null",
        [ownerProfileId],
      );
      expect(activeRows).toHaveLength(0); // soft-deleted rows are filtered by the app query

      await asClaims(client, { sub: otherAuthId });
      const updateResult = await client.query(
        "update public.personality_tests set test_type = 'disc' where id = $1",
        [testId],
      );
      expect(updateResult.rowCount).toBe(0); // RLS filters the row out

      const deleteResult = await client.query(
        "delete from public.personality_tests where id = $1",
        [testId],
      );
      expect(deleteResult.rowCount).toBe(0);
    });
  });

  it("rejects 'other' test type without a custom name", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId } = await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await expect(
        client.query(
          `insert into public.personality_tests
             (profile_id, test_type, tested_on, file_path, file_name, file_size, created_by_profile_id, updated_by_profile_id)
           values ($1, 'other', '2026-03-10', 'personality-test/p1/x.pdf', 'x.pdf', 1024, $2, $2)`,
          [ownerProfileId, ownerAuthId],
        ),
      ).rejects.toThrow();
    });
  });

  it("cascades delete when the profile is removed", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId } = await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await insertTest(client, ownerProfileId);

      await client.query("set local role service_role");
      await client.query("delete from public.profiles where id = $1", [ownerProfileId]);

      const { rows } = await client.query(
        "select count(*)::int as cnt from public.personality_tests where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows[0].cnt).toBe(0);
    });
  });
});
```

**Step 2: Run and verify**

Run: `pnpm vitest run --project integration tests/integration/personality-tests.int.test.ts`
Expected: PASS (6 tests).

**Step 3: Commit**

```bash
git add tests/integration/personality-tests.int.test.ts
git commit -m "test: add RLS integration test for personality_tests"
```

---

### Task 10: E2E tests

**Files:**
- Create: `tests/e2e/personality-tests.spec.ts`

**Step 1: Create the spec**

Mirror `tests/e2e/tymovy-denik.spec.ts` (fixtures: `createTestTeam`, `getSetupSessionCookie`, `setAuthCookie`, `cleanupTestData`). Use the unique-name trick via `other` + a timestamped name for unambiguous assertions; known types (MBTI → DISC) for the select flow.

```ts
import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestTeam,
  getSetupSessionCookie,
  setAuthCookie,
} from "./fixtures/auth";

const TEST_PDF = {
  name: "mbti-vysledky.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 test"),
};

async function uploadTest(page: import("@playwright/test").Page, typeLabel: string) {
  await page.getByRole("button", { name: /Nahrát test/i }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: typeLabel }).click();
  await dialog.getByLabel("Soubor s výsledky").setInputFiles(TEST_PDF);
  await dialog.getByRole("button", { name: "Nahrát test" }).click();
  await expect(dialog).toHaveCount(0);
}

async function uploadCustomTest(page: import("@playwright/test").Page, testName: string) {
  await page.getByRole("button", { name: /Nahrát test/i }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Jiný test" }).click();
  await dialog.getByLabel("Název testu").fill(testName);
  await dialog.getByLabel("Soubor s výsledky").setInputFiles(TEST_PDF);
  await dialog.getByRole("button", { name: "Nahrát test" }).click();
  await expect(dialog).toHaveCount(0);
}

test.describe("osobnostní testy - single user", () => {
  let cookieValue: string;
  let profileId: string;

  test.beforeAll(async () => {
    const teamId = await createTestTeam();
    const user = await getSetupSessionCookie(teamId);
    cookieValue = user.cookie;
    profileId = user.profileId;
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookieValue);
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("profile shows empty state on the personality tests tab", async ({ page }) => {
    await page.goto(`/komunita/profil/${profileId}?tab=osobnostni-testy`);
    await expect(page.getByRole("heading", { name: "Osobnostní testy" })).toBeVisible();
    await expect(page.getByText("Zatím nemáš nahraný žádný osobnostní test")).toBeVisible();
  });

  test("uploading a test adds it to the timeline", async ({ page }) => {
    const testName = `E2E test ${Date.now()}`;
    await page.goto(`/komunita/profil/${profileId}?tab=osobnostni-testy`);

    await page.getByRole("button", { name: /Nahrát test/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "Jiný test" }).click();
    await dialog.getByLabel("Název testu").fill(testName);
    await dialog.getByLabel("Soubor s výsledky").setInputFiles(TEST_PDF);
    await dialog.getByRole("button", { name: "Nahrát test" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(testName)).toBeVisible();
    await expect(page.getByText("mbti-vysledky.pdf")).toBeVisible();
  });

  test("editing a test changes its type", async ({ page }) => {
    const testName = `E2E uprava ${Date.now()}`;
    await page.goto(`/komunita/profil/${profileId}?tab=osobnostni-testy`);

    await page.getByRole("button", { name: /Nahrát test/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "Jiný test" }).click();
    await dialog.getByLabel("Název testu").fill(testName);
    await dialog.getByLabel("Soubor s výsledky").setInputFiles(TEST_PDF);
    await dialog.getByRole("button", { name: "Nahrát test" }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: "Upravit test" }).click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "DISC" }).click();
    await editDialog.getByRole("button", { name: "Uložit změny" }).click();

    await expect(editDialog).toHaveCount(0);
    await expect(page.getByText("DISC")).toBeVisible();
    await expect(page.getByText(testName)).toHaveCount(0);
  });

  test("deleting a test removes it from the timeline", async ({ page }) => {
    const testName = `E2E smazat ${Date.now()}`;
    await page.goto(`/komunita/profil/${profileId}?tab=osobnostni-testy`);

    await uploadCustomTest(page, testName);
    await expect(page.getByText(testName)).toBeVisible();

    await page.getByRole("button", { name: "Smazat test" }).click();
    await page.getByRole("button", { name: "Odstranit" }).click();

    await expect(page.getByText(testName)).toHaveCount(0);
    await expect(page.getByText("Zatím nemáš nahraný žádný osobnostní test")).toBeVisible();
  });
});

test.describe("osobnostní testy - two users", () => {
  let ownerCookie: string;
  let ownerProfileId: string;
  let viewerCookie: string;

  test.beforeAll(async () => {
    const teamId = await createTestTeam();
    const owner = await getSetupSessionCookie(teamId);
    const viewer = await getSetupSessionCookie(teamId);
    ownerCookie = owner.cookie;
    ownerProfileId = owner.profileId;
    viewerCookie = viewer.cookie;
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("another verified user sees the test and can open the file", async ({ context, page }) => {
    const testName = `E2E sdileni ${Date.now()}`;

    await setAuthCookie(context, ownerCookie);
    await page.goto(`/komunita/profil/${ownerProfileId}?tab=osobnostni-testy`);
    await uploadCustomTest(page, testName);
    await expect(page.getByText(testName)).toBeVisible();

    await context.clearCookies();
    await setAuthCookie(context, viewerCookie);
    await page.goto(`/komunita/profil/${ownerProfileId}?tab=osobnostni-testy`);

    await expect(page.getByText(testName)).toBeVisible();
    await expect(page.getByText("mbti-vysledky.pdf")).toBeVisible();

    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("link", { name: /Otevřít/ }).click();
    const popup = await popupPromise;
    await popup.waitForURL(/\/storage\/v1\/object\/sign\//, { timeout: 15000 });
  });
});
```

Notes:
- The empty state and the header both render a „Nahrát test" trigger — the helpers always click `.first()` (header) to open the dialog.
- The popup assertion checks the browser navigates to the signed storage URL (PDF opens in the viewer).

**Step 2: Run and verify**

Run: `pnpm test:e2e personality-tests.spec.ts`
Expected: PASS (6 tests).

**Step 3: Commit**

```bash
git add tests/e2e/personality-tests.spec.ts
git commit -m "test: add E2E tests for personality tests"
```

---

### Task 11: Final verification

**Step 1: Run the full test suite**

Run: `pnpm test`
Expected: PASS (unit + component).

Run: `pnpm vitest run --project integration tests/integration/personality-tests.int.test.ts`
Expected: PASS.

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm lint`
Expected: PASS.

**Step 2: Manual QA checklist**

- Own profile → Osobnostní testy tab: upload MBTI (PDF), verify it appears on the timeline with today's date, type label and file name.
- Reload — the entry persists.
- Edit → change type to DISC and the date; verify the timeline re-sorts if the date changes.
- Edit → replace the file; verify the old storage object is gone (check the bucket or that the old file name is replaced).
- Delete → confirm dialog → entry gone, empty state shows.
- Community (second user): open the same profile, open the file in a new tab, verify PDF renders.
- Both light and dark theme: timeline line/dots/rings look right.
- Mobile width: tabs don't overflow, timeline dots sit on the line, action buttons are reachable.
- `?tab=eseje` and `?tab=osobnostni-testy` deep links select the right tab.

**Step 3: Final commit if anything was touched**

```bash
git add -A
git commit -m "chore: final verification fixes"
```
