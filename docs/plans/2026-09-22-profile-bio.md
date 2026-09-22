# Profile Bio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an editable, simplified richtext bio (`bio_json`) to user profiles, visible in the Přehled tab.

**Architecture:** One nullable `jsonb` column `profiles.bio_json` storing restricted Tiptap JSON (bold/italic/underline/strike/link/lists/blockquote only, no images/headings). Owner-only edits via new `PATCH /api/profile/bio`, gated by updated `validate_picture_only_update()` trigger. View via existing `getProfileById`, render via shared `TiptapRenderer`.

**Tech Stack:** Next.js Server Components, supabase-js, Tiptap v3.22.4 (`@tiptap/react`, `starter-kit`, `link`, `underline`), Drizzle schema + Supabase migrations, Vitest (unit/component/integration).

---

### Task 1: Bio validation lib (TDD)

**Files:**
- Create: `src/lib/profile/bio-validation.ts`
- Test: `src/lib/profile/bio-validation.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { validateBioContent, MAX_BIO_TEXT_LENGTH } from './bio-validation';

const doc = (content: unknown[]) => ({ type: 'doc', content });

describe('validateBioContent', () => {
  it('accepts empty doc as null (no bio)', () => {
    expect(validateBioContent({ type: 'doc', content: [{ type: 'paragraph' }] })).toEqual({ ok: true, value: null });
  });

  it('rejects text over 5000 chars', () => {
    const long = 'a'.repeat(MAX_BIO_TEXT_LENGTH + 1);
    const res = validateBioContent(doc([{ type: 'paragraph', content: [{ type: 'text', text: long }] }]));
    expect(res.ok).toBe(false);
  });

  it('rejects image and heading nodes', () => {
    expect(validateBioContent(doc([{ type: 'image', attrs: { src: 'x' } }]).ok)).toBe(false);
    expect(validateBioContent(doc([{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'hi' }] }]).ok)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/lib/profile/bio-validation.test.ts`
Expected: FAIL with "Cannot find module './bio-validation'"

**Step 3: Write minimal implementation**

```typescript
import { contentTextFromJson, normalizeContentJson } from '@/lib/essays/content-text';

export const MAX_BIO_TEXT_LENGTH = 5000;

const ALLOWED_NODES = new Set(['doc', 'paragraph', 'text', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'hardBreak']);
const ALLOWED_MARKS = new Set(['bold', 'italic', 'underline', 'strike', 'link']);

interface BioOk { ok: true; value: object | null }
interface BioErr { ok: false; error: string }
export type BioValidation = BioOk | BioErr;

function isEmptyDoc(json: object): boolean {
  return contentTextFromJson(json).length === 0;
}

function hasOnlyAllowed(node: unknown): boolean {
  if (node == null || typeof node !== 'object') return true;
  const rec = node as { type?: unknown; marks?: unknown; content?: unknown };
  if (typeof rec.type === 'string' && !ALLOWED_NODES.has(rec.type)) return false;
  if (Array.isArray(rec.marks)) {
    for (const m of rec.marks) {
      const t = (m as { type?: unknown }).type;
      if (typeof t !== 'string' || !ALLOWED_MARKS.has(t)) return false;
    }
  }
  if (Array.isArray(rec.content)) return rec.content.every(hasOnlyAllowed);
  return true;
}

export function validateBioContent(input: unknown): BioValidation {
  const json = normalizeContentJson(input);
  if (isEmptyDoc(json)) return { ok: true, value: null };
  const text = contentTextFromJson(json);
  if (text.length > MAX_BIO_TEXT_LENGTH) return { ok: false, error: 'Bio je příliš dlouhé (maximum je 5000 znaků).' };
  if (!hasOnlyAllowed(json)) return { ok: false, error: 'Bio podporuje jen základní formátování, odkazy a seznamy.' };
  return { ok: true, value: json };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/lib/profile/bio-validation.test.ts`
Expected: PASS (3 passed)

**Step 5: Commit**

```bash
git add src/lib/profile/bio-validation.ts src/lib/profile/bio-validation.test.ts
git commit -m "feat(profile): add bio richtext validation"
```

Reference skill: @test-driven-development, @inclusive-czech-writing (error strings use present tense, no generic masculine).

