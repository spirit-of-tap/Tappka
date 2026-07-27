# Individual Coaching Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-service log of individual (1:1) coaching sessions — schema, RLS, queries, components, pages, and team/profile stats — mirroring the existing `customer_meetings` feature.

**Architecture:** New Drizzle schema table `individual_coaching_sessions` (RLS-protected, owner-only CRUD) with a matching `src/lib/individual-coaching-sessions/` query layer, `src/components/individual-coaching-sessions/` UI, and `/koucovani` + `/koucovani/[sessionId]` pages. Team-level stats reuse the existing team-page tabs pattern with a new bar chart; profile-page gets one extra stat. No dashboard widget, no booking/notifications/approval workflow, no historical Excel import — see the spec for the full scope rationale.

**Tech Stack:** Next.js App Router (Server Components), Drizzle (schema-only, migrations via Supabase CLI), supabase-js, Recharts, shadcn/ui components, Vitest + Testcontainers (integration layer).

**Spec:** `docs/superpowers/specs/2026-07-28-individual-coaching-sessions-design.md`

## Global Constraints

- TypeScript strict mode — no `any`; derived DB row types use `type` (via `Tables<'...'>`), not `interface`.
- Naming: PascalCase components, camelCase vars/functions, kebab-case files.
- Imports ordered: external → `@/` internal → styles, one blank line between groups.
- Server Components by default; `"use client"` only where interactivity/browser APIs are needed.
- RLS must be enabled on the new table; policies must carry full `using`/`withCheck` (per CLAUDE.md, so `db:generate` can `DROP POLICY` cleanly before any future `DROP COLUMN`).
- Schema is edited in `db/schema/*.ts` only — never hand-write migration SQL for table/column/index/RLS changes. After editing schema, the user must run `pnpm db:migrate` themselves (or explicitly ask this session to run it) and review the generated migration for unexpected drops before it's considered done.
- DB row/enum types are never hand-written — always derived via `Tables<'x'>`.
- App data access goes through `supabase-js` only (RLS must apply) — never a runtime Drizzle client.
- Realtime is out of scope for this feature (no broadcast channels needed).
- Route/UI copy is in Czech, matching the rest of the app.
- No new unit/component tests beyond the RLS integration test — this matches the actual test coverage level of the `customer_meetings` reference feature (which has none). The one exception is required by CLAUDE.md: DB schema/RLS gets integration-layer coverage.

---

### Task 1: Database schema + RLS for `individual_coaching_sessions`

**Files:**
- Create: `db/schema/individual-coaching-sessions.ts`

**Interfaces:**
- Produces: Postgres table `public.individual_coaching_sessions` with columns `id, profile_id, session_at, coach_name, key_takeaways, action_steps, removed_at, created_at, updated_at, created_by_profile_id, updated_by_profile_id`, RLS policies scoped to `profile_id = current_profile_id()` for select/insert/update/delete (to `authenticated`).

- [ ] **Step 1: Write the schema file**

Model this exactly on `db/schema/customer-meetings.ts:1-42`, dropping `company`/`contact_person`/`position`/`objective`/`post_mortem`/`team_share` in favor of the coaching fields, and dropping `meeting_at`'s special-casing (nothing else references it).

```typescript
import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"

export const individualCoachingSessions = pgTable("individual_coaching_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	sessionAt: timestamp("session_at", { withTimezone: true, mode: 'string' }),
	coachName: text("coach_name").notNull(),
	keyTakeaways: text("key_takeaways"),
	actionSteps: text("action_steps"),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("individual_coaching_sessions_profile_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")),
	index("individual_coaching_sessions_created_desc_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "individual_coaching_sessions_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "individual_coaching_sessions_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "individual_coaching_sessions_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Users can view their own coaching sessions", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can create their own coaching sessions", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can update their own coaching sessions", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(profile_id = current_profile_id())`, withCheck: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can delete their own coaching sessions", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(profile_id = current_profile_id())` }),
]).enableRLS()
```

- [ ] **Step 2: Get the migration generated and applied — STOP for user action**

This step cannot be run unattended: per CLAUDE.md, prompt the user to run `pnpm db:migrate` themselves. Say something like:

> "Schema written to `db/schema/individual-coaching-sessions.ts`. Please run `pnpm db:migrate` to generate and apply the migration, then let me know so I can check the generated SQL for any unexpected drops before we continue."

If the user instead asks this session to run it, use `pnpm db:up` only (never `pnpm supabase db reset` or hand-edit anything under `supabase/migrations/`).

- [ ] **Step 3: Verify the generated migration**

Read the new file under `supabase/migrations/` (timestamp-prefixed, name auto-generated by drizzle-kit). Confirm it only *creates* `individual_coaching_sessions`, its indexes, FKs, and 4 policies — no `DROP` statements against any other table. Confirm `src/lib/supabase/database.types.ts` picked up the new `individual_coaching_sessions` table (via `pnpm db:types`, which `db:migrate` runs automatically).

- [ ] **Step 4: Commit**

```bash
git add db/schema/individual-coaching-sessions.ts supabase/migrations/ src/lib/supabase/database.types.ts
git commit -m "feat: add individual_coaching_sessions table and RLS policies"
```

---

### Task 2: RLS integration test

**Files:**
- Create: `tests/integration/individual-coaching-sessions.int.test.ts`

**Interfaces:**
- Consumes: `public.individual_coaching_sessions` table + RLS policies from Task 1; `tests/setup/tx.ts` (`withRollback`), `tests/setup/rls.ts` (`asClaims`), `tests/setup/factories.ts` (`insertAuthUser`).

- [ ] **Step 1: Write the failing test**

Model this on `tests/integration/notification-preferences.int.test.ts:1-52` (two-profile `seed` helper) and its RLS `describe` block (`:96-173`).

```typescript
import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import type { PoolClient } from "pg";

async function seed(client: PoolClient) {
  const ownerAuth = await insertAuthUser(client);
  const otherAuth = await insertAuthUser(client);

  const { rows: ownerUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [ownerAuth.id],
  );
  const { rows: otherUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [otherAuth.id],
  );

  await client.query(
    "update public.users set verified_work_email = google_email, verified_work_email_at = now() where id = any($1)",
    [[ownerUserRows[0].id, otherUserRows[0].id]],
  );

  await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ('Owner', 'ics-owner@studenti.czu.cz', $1, 'student')`,
    [ownerUserRows[0].id],
  );
  const { rows: ownerProfiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [ownerUserRows[0].id],
  );

  await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ('Other', 'ics-other@studenti.czu.cz', $1, 'student')`,
    [otherUserRows[0].id],
  );
  const { rows: otherProfiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [otherUserRows[0].id],
  );

  return {
    ownerProfileId: ownerProfiles[0].id as string,
    otherProfileId: otherProfiles[0].id as string,
    ownerAuthId: ownerAuth.id as string,
    otherAuthId: otherAuth.id as string,
  };
}

async function insertSession(client: PoolClient, profileId: string, coachName = "Kouč Jana") {
  const { rows } = await client.query(
    `insert into public.individual_coaching_sessions
       (profile_id, coach_name, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $1, $1)
     returning id`,
    [profileId, coachName],
  );
  return rows[0].id as string;
}