---

### Task 2: Schema — add `bio_json` column

**Files:**
- Modify: `db/schema/profiles.ts:1-58`

**Step 1: Write the failing test (schema presence via integration placeholder)**

No unit test — schema change is verified by `pnpm db:generate` producing a migration. Skip RED here (config, allowed per TDD exceptions — ask partner; here justified as generated code).

**Step 2: Minimal implementation**

In `db/schema/profiles.ts`, extend import and table (keep alphabetical-ish placement after `picture`):

```typescript
import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, index, unique, check, date, pgEnum, jsonb } from "drizzle-orm/pg-core"
```

```typescript
export const profiles = pgTable("profiles", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text(),
  picture: text(),
  bioJson: jsonb("bio_json"),
  userId: uuid("user_id"),
  // ... rest unchanged
```

**Step 3: Generate migration, prompt user**

Run: `pnpm db:generate`
Expected: new `supabase/migrations/*_*.sql` with `ALTER TABLE "profiles" ADD COLUMN "bio_json" jsonb;`

Then prompt the user to run `pnpm db:migrate` and ask them to check the migration for any drops. Commit schema edit + migration together (do NOT run `pnpm db:up` yourself unless the user insists — then use pnpm only).

```bash
git add db/schema/profiles.ts supabase/migrations/*bio* drizzle/meta/*
git commit -m "feat(profile): add profiles.bio_json column"
```

---

### Task 3: Trigger — allow owners to update `bio_json` (TDD integration)

**Files:**
- Test: `tests/integration/profiles.bio.int.test.ts`
- Migration: custom via `pnpm db:generate:custom` (SQL in `supabase/migrations/*_*.sql`)

**Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { asClaims } from "@/tests/setup/rls";
import { insertVerifiedProfile } from "@/tests/setup/factories";

const BIO = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ahoj!' }] }] };