describe("individual_coaching_sessions RLS", () => {
  it("lets the owner insert and select their own session", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId } = await seed(client);

      await asClaims(client, { sub: ownerAuthId });
      await insertSession(client, ownerProfileId);

      const { rows } = await client.query(
        "select coach_name from public.individual_coaching_sessions where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].coach_name).toBe("Kouč Jana");
    });
  });

  it("does not let another authenticated user select someone else's session", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, otherAuthId } = await seed(client);
      await insertSession(client, ownerProfileId);

      await asClaims(client, { sub: otherAuthId });
      const { rows } = await client.query(
        "select id from public.individual_coaching_sessions where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows).toHaveLength(0); // RLS filters it out silently, not an error
    });
  });

  it("does not let another authenticated user insert a session for someone else's profile", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, otherAuthId } = await seed(client);

      await asClaims(client, { sub: otherAuthId });
      await expect(
        client.query(
          `insert into public.individual_coaching_sessions
             (profile_id, coach_name, created_by_profile_id, updated_by_profile_id)
           values ($1, 'Spoof', $2, $2)`,
          [ownerProfileId, otherAuthId],
        ),
      ).rejects.toThrow();
    });
  });

  it("lets the owner update and soft-delete (removed_at) their own session", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, ownerAuthId } = await seed(client);
      const sessionId = await insertSession(client, ownerProfileId);

      await asClaims(client, { sub: ownerAuthId });
      await client.query(
        `update public.individual_coaching_sessions
           set key_takeaways = 'Uvědomění', updated_by_profile_id = $2
         where id = $1`,
        [sessionId, ownerProfileId],
      );
      await client.query(
        `update public.individual_coaching_sessions
           set removed_at = now(), updated_by_profile_id = $2
         where id = $1`,
        [sessionId, ownerProfileId],
      );

      const { rows } = await client.query(
        "select key_takeaways, removed_at from public.individual_coaching_sessions where id = $1",
        [sessionId],
      );
      expect(rows[0].key_takeaways).toBe("Uvědomění");
      expect(rows[0].removed_at).not.toBeNull();
    });
  });

  it("does not let another authenticated user update or delete someone else's session", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, otherAuthId } = await seed(client);
      const sessionId = await insertSession(client, ownerProfileId);

      await asClaims(client, { sub: otherAuthId });
      const updateResult = await client.query(
        "update public.individual_coaching_sessions set coach_name = 'Hacked' where id = $1",
        [sessionId],
      );
      expect(updateResult.rowCount).toBe(0); // RLS filters the row out

      const deleteResult = await client.query(
        "delete from public.individual_coaching_sessions where id = $1",
        [sessionId],
      );
      expect(deleteResult.rowCount).toBe(0);
    });
  });

  it("cascades delete when the owning profile is removed", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId } = await seed(client);
      await insertSession(client, ownerProfileId);

      await client.query("delete from public.profiles where id = $1", [ownerProfileId]);

      const { rows } = await client.query(
        "select count(*)::int as cnt from public.individual_coaching_sessions where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows[0].cnt).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it currently fails (or passes trivially before code exists — verify it's exercising the real table)**

Run: `pnpm test:integration -- individual-coaching-sessions`
Expected: all tests PASS, since Task 1's migration already created the table and policies. If any test fails, the schema/RLS from Task 1 has a defect — fix `db/schema/individual-coaching-sessions.ts` and re-migrate before proceeding (do not adjust the test to match broken RLS).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/individual-coaching-sessions.int.test.ts
git commit -m "test: add RLS integration coverage for individual_coaching_sessions"
```

---

### Task 3: Lib layer — types + queries

**Files:**
- Create: `src/lib/individual-coaching-sessions/types.ts`
- Create: `src/lib/individual-coaching-sessions/queries.ts`

**Interfaces:**
- Consumes: `Tables<'individual_coaching_sessions'>` from `@/lib/supabase/tables` (generated from Task 1's migration); `createAdminClient` from `@/lib/supabase/admin`.
- Produces: `IndividualCoachingSession` type; `listIndividualCoachingSessions(supabase, profileId)`, `countIndividualCoachingSessions(supabase, profileId)`, `getIndividualCoachingSession(supabase, id)`, `TeamMemberCoachingStats` interface, `getTeamCoachingSessionStats(teamId)` — consumed by Tasks 7–10.

- [ ] **Step 1: Write `types.ts`**

```typescript
import type { Tables } from "@/lib/supabase/tables"

export type IndividualCoachingSession = Tables<"individual_coaching_sessions">
```

- [ ] **Step 2: Write `queries.ts`**

Direct port of `src/lib/customer-meetings/queries.ts:1-93`, renaming `meeting_at` → `session_at` and dropping meeting-specific fields.

```typescript
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { IndividualCoachingSession } from "./types"
import { createAdminClient } from "@/lib/supabase/admin"

export async function listIndividualCoachingSessions(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<IndividualCoachingSession[]> {
  const { data, error } = await supabase
    .from("individual_coaching_sessions")
    .select("*")
    .is("removed_at", null)
    .eq("profile_id", profileId)
    .order("session_at", { ascending: false, nullsFirst: false })

  if (error) throw error
  return data ?? []
}

export async function countIndividualCoachingSessions(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("individual_coaching_sessions")
    .select("id", { count: "exact", head: true })
    .is("removed_at", null)
    .eq("profile_id", profileId)

  if (error) throw error
  return count ?? 0
}

export async function getIndividualCoachingSession(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<IndividualCoachingSession | null> {
  const { data, error } = await supabase
    .from("individual_coaching_sessions")
    .select("*")
    .eq("id", id)
    .is("removed_at", null)
    .maybeSingle()

  if (error) throw error
  return data
}

export interface TeamMemberCoachingStats {
  profile: { id: string; name: string; picture: string | null }
  count: number
}

export async function getTeamCoachingSessionStats(
  teamId: string,
): Promise<TeamMemberCoachingStats[]> {
  const admin = createAdminClient()

  const { data: members, error: memberError } = await admin
    .from("profiles")
    .select("id, name, picture")
    .eq("team_id", teamId)
    .is("access_removed_at", null)

  if (memberError) throw memberError
  if (!members || members.length === 0) return []

  const memberIds = members.map((m: { id: string }) => m.id)

  const { data: sessions, error: sessionError } = await admin
    .from("individual_coaching_sessions")
    .select("profile_id")
    .in("profile_id", memberIds)
    .is("removed_at", null)

  if (sessionError) throw sessionError

  const counts: Record<string, number> = {}
  for (const s of sessions ?? []) {
    counts[s.profile_id] = (counts[s.profile_id] ?? 0) + 1
  }

  return members.map((member: { id: string; name: string | null; picture: string | null }) => ({
    profile: {
      id: member.id,
      name: member.name ?? "",
      picture: member.picture,
    },
    count: counts[member.id] ?? 0,
  }))
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors referencing `individual-coaching-sessions`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/individual-coaching-sessions/
git commit -m "feat: add individual coaching sessions query layer"
```

---

### Task 4: Form component

**Files:**
- Create: `src/components/individual-coaching-sessions/individual-coaching-session-form.tsx`

**Interfaces:**
- Consumes: `IndividualCoachingSession` from `@/lib/individual-coaching-sessions/types` (Task 3); `createClient` from `@/lib/supabase/client`; shadcn `Button`, `Input`, `Textarea`, `Label`.
- Produces: `IndividualCoachingSessionForm({ profileId, initial?, onSuccess, onCancel })` — consumed by Tasks 5 and 6.

- [ ] **Step 1: Write the component**

Port of `src/components/customer-meetings/customer-meeting-form.tsx:1-181`: `company`/`contact_person`/`position`/`objective` collapse into a single required `coach_name`; `meeting_at` → `session_at` (still optional datetime-local); `post_mortem`/`team_share` become `key_takeaways`/`action_steps` (both optional).

```tsx
"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { IndividualCoachingSession } from "@/lib/individual-coaching-sessions/types"

interface IndividualCoachingSessionFormProps {
  profileId: string
  initial?: Partial<IndividualCoachingSession>
  onSuccess: (session: IndividualCoachingSession) => void
  onCancel: () => void
}

export function IndividualCoachingSessionForm({ profileId, initial, onSuccess, onCancel }: IndividualCoachingSessionFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coachName, setCoachName] = useState(initial?.coach_name ?? "")
  const [sessionAt, setSessionAt] = useState(
    initial?.session_at ? initial.session_at.slice(0, 16) : "",
  )
  const [keyTakeaways, setKeyTakeaways] = useState(initial?.key_takeaways ?? "")
  const [actionSteps, setActionSteps] = useState(initial?.action_steps ?? "")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!coachName.trim()) { setError("Jméno kouče je povinné"); return }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { throw new Error("Nepřihlášen") }

      const isEdit = !!initial?.id
      const base = {
        coach_name: coachName.trim(),
        session_at: sessionAt || null,
        key_takeaways: keyTakeaways.trim() || null,
        action_steps: actionSteps.trim() || null,
        updated_by_profile_id: profileId,
      }

      let data: IndividualCoachingSession
      if (isEdit) {
        const result = await supabase
          .from("individual_coaching_sessions")
          .update(base)
          .eq("id", initial!.id!)
          .select()
          .single()
        if (result.error) throw result.error
        data = result.data
      } else {
        const result = await supabase
          .from("individual_coaching_sessions")
          .insert({ ...base, profile_id: profileId, created_by_profile_id: profileId })
          .select()
          .single()
        if (result.error) throw result.error
        data = result.data
      }

      toast.success(initial ? "Sezení aktualizováno" : "Sezení vytvořeno")
      onSuccess(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznámá chyba")
      toast.error("Nepodařilo se uložit sezení")
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="coach-name">Kouč *</Label>
          <Input
            id="coach-name"
            value={coachName}
            onChange={(e) => setCoachName(e.target.value)}
            placeholder="Jméno kouče"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="session-at">Datum sezení</Label>
          <Input
            id="session-at"
            type="datetime-local"
            value={sessionAt}
            onChange={(e) => setSessionAt(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="key-takeaways">Co jsem si odnesl / uvědomění</Label>
        <Textarea
          id="key-takeaways"
          value={keyTakeaways}
          onChange={(e) => setKeyTakeaways(e.target.value)}
          placeholder="Hlavní myšlenky a insighty ze sezení"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="action-steps">Akční kroky po koučování</Label>
        <Textarea
          id="action-steps"
          value={actionSteps}
          onChange={(e) => setActionSteps(e.target.value)}
          placeholder="Konkrétní úkoly a kroky, které z koučování vyplynuly"
          rows={3}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Zrušit
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {initial ? "Uložit změny" : "Vytvořit sezení"}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/components/individual-coaching-sessions/individual-coaching-session-form.tsx
git commit -m "feat: add individual coaching session form"
```

---

### Task 5: List component + info card

**Files:**
- Create: `src/components/individual-coaching-sessions/individual-coaching-session-list.tsx`
- Create: `src/components/individual-coaching-sessions/info-card.tsx`

**Interfaces:**
- Consumes: `IndividualCoachingSessionForm` (Task 4); `IndividualCoachingSession` type (Task 3).
- Produces: `IndividualCoachingSessionList({ sessions, profileId })` and `InfoCard()` — consumed by Task 7.

- [ ] **Step 1: Write `info-card.tsx`**

```tsx
import { Info } from "lucide-react"

export function InfoCard() {
  return (
    <div className="flex gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
      <div className="space-y-1">
        <p>
          <strong>Individuální koučování</strong> je 1:1 sezení s týmovým koučem. Cílem je
          reflektovat svůj rozvoj a najít konkrétní kroky k dalšímu růstu.
        </p>
        <p>
          Zapiš si, co sis z koučování odnesl a jaké akční kroky z něj vyplynuly —{" "}
          <strong>alespoň jedno sezení za semestr</strong> je očekáváno od každého studenta.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `individual-coaching-session-list.tsx`**

Direct port of `src/components/customer-meetings/customer-meeting-list.tsx:1-292` grouping logic (unchanged), swapping the card content for coach name / key takeaways preview and the create-button/dialog copy.

```tsx
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus, UserCircle, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog"
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { IndividualCoachingSessionForm } from "./individual-coaching-session-form"
import type { IndividualCoachingSession } from "@/lib/individual-coaching-sessions/types"

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function getMonthKey(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split("-")
  return `${MONTH_LABELS[Number(month) - 1]} ${year}`
}

function getCurrentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function monthKeyToDate(key: string): Date {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1)
}

function addMonths(key: string, n: number): string {
  const d = monthKeyToDate(key)
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

interface GroupedSessions {
  key: string
  label: string
  count: number
}

interface IndividualCoachingSessionListProps {
  sessions: IndividualCoachingSession[]
  profileId: string
}

export function IndividualCoachingSessionList({ sessions, profileId }: IndividualCoachingSessionListProps) {
  const [items, setItems] = useState(sessions)
  const [createOpen, setCreateOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const sessionMap = useMemo(() => {
    const map = new Map<string, IndividualCoachingSession[]>()
    const undated: IndividualCoachingSession[] = []
    let earliestKey = getCurrentMonthKey()
    for (const s of items) {
      const key = getMonthKey(s.session_at)
      if (!key) { undated.push(s); continue }
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
      if (key < earliestKey) earliestKey = key
    }
    return { map, earliestKey, undated }
  }, [items])

  const groups = useMemo(() => {
    const currentKey = getCurrentMonthKey()
    const result: GroupedSessions[] = []
    let cursor = sessionMap.earliestKey
    while (cursor <= currentKey) {
      result.push({
        key: cursor,
        label: getMonthLabel(cursor),
        count: sessionMap.map.get(cursor)?.length ?? 0,
      })
      cursor = addMonths(cursor, 1)
    }
    result.reverse()
    return result
  }, [sessionMap])

  function handleCreated(session: IndividualCoachingSession) {
    setItems((prev) => {
      const updated = [session, ...prev]
      updated.sort((a, b) => {
        if (!a.session_at) return 1
        if (!b.session_at) return -1
        return b.session_at.localeCompare(a.session_at)
      })
      return updated
    })
    setCreateOpen(false)
  }

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-end gap-4">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Nové sezení
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nové koučovací sezení</DialogTitle>
            </DialogHeader>
            <IndividualCoachingSessionForm
              profileId={profileId}
              onSuccess={handleCreated}
              onCancel={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {sessionMap.undated.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => toggleCollapse("__undated__")}
            className="flex w-full items-center gap-2 mb-2 sm:mb-3 group"
          >
            <Calendar className="size-4 shrink-0 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Bez data
            </h2>
            <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
              {sessionMap.undated.length}
            </Badge>
            <span className="ml-auto text-xs text-muted-foreground transition-transform group-hover:translate-y-0.5">
              {collapsed.has("__undated__") ? "rozbalit" : "skrýt"}
            </span>
          </button>
          {!collapsed.has("__undated__") && (
            <div className="space-y-2">
              {sessionMap.undated.map((session) => (
                <Link key={session.id} href={`/koucovani/${session.id}`} className="block">
                  <Card className="p-3 sm:p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <UserCircle className="size-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium text-sm truncate">
                            {session.coach_name}
                          </span>
                        </div>
                        {session.key_takeaways && (
                          <p className="text-xs text-muted-foreground/80 line-clamp-2">
                            {session.key_takeaways}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {items.length === 0 && sessionMap.undated.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <UserCircle className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Žádná sezení</EmptyTitle>
            <EmptyDescription>
              Zatím nemáš žádné záznamy. Přidej své první koučovací sezení.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="size-4" />
                  Přidat sezení
                </Button>
              </DialogTrigger>
            </Dialog>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.key)
            const sessionsInMonth = sessionMap.map.get(group.key) ?? []

            return (
              <section key={group.key}>
                <button
                  type="button"
                  onClick={() => toggleCollapse(group.key)}
                  className="flex w-full items-center gap-2 mb-2 sm:mb-3 group"
                >
                  <Calendar className="size-4 shrink-0 text-muted-foreground" />
                  <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.label}
                  </h2>
                  <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                    {group.count}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground transition-transform group-hover:translate-y-0.5">
                    {isCollapsed ? "rozbalit" : "skrýt"}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-2">
                    {sessionsInMonth.length === 0 ? (
                      <p className="text-xs text-muted-foreground/40 italic px-1 py-3 text-center sm:text-left">
                        — tento měsíc žádné sezení
                      </p>
                    ) : (
                      sessionsInMonth.map((session) => (
                        <Link key={session.id} href={`/koucovani/${session.id}`} className="block">
                          <Card className="p-3 sm:p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <UserCircle className="size-4 shrink-0 text-muted-foreground" />
                                  <span className="font-medium text-sm truncate">
                                    {session.coach_name}
                                  </span>
                                  {session.session_at && (
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {new Date(session.session_at).toLocaleDateString("cs-CZ", {
                                        day: "numeric",
                                        month: "short",
                                      })}
                                    </span>
                                  )}
                                </div>
                                {session.key_takeaways && (
                                  <p className="text-xs text-muted-foreground/80 line-clamp-2">
                                    {session.key_takeaways}
                                  </p>
                                )}
                              </div>
                            </div>
                          </Card>
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors in either new file.

- [ ] **Step 4: Commit**

```bash
git add src/components/individual-coaching-sessions/individual-coaching-session-list.tsx src/components/individual-coaching-sessions/info-card.tsx
git commit -m "feat: add individual coaching session list and info card"
```

---

### Task 6: Detail component

**Files:**
- Create: `src/components/individual-coaching-sessions/individual-coaching-session-detail.tsx`

**Interfaces:**
- Consumes: `IndividualCoachingSessionForm` (Task 4); `IndividualCoachingSession` type (Task 3).
- Produces: `IndividualCoachingSessionDetail({ session, profileId })` — consumed by Task 7.

- [ ] **Step 1: Write the component**

Port of `src/components/customer-meetings/customer-meeting-detail.tsx:1-187`: drop the company/position/objective/team-share rows, add `Lightbulb`/`ListChecks` rows for `key_takeaways`/`action_steps`.

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, UserCircle, Calendar, Lightbulb, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { IndividualCoachingSessionForm } from "./individual-coaching-session-form"
import type { IndividualCoachingSession } from "@/lib/individual-coaching-sessions/types"

interface IndividualCoachingSessionDetailProps {
  session: IndividualCoachingSession
  profileId: string
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

export function IndividualCoachingSessionDetail({ session, profileId }: IndividualCoachingSessionDetailProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("individual_coaching_sessions")
        .update({ removed_at: new Date().toISOString() })
        .eq("id", session.id)

      if (error) throw error
      toast.success("Sezení odstraněno")
      router.push("/koucovani")
    } catch {
      toast.error("Nepodařilo se odstranit sezení")
    } finally {
      setDeleting(false)
    }
  }

  function handleUpdated(_: IndividualCoachingSession) {
    setEditOpen(false)
    router.refresh()
    toast.success("Sezení aktualizováno")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Pencil className="size-4" />
              Upravit
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upravit sezení</DialogTitle>
            </DialogHeader>
            <IndividualCoachingSessionForm
              profileId={profileId}
              initial={session}
              onSuccess={handleUpdated}
              onCancel={() => setEditOpen(false)}
            />
          </DialogContent>
        </Dialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive">
              <Trash2 className="size-4" />
              Smazat
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Odstranit sezení?</AlertDialogTitle>
              <AlertDialogDescription>
                Tato akce sezení s {session.coach_name} odstraní.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleting}
              >
                {deleting ? "Odstraňuji..." : "Odstranit"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detaily sezení</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <DetailRow icon={UserCircle} label="Kouč">
              {session.coach_name}
            </DetailRow>
            <DetailRow icon={Calendar} label="Datum">
              {session.session_at
                ? new Date(session.session_at).toLocaleDateString("cs-CZ", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Neuvedeno"}
            </DetailRow>
          </div>

          {(session.key_takeaways || session.action_steps) && (
            <div className="border-t pt-6 space-y-6">
              {session.key_takeaways && (
                <DetailRow icon={Lightbulb} label="Co jsem si odnesl / uvědomění">
                  <p className="whitespace-pre-wrap">{session.key_takeaways}</p>
                </DetailRow>
              )}

              {session.action_steps && (
                <DetailRow icon={ListChecks} label="Akční kroky po koučování">
                  <p className="whitespace-pre-wrap">{session.action_steps}</p>
                </DetailRow>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/components/individual-coaching-sessions/individual-coaching-session-detail.tsx
git commit -m "feat: add individual coaching session detail view"
```

---

### Task 7: List + detail pages

**Files:**
- Create: `src/app/(main)/koucovani/page.tsx`
- Create: `src/app/(main)/koucovani/[sessionId]/page.tsx`

**Interfaces:**
- Consumes: `listIndividualCoachingSessions`, `getIndividualCoachingSession` (Task 3); `IndividualCoachingSessionList` (Task 5); `IndividualCoachingSessionDetail` (Task 6); `InfoCard` (Task 5); `getSessionProfile` from `@/lib/auth/session`.

- [ ] **Step 1: Write the list page**

Port of `src/app/(main)/schuzky/page.tsx:1-45`. Note "sezení" doesn't inflect by count in Czech, so no plural-form helper is needed (unlike `schůzka/schůzky/schůzek`).

```tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listIndividualCoachingSessions } from "@/lib/individual-coaching-sessions/queries"
import { IndividualCoachingSessionList } from "@/components/individual-coaching-sessions/individual-coaching-session-list"
import { InfoCard } from "@/components/individual-coaching-sessions/info-card"

export const metadata = {
  title: "Individuální koučování | Tappka",
  description: "Záznamník individuálních koučovacích sezení",
}

export default async function KoucovaniPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")

  const sessions = await listIndividualCoachingSessions(supabase, profile.id)

  return (
    <div className="container mx-auto max-w-5xl py-4 sm:py-6 px-3 sm:px-6 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Individuální koučování</h1>
          <p className="text-sm text-muted-foreground">
            Záznamník koučovacích sezení s týmovým koučem
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold tabular-nums leading-none">{sessions.length}</p>
          <p className="text-sm text-muted-foreground">sezení</p>
        </div>
      </div>
      <InfoCard />
      <IndividualCoachingSessionList sessions={sessions} profileId={profile.id} />
    </div>
  )
}
```

- [ ] **Step 2: Write the detail page**

Port of `src/app/(main)/schuzky/[meetingId]/page.tsx:1-53`.

```tsx
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { getIndividualCoachingSession } from "@/lib/individual-coaching-sessions/queries"
import { IndividualCoachingSessionDetail } from "@/components/individual-coaching-sessions/individual-coaching-session-detail"
import { Button } from "@/components/ui/button"

interface SessionDetailPageProps {
  params: Promise<{ sessionId: string }>
}

export const metadata = {
  title: "Detail koučovacího sezení | Tappka",
}

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")

  const session = await getIndividualCoachingSession(supabase, sessionId)
  if (!session || session.profile_id !== profile.id) {
    notFound()
  }

  return (
    <div className="container mx-auto max-w-3xl py-4 sm:py-6 px-3 sm:px-6 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/koucovani">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{session.coach_name}</h1>
          <p className="text-sm text-muted-foreground">
            Koučovací sezení
            {session.session_at && ` — ${new Date(session.session_at).toLocaleDateString("cs-CZ")}`}
          </p>
        </div>
      </div>
      <IndividualCoachingSessionDetail session={session} profileId={profile.id} />
    </div>
  )
}
```

- [ ] **Step 3: Manually verify the pages render**

Run the dev server (`pnpm dev`), sign in as a test student with `beta_access_granted_at` set, visit `/koucovani`: confirm the empty state renders, create a session via the dialog, confirm it appears grouped by month, click into it, edit it, soft-delete it, confirm redirect back to `/koucovani` and the item is gone from the list.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(main)/koucovani/"
git commit -m "feat: add /koucovani list and detail pages"
```

---

### Task 8: Team stats chart component

**Files:**
- Create: `src/components/teams/team-coaching-sessions-chart.tsx`

**Interfaces:**
- Consumes: `TeamMemberCoachingStats` from `@/lib/individual-coaching-sessions/queries` (Task 3); `shortName` from `@/lib/string-utils`.
- Produces: `TeamCoachingSessionsChart({ stats })` — consumed by Task 10.

- [ ] **Step 1: Write the component**

Port of `src/components/teams/team-customer-meetings-chart.tsx:1-45`, renamed series label and a distinct bar color (`#0ea5e9`, sky-500) so it's visually distinguishable from the meetings chart's purple (`#8b5cf6`) when a user has both tabs open.

```tsx
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { shortName } from '@/lib/string-utils';
import type { TeamMemberCoachingStats } from '@/lib/individual-coaching-sessions/queries';

interface TeamCoachingSessionsChartProps {
  stats: TeamMemberCoachingStats[]
}

export function TeamCoachingSessionsChart({ stats }: TeamCoachingSessionsChartProps) {
  if (stats.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Tým nemá žádné členy</p>
  }

  const data = [...stats]
    .sort((a, b) => b.count - a.count)
    .map((s) => ({
      name: shortName(s.profile.name),
      Sezení: s.count,
    }))

  const maxCount = Math.max(...data.map((d) => d.Sezení), 1)

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, maxCount + 2]} tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="Sezení" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/components/teams/team-coaching-sessions-chart.tsx
git commit -m "feat: add team coaching sessions chart"
```

---

### Task 9: Profile page integration

**Files:**
- Modify: `src/app/(main)/komunita/profil/[id]/page.tsx`

**Interfaces:**
- Consumes: `countIndividualCoachingSessions` from `@/lib/individual-coaching-sessions/queries` (Task 3).

- [ ] **Step 1: Add the import**

In `src/app/(main)/komunita/profil/[id]/page.tsx`, alongside the existing `countCustomerMeetings` import (line 8):

```typescript
import { countIndividualCoachingSessions } from '@/lib/individual-coaching-sessions/queries';
```

- [ ] **Step 2: Fetch the count alongside the existing stats**

Change the `Promise.all` at lines 35-39 from:

```typescript
  const [essays, stats, meetingCount] = await Promise.all([
    getEssays(supabase, { authorProfileId: id, sort: 'best', pageSize: 100 }),
    getUserBookPointsStats(supabase, id),
    countCustomerMeetings(supabase, id).catch(() => 0),
  ]);
```

to:

```typescript
  const [essays, stats, meetingCount, coachingSessionCount] = await Promise.all([
    getEssays(supabase, { authorProfileId: id, sort: 'best', pageSize: 100 }),
    getUserBookPointsStats(supabase, id),
    countCustomerMeetings(supabase, id).catch(() => 0),
    countIndividualCoachingSessions(supabase, id).catch(() => 0),
  ]);
```

- [ ] **Step 3: Add the stat to the stats row**

Change line 61 (`const schuzky = ...`) — add a sibling constant right after it (Czech "sezení" doesn't inflect, so this is a literal, not a pluralizer function):

```typescript
  const schuzky = (n: number) => n === 1 ? 'schůzka' : n >= 2 && n <= 4 ? 'schůzky' : 'schůzek';
  const koucovaniLabel = 'sezení';
```

Then change the stats array at lines 118-123 from:

```typescript
            {[
              { value: stats.approved_points, label: pts(stats.approved_points) },
              { value: stats.essay_count,    label: eseje(stats.essay_count) },
              { value: totalVotes,           label: hlasy(totalVotes) },
              { value: meetingCount,         label: schuzky(meetingCount) },
            ].map(({ value, label }) => (
```

to:

```typescript
            {[
              { value: stats.approved_points, label: pts(stats.approved_points) },
              { value: stats.essay_count,    label: eseje(stats.essay_count) },
              { value: totalVotes,           label: hlasy(totalVotes) },
              { value: meetingCount,         label: schuzky(meetingCount) },
              { value: coachingSessionCount, label: koucovaniLabel },
            ].map(({ value, label }) => (
```

- [ ] **Step 4: Manually verify**

Run `pnpm dev`, visit a profile page (`/komunita/profil/[id]`) for a profile with at least one coaching session created in Task 7's manual check. Confirm a 5th stat tile shows the count labeled "sezení".

- [ ] **Step 5: Commit**

```bash
git add "src/app/(main)/komunita/profil/[id]/page.tsx"
git commit -m "feat: show coaching session count on profile page"
```

---

### Task 10: Team page integration

**Files:**
- Modify: `src/app/(main)/komunita/tymy/[id]/page.tsx`

**Interfaces:**
- Consumes: `TeamCoachingSessionsChart` (Task 8); `getTeamCoachingSessionStats` from `@/lib/individual-coaching-sessions/queries` (Task 3).

- [ ] **Step 1: Add the imports**

Alongside the existing customer-meetings imports (lines 12 and 15):

```typescript
import { TeamCoachingSessionsChart } from '@/components/teams/team-coaching-sessions-chart';
```
```typescript
import { getTeamCoachingSessionStats } from '@/lib/individual-coaching-sessions/queries';
```

- [ ] **Step 2: Fetch the stats alongside the existing ones**

Change the `Promise.all` at lines 27-31 from:

```typescript
  const [team, bookStats, meetingStats] = await Promise.all([
    getTeamById(supabase, id),
    getTeamBookPointsStats(supabase, id).catch(() => []),
    getTeamCustomerMeetingsStats(id).catch(() => []),
  ]);
```

to:

```typescript
  const [team, bookStats, meetingStats, coachingStats] = await Promise.all([
    getTeamById(supabase, id),
    getTeamBookPointsStats(supabase, id).catch(() => []),
    getTeamCustomerMeetingsStats(id).catch(() => []),
    getTeamCoachingSessionStats(id).catch(() => []),
  ]);
```

- [ ] **Step 3: Add the new tab**

Change the inner `TabsList` at lines 159-162 from:

```tsx
            <TabsList>
              <TabsTrigger value="bookpoints">Knižní body</TabsTrigger>
              <TabsTrigger value="schuzky">Zákaznické schůzky</TabsTrigger>
            </TabsList>
```

to:

```tsx
            <TabsList>
              <TabsTrigger value="bookpoints">Knižní body</TabsTrigger>
              <TabsTrigger value="schuzky">Zákaznické schůzky</TabsTrigger>
              <TabsTrigger value="koucovani">Koučování</TabsTrigger>
            </TabsList>
```

And add a new `TabsContent` right after the existing `schuzky` one (after line 176's closing `</TabsContent>`):

```tsx
            <TabsContent value="koucovani" className="mt-4 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Individuální koučování — přehled týmu</h2>
                <p className="text-sm text-muted-foreground">Počet koučovacích sezení napříč členy týmu</p>
              </div>
              <TeamCoachingSessionsChart stats={coachingStats} />
            </TabsContent>
```

- [ ] **Step 4: Manually verify**

Run `pnpm dev`, visit a team page (`/komunita/tymy/[id]`), open the "Statistiky" tab, confirm a new "Koučování" sub-tab appears and renders the bar chart with the sky-blue bars.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(main)/komunita/tymy/[id]/page.tsx"
git commit -m "feat: add coaching sessions tab to team statistics"
```

---

## Final verification

- [ ] Run `pnpm test` (unit + component) — must pass.
- [ ] Run `pnpm test:integration` — must pass, including the new RLS suite from Task 2.
- [ ] Run `pnpm typecheck` — must pass with no errors.
- [ ] Manually walk through: create a session → list groups it by month → open detail → edit → soft-delete → back on `/koucovani` it's gone → profile page stat updates → team statistics tab shows the bar chart.