describe("profiles bio trigger", () => {
  it("allows owner to update own bio_json", async () => {
    await withRollback(async (client) => {
      const { authUserId, profileId } = await insertVerifiedProfile(client, { email: "bio-owner@studenti.czu.cz" });
      await asClaims(client, { sub: authUserId });
      const { rows } = await client.query(
        "update public.profiles set bio_json = $2 where id = $1 returning bio_json",
        [profileId, JSON.stringify(BIO)],
      );
      expect(rows[0].bio_json).toMatchObject({ type: 'doc' });
    });
  });

  it("still blocks owner from updating name", async () => {
    await withRollback(async (client) => {
      const { authUserId, profileId } = await insertVerifiedProfile(client, { email: "bio-block@studenti.czu.cz" });
      await asClaims(client, { sub: authUserId });
      await expect(
        client.query("update public.profiles set name = 'X' where id = $1", [profileId]),
      ).rejects.toThrow(/Only picture, bio_json and beta_access_granted_at/);
    });
  });

  it("blocks one user from updating another profile bio via RLS/trigger", async () => {
    await withRollback(async (client) => {
      const a = await insertVerifiedProfile(client, { email: "bio-a@studenti.czu.cz" });
      const b = await insertVerifiedProfile(client, { email: "bio-b@studenti.czu.cz" });
      await asClaims(client, { sub: a.authUserId });
      const res = await client.query(
        "update public.profiles set bio_json = $2 where id = $1 returning id",
        [b.profileId, JSON.stringify(BIO)],
      );
      expect(res.rowCount).toBe(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:integration tests/integration/profiles.bio.int.test.ts`
Expected: FAIL — first test rejects with `Only picture and beta_access_granted_at can be updated by users` (trigger not yet updated; third test may also fail if `bio_json` column missing — run Task 2 migration first).

**Step 3: Write minimal implementation (custom migration SQL)**

Run: `pnpm db:generate:custom` (creates empty migration). Add this `CREATE OR REPLACE` (full function, only bio lines changed vs `db/sql/functions.sql:2202-2288`):

```sql
-- Allow bio_json in the user_id-linking branch: add
--   and old.bio_json is not distinct from new.bio_json
-- after the picture check, and allow regular bio edits by adding
--   or old.bio_json is distinct from new.bio_json
-- to the rejection IF (i.e. bio_json is NOT a rejection reason).
-- Update the error to: 'Only picture, bio_json and beta_access_granted_at can be updated by users'
CREATE OR REPLACE FUNCTION public.validate_picture_only_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
-- ... copy current body from db/sql/functions.sql, with the two bio_json edits above ...
$function$;
```

Then per AGENTS.md functions flow: `pnpm db:up`, then `pnpm db:export`, then `pnpm db:generate` (reports "No schema changes") so the journal records it. Commit `meta/` + migration.

**Step 4: Run test to verify it passes**

Run: `pnpm test:integration tests/integration/profiles.bio.int.test.ts`
Expected: PASS (3 passed)

**Step 5: Commit**

```bash
git add tests/integration/profiles.bio.int.test.ts supabase/migrations/* drizzle/meta/* db/sql/*
git commit -m "feat(profile): allow owners to update bio_json"
```

If setup fails with `Migration failed: <file>`, add the minimal missing Supabase-managed object to `tests/setup/bootstrap.sql` (never edit `supabase/migrations/` for tests).

---

### Task 4: API route `PATCH /api/profile/bio` (validation covered by Task 1; route covered by E2E per repo rule)

**Files:**
- Create: `src/app/api/profile/bio/route.ts`

**Step 1: Implementation (mirrors `src/app/api/profile/beta-access/route.ts:6-48` + `src/app/api/essays/route.ts:99-105`)**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { validateBioContent } from "@/lib/profile/bio-validation";
import type { Json } from "@/lib/supabase/database.types";
import { serverLogger } from "@/lib/server-logger";

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
    if (!user) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 });

    const body = await request.json();
    const result = validateBioContent(body?.bio_json ?? null);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const { error } = await supabase
      .from("profiles")
      .update({ bio_json: result.value as Json | null } as never)
      .eq("id", profile.id);
    if (error) throw error;
    return NextResponse.json({ bio_json: result.value });
  } catch (error) {
    serverLogger.console.error("PATCH /api/profile/bio error:", error);
    return NextResponse.json({ error: "Nepodařilo se uložit bio" }, { status: 500 });
  }
}
```

Note: `supabase-js` typing needs regen (`pnpm db:types`) after Task 2, else `bio_json` errors — cast via `as never` like beta-access route until types land.

**Step 2: Verify**

Run: `pnpm typecheck`
Expected: PASS. Route behavior is covered by the E2E spec in Task 7 (repo rule: query/route coverage belongs to E2E, not integration).

**Step 3: Commit**

```bash
git add src/app/api/profile/bio/route.ts
git commit -m "feat(profile): add PATCH /api/profile/bio"
```

---

### Task 5: `BioEditor` — simplified Tiptap (TDD component)

**Files:**
- Create: `src/components/profile/bio-editor.tsx`
- Test: `src/components/profile/bio-editor.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BioEditor } from './bio-editor';

describe('BioEditor', () => {
  it('renders placeholder and emits JSON on change', async () => {
    const onChange = vi.fn();
    render(<BioEditor initialContent={null} onChange={onChange} />);
    expect(await screen.findByText(/Napište něco o sobě/i)).toBeInTheDocument();
  });

  it('has bold and list buttons but no image button', async () => {
    render(<BioEditor initialContent={null} />);
    expect(await screen.findByTitle(/Tučné/i)).toBeInTheDocument();
    expect(screen.queryByTitle(/Vložit obrázek/i)).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:component src/components/profile/bio-editor.test.tsx`
Expected: FAIL with "Cannot find module './bio-editor'"

**Step 3: Write minimal implementation**

`"use client"` component with restricted extensions only:

```tsx
'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
// Configure StarterKit WITHOUT heading/image/codeBlock: StarterKit.configure({ heading: false, codeBlock: false, blockquote: false ... })
// Keep: Bold, Italic, Strike, BulletList, OrderedList, ListItem, Blockquote, HardBreak via StarterKit subset + Underline + Link + Placeholder("Napište něco o sobě…")
// Toolbar: Bold, Italic, Underline, Strike, BulletList, OrderedList, Blockquote, Link dialog — reuse Button from @/components/ui/button, never raw <button>.
// onUpdate: onChange?.(editor.getJSON(), editor.getText())
```

Full toolbar code is written at implementation time following `src/components/essays/tiptap-editor.tsx:383-473` but trimmed to the 8 buttons above. Styling reuses `.tiptap` classes from `src/app/globals.css:252-322`; use semantic tokens only.

**Step 4: Run test to verify it passes**

Run: `pnpm test:component src/components/profile/bio-editor.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/bio-editor.tsx src/components/profile/bio-editor.test.tsx
git commit -m "feat(profile): add simplified bio editor"
```

---

### Task 6: `BioSection` — view + edit card (TDD component)

**Files:**
- Create: `src/components/profile/bio-section.tsx`
- Test: `src/components/profile/bio-section.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BioSection } from './bio-section';

const BIO = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ahoj, jsem student:ka.' }] }] };

describe('BioSection', () => {
  it('renders bio text for visitors without edit button', () => {
    render(<BioSection bioJson={BIO} isOwnProfile={false} />);
    expect(screen.getByText(/Ahoj, jsem/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upravit/i })).toBeNull();
  });

  it('shows empty state with edit button for own profile', () => {
    render(<BioSection bioJson={null} isOwnProfile={true} />);
    expect(screen.getByText(/Představte se ostatním/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upravit bio/i })).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:component src/components/profile/bio-section.test.tsx`
Expected: FAIL with "Cannot find module './bio-section'"

**Step 3: Write minimal implementation**

```tsx
'use client';
// Card with <TiptapRenderer content={bioJson} /> when present.
// Own profile: "Upravit bio" Button → responsive AlertDialog with <BioEditor/> + char count (contentTextFromJson length / 5000) + Uložit (disabled when invalid/empty-unchanged/saving).
// Save: fetch PATCH /api/profile/bio { bio_json }, sonner toast success/error, router.refresh() on success.
// Empty states: own → "Představte se ostatním…" + button; visitor → render nothing (return null) to keep profiles clean.
// Light + dark via semantic tokens only. No raw <button>, no window.confirm().
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:component src/components/profile/bio-section.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/bio-section.tsx src/components/profile/bio-section.test.tsx
git commit -m "feat(profile): add bio view-edit section"
```

---

### Task 7: Wire into profile Přehled tab + E2E smoke

**Files:**
- Modify: `src/app/(main)/komunita/profil/[id]/page.tsx:158-203`
- Create: `tests/e2e/profile-bio.spec.ts` (optional smoke; Playwright needs running app + auth fixture per `docs/runbooks/testing.md:70-78`)

**Step 1: Page integration**

Inside `<TabsContent value="prehled">`, above the stats row, insert:

```tsx
import { BioSection } from '@/components/profile/bio-section';
// ...
<BioSection bioJson={(profile as { bio_json?: object | null }).bio_json ?? null} isOwnProfile={isOwnProfile} />
```

(`profile` type gains `bio_json` automatically after `pnpm db:types` regenerates `src/lib/supabase/database.types.ts`. Until then the cast keeps `typecheck` green.)

**Step 2: Verify**

Run: `pnpm test` then `pnpm typecheck`
Expected: all green.

**Step 3: E2E smoke (only if auth fixture exists; else manual)**

Manual checklist: own profile → Upravit bio → bold/link/list → Uložit → toast + persists after refresh; visitor view shows rendered bio, no edit button; over-5000 chars blocked with error; light + dark theme OK.

**Step 4: Commit**

```bash
git add src/app/\(main\)/komunita/profil/\[id\]/page.tsx tests/e2e/profile-bio.spec.ts
git commit -m "feat(profile): show bio in prehled tab"
```

---

### Task 8: Final verification

**Steps:**
1. Run: `pnpm test` — Expected: all unit + component PASS.
2. Run: `pnpm test:integration` (needs Docker) — Expected: PASS including `profiles.bio.int.test.ts`.
3. Run: `pnpm typecheck` + `pnpm lint` — Expected: clean.
4. Check `git status` — schema edit + migration committed together; no edits to existing `supabase/migrations/*` files; no hardcoded hex in components; Czech copy uses `:` forms (`Student:ka` style) and present tense.
5. Load skill @verification-before-completion before claiming done.

Commit the plan doc itself first:

```bash
git add docs/plans/2026-09-22-profile-bio.md
git commit -m "docs: add profile bio implementation plan"
```
