# Training Sessions (TS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a cohort-B module `/ts` where teams create and run training sessions (topic, time, room, facilitators, Tiptap preparation, team reflection, attendance) and other teams discover them and take guest seats with live occupancy and overlap warnings.

**Architecture:** Six new Drizzle tables in `db/schema/training-sessions.ts` with RLS (public session/prep-when-published/guests; team-only reflection/attendance). Guest seats change only through `SECURITY DEFINER` RPCs that lock the session row. A DB trigger broadcasts guest/session changes on the private topic `community:training_sessions:feed`; clients just `router.refresh()`. Pages are Server Components reading via `supabase-js`; mutations go through zod-validated API routes under `src/app/api/training-sessions/`. Pure logic (status, overlap, slot prefill from `recurring_schedules`, Prague formatting) lives in `src/lib/training-sessions/` with unit tests.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase (Postgres, RLS, Realtime broadcast), Drizzle (schema only), zod, Tiptap, shadcn/ui, vitest (unit/component/integration with Testcontainers), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-02-training-sessions-design.md`

## Global Constraints

- TypeScript strict, no `any`; `interface` over `type` except DB-derived types (`Tables<'x'>`, `Database['public']['Enums']['x']`) which must be `type`; prefer `??` over `||`.
- Imports: external → `@/` internal → styles, one blank line between groups. Files kebab-case.
- No magic values: extract named constants / `as const` objects.
- Never hand-write migrations for tables/columns/indexes/RLS: edit `db/schema/*.ts`, then **ask the user to run `pnpm db:migrate`** and to check the generated migration for drops. Functions/triggers: `pnpm db:generate:custom` → fill SQL → user runs `pnpm db:up` + `pnpm db:export` → `pnpm db:generate` once (expect "No schema changes"). Never edit existing files in `supabase/migrations/`. Never `db reset`.
- Every `pgPolicy(...)` keeps full `using` / `withCheck`. RLS enabled on every new table.
- App data access only via `supabase-js`; helper signatures take `SupabaseClient<Database>`.
- Realtime: `broadcast` only, `private: true`, topic `community:training_sessions:feed`, events `guest_joined`, `guest_left`, `session_updated`; always unsubscribe.
- UI: `PageShell` + `PageHeader` on every page, semantic color tokens only (text on `/10` tints uses `-strong`), shared primitives (`Button`, `AlertDialog`/`ResponsiveAlertDialog`, `Empty*`, sonner `toast` — one per mutation), verify light + dark theme.
- Czech copy gender-neutral: neutral phrasing first, `:` separator when unavoidable (`Omluven:a`), never generic masculine, tykání.
- Feature gate: new key `trainingSessions: ["B"]` in `BETA_FEATURES`.
- Guest capacity `0..50`; topic 1–200 chars; description ≤ 2000; location note ≤ 200; session length ≤ 12 h; `ends_at > starts_at`.
- All times stored `timestamptz` (UTC), rendered in `Europe/Prague`.
- `pnpm test` and `pnpm typecheck` must pass before each commit; run the relevant other layer (integration/e2e) for tasks that touch it.

## Review Focus

1. **Coach/mentor without a team** opening `/ts/*` or joining as guest — must work (observer + guest), never crash on `profile.team_id === null`, never show create/edit controls. Pinned in Task 3 (RPC test) and Task 8 (Přehled page branch).
2. **Shrinking guest capacity below current guests** — must be refused with 409 and the count, guests never silently dropped. Pinned in Task 6 (API test helper `isCapacityBelowGuests`).
3. **Session crossing DST or midnight in Prague** (e.g. 25 Oct 2026 CEST→CET) — slots/time ranges must show correct local hours and day grouping. Pinned in Task 4 (format + slots unit tests).
4. **Cancelled session still in someone's commitments** — must not produce overlap warnings or count as "nearest TS", but stays visible (muted) in Objevovat. Pinned in Task 4 (`findConflicts` ignores cancelled) and Task 7 (card test).
5. **Last-seat race** (two guests clicking at once) — guarded by `SELECT … FOR UPDATE` in `join_training_session`. A true two-connection race test cannot run inside `withRollback()`; Task 3 asserts sequential capacity enforcement and the reviewer must confirm the `FOR UPDATE` clause is present.

---

## File Structure

**Create**
- `db/schema/training-sessions.ts` — 6 tables + policies
- `supabase/migrations/<generated>_*.sql` — Drizzle (tables) and custom (functions/triggers/realtime policy)
- `src/lib/training-sessions/constants.ts` — limits, topic, events, error codes
- `src/lib/training-sessions/types.ts` — derived types, select strings, view models
- `src/lib/training-sessions/status.ts` (+ `.test.ts`)
- `src/lib/training-sessions/conflicts.ts` (+ `.test.ts`)
- `src/lib/training-sessions/format.ts` (+ `.test.ts`)
- `src/lib/training-sessions/slots.ts` (+ `.test.ts`)
- `src/lib/training-sessions/validation.ts` (+ `.test.ts`) — zod schemas + capacity helper
- `src/lib/training-sessions/queries.ts`
- `src/lib/training-sessions/use-training-session-feed.ts`
- `src/app/api/training-sessions/_shared.ts`, `route.ts`, `[id]/route.ts`, `[id]/preparation/route.ts`, `[id]/reflection/route.ts`, `[id]/attendance/route.ts`, `[id]/guests/route.ts`
- `src/app/(main)/ts/layout.tsx`, `page.tsx`, `prehled/page.tsx`, `objevovat/page.tsx`, `nova/page.tsx`, `[id]/page.tsx`, `[id]/upravit/page.tsx`
- `src/components/training-sessions/ts-tab-bar.tsx` (+ test), `session-card.tsx` (+ test), `session-agenda.tsx`, `guest-join-button.tsx`, `discover-filters.tsx`, `feed-refresher.tsx`, `session-form.tsx`, `slot-chips.tsx` (+ test), `session-detail-tabs.tsx`, `preparation-panel.tsx`, `reflection-panel.tsx`, `attendance-panel.tsx`, `session-actions-menu.tsx`
- `tests/integration/training-sessions.int.test.ts`
- `tests/e2e/training-sessions.spec.ts`

**Modify**
- `src/lib/feature-access.ts` — add `trainingSessions`
- `src/lib/navigation.ts` — `NAV_MODULES` + `MODULE_HUB_ORDER`
- `src/lib/spotlight.ts` — spotlight item
- `src/lib/supabase/database.types.ts` — regenerated by `pnpm db:migrate` (never by hand)
- `db/sql/*.sql` — regenerated by `pnpm db:export`

---

### Task 1: Schema — tables and RLS

**Files:**
- Create: `db/schema/training-sessions.ts`
- Test: `tests/integration/training-sessions.int.test.ts`

**Interfaces:**
- Produces tables `training_sessions`, `training_session_facilitators`, `training_session_preparations`, `training_session_reflections`, `training_session_attendees`, `training_session_guests`; FK names `training_sessions_team_id_fkey`, `training_sessions_room_id_fkey`, `training_session_facilitators_profile_id_fkey`, `training_session_guests_profile_id_fkey`, `training_session_attendees_profile_id_fkey` (used in PostgREST embeds later).

- [ ] **Step 1: Write the schema file**

```ts
// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
import { pgTable, foreignKey, pgPolicy, uuid, text, integer, timestamp, index, check, jsonb, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

import { profiles } from "./profiles"
import { rooms } from "./reservations"
import { attendanceStatus } from "./team-activities"
import { teams } from "./teams"

const OWN_TEAM_IDS = sql`(SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`
const OWN_TEAM_SESSION_IDS = sql`(SELECT id FROM training_sessions WHERE team_id IN ${OWN_TEAM_IDS})`

export const trainingSessions = pgTable("training_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	teamId: uuid("team_id").notNull(),
	topic: text().notNull(),
	description: text(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }).notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }).notNull(),
	roomId: uuid("room_id"),
	locationNote: text("location_note"),
	guestCapacity: integer("guest_capacity").default(0).notNull(),
	cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
	cancelledByProfileId: uuid("cancelled_by_profile_id"),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("training_sessions_team_starts_at_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops"), table.startsAt.asc().nullsLast().op("timestamptz_ops")),
	index("training_sessions_starts_at_idx").using("btree", table.startsAt.asc().nullsLast().op("timestamptz_ops")).where(sql`removed_at IS NULL`),
	check("training_sessions_time_check", sql`ends_at > starts_at`),
	check("training_sessions_capacity_check", sql`guest_capacity >= 0 AND guest_capacity <= 50`),
	check("training_sessions_topic_check", sql`char_length(topic) >= 1 AND char_length(topic) <= 200`),
	check("training_sessions_description_check", sql`description IS NULL OR char_length(description) <= 2000`),
	check("training_sessions_location_note_check", sql`location_note IS NULL OR char_length(location_note) <= 200`),
	foreignKey({ columns: [table.teamId], foreignColumns: [teams.id], name: "training_sessions_team_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.roomId], foreignColumns: [rooms.id], name: "training_sessions_room_id_fkey" }).onDelete("set null"),
	foreignKey({ columns: [table.cancelledByProfileId], foreignColumns: [profiles.id], name: "training_sessions_cancelled_by_profile_id_fkey" }).onDelete("set null"),
	foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "training_sessions_created_by_profile_id_fkey" }).onDelete("restrict"),
	foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "training_sessions_updated_by_profile_id_fkey" }).onDelete("restrict"),
	pgPolicy("Authenticated can view training sessions", { as: "permissive", for: "select", to: ["authenticated"], using: sql`removed_at IS NULL` }),
	pgPolicy("Team members can create training sessions", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`team_id IN ${OWN_TEAM_IDS}` }),
	pgPolicy("Team members can update training sessions", { as: "permissive", for: "update", to: ["authenticated"], using: sql`team_id IN ${OWN_TEAM_IDS}`, withCheck: sql`team_id IN ${OWN_TEAM_IDS}` }),
]).enableRLS()

export const trainingSessionFacilitators = pgTable("training_session_facilitators", {
	trainingSessionId: uuid("training_session_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
}, (table) => [
	primaryKey({ columns: [table.trainingSessionId, table.profileId], name: "training_session_facilitators_pkey" }),
	index("training_session_facilitators_profile_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({ columns: [table.trainingSessionId], foreignColumns: [trainingSessions.id], name: "training_session_facilitators_session_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.profileId], foreignColumns: [profiles.id], name: "training_session_facilitators_profile_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "training_session_facilitators_created_by_profile_id_fkey" }).onDelete("restrict"),
	pgPolicy("Authenticated can view facilitators", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Team members can add facilitators from their team", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS} AND profile_id IN (SELECT p.id FROM profiles p JOIN training_sessions s ON s.team_id = p.team_id WHERE s.id = training_session_id)` }),
	pgPolicy("Team members can remove facilitators", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
]).enableRLS()

export const trainingSessionPreparations = pgTable("training_session_preparations", {
	trainingSessionId: uuid("training_session_id").primaryKey().notNull(),
	contentJson: jsonb("content_json").notNull(),
	contentText: text("content_text").notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	foreignKey({ columns: [table.trainingSessionId], foreignColumns: [trainingSessions.id], name: "training_session_preparations_session_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "training_session_preparations_created_by_profile_id_fkey" }).onDelete("restrict"),
	foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "training_session_preparations_updated_by_profile_id_fkey" }).onDelete("restrict"),
	pgPolicy("Published preparation is public, drafts team only", { as: "permissive", for: "select", to: ["authenticated"], using: sql`published_at IS NOT NULL OR training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
	pgPolicy("Team members can create preparation", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
	pgPolicy("Team members can update preparation", { as: "permissive", for: "update", to: ["authenticated"], using: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}`, withCheck: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
]).enableRLS()

export const trainingSessionReflections = pgTable("training_session_reflections", {
	trainingSessionId: uuid("training_session_id").primaryKey().notNull(),
	contentJson: jsonb("content_json").notNull(),
	contentText: text("content_text").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	foreignKey({ columns: [table.trainingSessionId], foreignColumns: [trainingSessions.id], name: "training_session_reflections_session_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "training_session_reflections_created_by_profile_id_fkey" }).onDelete("restrict"),
	foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "training_session_reflections_updated_by_profile_id_fkey" }).onDelete("restrict"),
	pgPolicy("Team members can view reflection", { as: "permissive", for: "select", to: ["authenticated"], using: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
	pgPolicy("Team members can create reflection", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
	pgPolicy("Team members can update reflection", { as: "permissive", for: "update", to: ["authenticated"], using: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}`, withCheck: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
]).enableRLS()

export const trainingSessionAttendees = pgTable("training_session_attendees", {
	trainingSessionId: uuid("training_session_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	status: attendanceStatus().default("present").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	primaryKey({ columns: [table.trainingSessionId, table.profileId], name: "training_session_attendees_pkey" }),
	foreignKey({ columns: [table.trainingSessionId], foreignColumns: [trainingSessions.id], name: "training_session_attendees_session_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.profileId], foreignColumns: [profiles.id], name: "training_session_attendees_profile_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.createdByProfileId], foreignColumns: [profiles.id], name: "training_session_attendees_created_by_profile_id_fkey" }).onDelete("restrict"),
	foreignKey({ columns: [table.updatedByProfileId], foreignColumns: [profiles.id], name: "training_session_attendees_updated_by_profile_id_fkey" }).onDelete("restrict"),
	pgPolicy("Team members can view attendance", { as: "permissive", for: "select", to: ["authenticated"], using: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
	pgPolicy("Team members can record attendance of members and guests", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS} AND (profile_id IN (SELECT p.id FROM profiles p JOIN training_sessions s ON s.team_id = p.team_id WHERE s.id = training_session_id) OR profile_id IN (SELECT g.profile_id FROM training_session_guests g WHERE g.training_session_id = training_session_attendees.training_session_id))` }),
	pgPolicy("Team members can update attendance", { as: "permissive", for: "update", to: ["authenticated"], using: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}`, withCheck: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
	pgPolicy("Team members can delete attendance", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`training_session_id IN ${OWN_TEAM_SESSION_IDS}` }),
]).enableRLS()

export const trainingSessionGuests = pgTable("training_session_guests", {
	trainingSessionId: uuid("training_session_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	primaryKey({ columns: [table.trainingSessionId, table.profileId], name: "training_session_guests_pkey" }),
	index("training_session_guests_profile_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({ columns: [table.trainingSessionId], foreignColumns: [trainingSessions.id], name: "training_session_guests_session_id_fkey" }).onDelete("cascade"),
	foreignKey({ columns: [table.profileId], foreignColumns: [profiles.id], name: "training_session_guests_profile_id_fkey" }).onDelete("cascade"),
	// Writes only via join_training_session / leave_training_session (SECURITY DEFINER).
	pgPolicy("Authenticated can view guests", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
]).enableRLS()
```

Note: the attendees insert policy references `training_session_guests`, defined later in the file — Drizzle emits SQL text, so ordering in TS is irrelevant, but the **generated migration must create `training_session_guests` before the policy**. If `drizzle-kit` orders the policy before the table, tell the user and split the guests table into its own `pnpm db:migrate` run first.

- [ ] **Step 2: Ask the user to generate and apply**

STOP and ask the user: "Please run `pnpm db:migrate` and check the generated migration in `supabase/migrations/` for any `DROP` statements." Wait for confirmation. Then verify `src/lib/supabase/database.types.ts` contains `training_sessions`:

Run: `grep -c "training_session" src/lib/supabase/database.types.ts`
Expected: a number > 0

- [ ] **Step 3: Write failing RLS integration tests**

Create `tests/integration/training-sessions.int.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";

import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import { withRollback } from "@/tests/setup/tx";

interface Seeded {
  teamId: string;
  otherTeamId: string;
  owner: { profileId: string; authId: string };
  teammate: { profileId: string; authId: string };
  other: { profileId: string; authId: string };
  outsider: { profileId: string; authId: string };
  coach: { profileId: string; authId: string };
}

async function insertMember(
  client: PoolClient,
  name: string,
  teamId: string | null,
  role: "student" | "coach" = "student",
) {
  const auth = await insertAuthUser(client);
  const { rows: userRows } = await client.query(
    "update public.users set verified_work_email = google_email, verified_work_email_at = now() where auth_user_id = $1 returning id",
    [auth.id],
  );
  const { rows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ($1, $2, $3, $4, $5) returning id`,
    [name, `ts-${name.toLowerCase()}-${auth.id.slice(0, 8)}@studenti.czu.cz`, userRows[0].id, teamId, role],
  );
  return { profileId: rows[0].id as string, authId: auth.id };
}

async function seed(client: PoolClient): Promise<Seeded> {
  const { rows } = await client.query(
    "insert into public.teams (name) values ('TS Team A'), ('TS Team B') returning id",
  );
  const teamId = rows[0].id as string;
  const otherTeamId = rows[1].id as string;
  return {
    teamId,
    otherTeamId,
    owner: await insertMember(client, "Owner", teamId),
    teammate: await insertMember(client, "Teammate", teamId),
    other: await insertMember(client, "Other", otherTeamId),
    outsider: await insertMember(client, "Outsider", otherTeamId),
    coach: await insertMember(client, "Coach", null, "coach"),
  };
}

async function insertSession(
  client: PoolClient,
  teamId: string,
  profileId: string,
  opts: { capacity?: number; startsInHours?: number } = {},
): Promise<string> {
  const startsIn = opts.startsInHours ?? 24;
  const { rows } = await client.query(
    `insert into public.training_sessions
       (team_id, topic, starts_at, ends_at, guest_capacity, created_by_profile_id, updated_by_profile_id)
     values ($1, 'AI v projektech', now() + make_interval(hours => $2), now() + make_interval(hours => $2 + 4), $3, $4, $4)
     returning id`,
    [teamId, startsIn, opts.capacity ?? 2, profileId],
  );
  return rows[0].id as string;
}

describe("training_sessions RLS", () => {
  it("lets any authenticated user read a session, but only the team insert one", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);

      await asClaims(client, { sub: s.other.authId });
      const { rows } = await client.query("select id from public.training_sessions where id = $1", [id]);
      expect(rows).toHaveLength(1);

      await expect(insertSession(client, s.teamId, s.other.profileId)).rejects.toThrow(/row-level security/);
    });
  });

  it("does not let another team update a session", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);

      await asClaims(client, { sub: s.other.authId });
      const res = await client.query("update public.training_sessions set topic = 'x' where id = $1", [id]);
      expect(res.rowCount).toBe(0);
    });
  });

  it("hides draft preparation from other teams and shows it once published", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);
      await client.query(
        `insert into public.training_session_preparations
           (training_session_id, content_json, content_text, created_by_profile_id, updated_by_profile_id)
         values ($1, '{"type":"doc"}', 'Přečtěte si článek', $2, $2)`,
        [id, s.owner.profileId],
      );

      await asClaims(client, { sub: s.teammate.authId });
      expect((await client.query("select 1 from public.training_session_preparations where training_session_id = $1", [id])).rows).toHaveLength(1);

      await asClaims(client, { sub: s.other.authId });
      expect((await client.query("select 1 from public.training_session_preparations where training_session_id = $1", [id])).rows).toHaveLength(0);

      await asClaims(client, { sub: s.owner.authId });
      await client.query("update public.training_session_preparations set published_at = now() where training_session_id = $1", [id]);

      await asClaims(client, { sub: s.other.authId });
      expect((await client.query("select 1 from public.training_session_preparations where training_session_id = $1", [id])).rows).toHaveLength(1);
    });
  });

  it("keeps reflection and attendance team-only, including from coaches", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);
      await client.query(
        `insert into public.training_session_reflections
           (training_session_id, content_json, content_text, created_by_profile_id, updated_by_profile_id)
         values ($1, '{"type":"doc"}', 'Šlo to dobře', $2, $2)`,
        [id, s.owner.profileId],
      );
      await client.query(
        `insert into public.training_session_attendees
           (training_session_id, profile_id, status, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, 'present', $2, $2)`,
        [id, s.teammate.profileId],
      );

      for (const viewer of [s.other, s.coach]) {
        await asClaims(client, { sub: viewer.authId });
        expect((await client.query("select 1 from public.training_session_reflections where training_session_id = $1", [id])).rows).toHaveLength(0);
        expect((await client.query("select 1 from public.training_session_attendees where training_session_id = $1", [id])).rows).toHaveLength(0);
      }
    });
  });

  it("rejects a facilitator from another team", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);
      await expect(
        client.query(
          "insert into public.training_session_facilitators (training_session_id, profile_id, created_by_profile_id) values ($1, $2, $3)",
          [id, s.other.profileId, s.owner.profileId],
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("does not allow direct inserts into guests", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);
      await asClaims(client, { sub: s.other.authId });
      await expect(
        client.query("insert into public.training_session_guests (training_session_id, profile_id) values ($1, $2)", [id, s.other.profileId]),
      ).rejects.toThrow(/row-level security/);
    });
  });
});

export { seed, insertSession };
```

- [ ] **Step 4: Run the integration tests**

Run: `pnpm test:integration -- training-sessions`
Expected: PASS (6 tests). If setup fails with `Migration failed: <file>`, add the missing Supabase-managed object to `tests/setup/bootstrap.sql` (never edit migrations).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm typecheck`
```bash
git add db/schema/training-sessions.ts supabase/migrations src/lib/supabase/database.types.ts db/sql tests/integration/training-sessions.int.test.ts
git commit -m "feat(training-sessions): add schema with RLS"
```

---

### Task 2: Shared constants and types

**Files:**
- Create: `src/lib/training-sessions/constants.ts`, `src/lib/training-sessions/types.ts`
- Modify: `src/lib/feature-access.ts`

**Interfaces:**
- Produces: constants below; `TrainingSession`, `TrainingSessionListItem`, `SessionTiming`, `SESSION_LIST_SELECT`, `SESSION_DETAIL_SELECT`; feature key `"trainingSessions"`.

- [ ] **Step 1: Add the feature key**

In `src/lib/feature-access.ts` add to `BETA_FEATURES`:

```ts
  trainingSessions: ["B"],
```

- [ ] **Step 2: Create `constants.ts`**

```ts
export const TS_LIMITS = {
  topicMax: 200,
  descriptionMax: 2_000,
  locationNoteMax: 200,
  guestCapacityMax: 50,
  facilitatorsMax: 20,
  attendeesMax: 100,
  maxDurationMs: 12 * 60 * 60 * 1000,
  slotSuggestions: 6,
  slotHorizonDays: 120,
} as const

export const TS_REALTIME_TOPIC = "community:training_sessions:feed"

export const TS_REALTIME_EVENTS = {
  guestJoined: "guest_joined",
  guestLeft: "guest_left",
  sessionUpdated: "session_updated",
} as const

export const TS_GUEST_ERROR_CODES = [
  "not_found",
  "cancelled",
  "already_started",
  "own_team",
  "capacity_full",
] as const

export type TsGuestErrorCode = (typeof TS_GUEST_ERROR_CODES)[number]

export const TS_GUEST_ERROR_MESSAGES: Record<TsGuestErrorCode, string> = {
  not_found: "TS nebylo nalezeno",
  cancelled: "TS bylo zrušeno",
  already_started: "TS už začalo, přihlášení je uzavřené",
  own_team: "Na TS svého týmu se jako host nepřihlašuje",
  capacity_full: "Volná místa už jsou obsazená",
}

export const TS_ROUTES = {
  root: "/ts",
  overview: "/ts/prehled",
  discover: "/ts/objevovat",
  create: "/ts/nova",
  detail: (id: string) => `/ts/${id}`,
  edit: (id: string) => `/ts/${id}/upravit`,
} as const

export const TS_DISCOVER_FILTERS = ["nadchazejici", "volna-mista", "muj-tym", "prihlasene", "probehle"] as const
export type TsDiscoverFilter = (typeof TS_DISCOVER_FILTERS)[number]

export const TS_DISCOVER_FILTER_LABELS: Record<TsDiscoverFilter, string> = {
  nadchazejici: "Nadcházející",
  "volna-mista": "Volná místa",
  "muj-tym": "Můj tým",
  prihlasene: "Přihlášené",
  probehle: "Proběhlé",
}

export const TS_DETAIL_TABS = ["prehled", "priprava", "dochazka", "reflexe"] as const
export type TsDetailTab = (typeof TS_DETAIL_TABS)[number]

export const PRAGUE_TIME_ZONE = "Europe/Prague"
```

- [ ] **Step 3: Create `types.ts`**

```ts
import type { Tables } from "@/lib/supabase/tables"

export type TrainingSession = Tables<"training_sessions">
export type TrainingSessionPreparation = Tables<"training_session_preparations">
export type TrainingSessionReflection = Tables<"training_session_reflections">
export type TrainingSessionAttendee = Tables<"training_session_attendees">
export type TeamRow = Tables<"teams">
export type RoomRow = Tables<"rooms">
export type ProfileRow = Tables<"profiles">

export type TsStatus = "upcoming" | "ongoing" | "past" | "cancelled"

/** Minimal timing shape used by pure helpers (status, conflicts, grouping). */
export interface SessionTiming {
  id: string
  startsAt: string
  endsAt: string
  cancelledAt: string | null
}

export interface TsPersonSummary {
  id: string
  name: string | null
  picture: string | null
}

export interface TrainingSessionListItem
  extends Pick<
    TrainingSession,
    "id" | "team_id" | "topic" | "description" | "starts_at" | "ends_at" | "room_id" | "location_note" | "guest_capacity" | "cancelled_at"
  > {
  team: Pick<TeamRow, "id" | "name" | "color" | "onboardingYear"> | null
  room: Pick<RoomRow, "id" | "code" | "name"> | null
  facilitators: { profile: TsPersonSummary | null }[]
  guests: { profile_id: string; joined_at: string; profile: TsPersonSummary | null }[]
  preparation: Pick<TrainingSessionPreparation, "published_at"> | null
}

export interface TrainingSessionDetail extends TrainingSessionListItem {
  preparation: Pick<TrainingSessionPreparation, "published_at" | "content_json" | "updated_at"> | null
}

export const SESSION_LIST_SELECT =
  "id, team_id, topic, description, starts_at, ends_at, room_id, location_note, guest_capacity, cancelled_at, " +
  "team:teams!training_sessions_team_id_fkey(id, name, color, onboardingYear), " +
  "room:rooms!training_sessions_room_id_fkey(id, code, name), " +
  "facilitators:training_session_facilitators(profile:profiles!training_session_facilitators_profile_id_fkey(id, name, picture)), " +
  "guests:training_session_guests(profile_id, joined_at, profile:profiles!training_session_guests_profile_id_fkey(id, name, picture)), " +
  "preparation:training_session_preparations(published_at)"

export const SESSION_DETAIL_SELECT = SESSION_LIST_SELECT.replace(
  "preparation:training_session_preparations(published_at)",
  "preparation:training_session_preparations(published_at, content_json, updated_at)",
)

export function toTiming(session: Pick<TrainingSession, "id" | "starts_at" | "ends_at" | "cancelled_at">): SessionTiming {
  return { id: session.id, startsAt: session.starts_at, endsAt: session.ends_at, cancelledAt: session.cancelled_at }
}
```

Check `src/lib/supabase/tables.ts` exists (used by `src/lib/tymovy-denik/types.ts`); if the export name differs, match it.

- [ ] **Step 4: Typecheck and commit**

Run: `pnpm typecheck` — Expected: no errors.
```bash
git add src/lib/training-sessions/constants.ts src/lib/training-sessions/types.ts src/lib/feature-access.ts
git commit -m "feat(training-sessions): add constants, types and feature gate"
```

---

### Task 3: DB functions — guest RPCs, search, triggers, realtime

**Files:**
- Create: custom migration via `pnpm db:generate:custom`
- Modify: `tests/integration/training-sessions.int.test.ts`, possibly `tests/setup/bootstrap.sql`

**Interfaces:**
- Produces SQL functions: `public.join_training_session(p_session_id uuid) returns integer`, `public.leave_training_session(p_session_id uuid) returns integer`, `public.search_training_sessions(p_query text) returns setof uuid`. Errors raise `MESSAGE` = one of `TS_GUEST_ERROR_CODES`.

- [ ] **Step 1: Write failing RPC tests** (append to the integration file, reusing `seed`/`insertSession`)

```ts
async function join(client: PoolClient, sessionId: string): Promise<number> {
  const { rows } = await client.query("select public.join_training_session($1) as n", [sessionId]);
  return rows[0].n as number;
}

describe("join_training_session / leave_training_session", () => {
  it("lets a member of another team join and returns the guest count", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId, { capacity: 2 });
      await asClaims(client, { sub: s.other.authId });
      expect(await join(client, id)).toBe(1);
      expect(await join(client, id)).toBe(1); // idempotent
    });
  });

  it("enforces capacity", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId, { capacity: 1 });
      await asClaims(client, { sub: s.other.authId });
      await join(client, id);
      await asClaims(client, { sub: s.outsider.authId });
      await expect(join(client, id)).rejects.toThrow("capacity_full");
    });
  });

  it("rejects own team, started and cancelled sessions", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const future = await insertSession(client, s.teamId, s.owner.profileId);
      const started = await insertSession(client, s.teamId, s.owner.profileId, { startsInHours: -1 });
      const cancelled = await insertSession(client, s.teamId, s.owner.profileId);
      await client.query("update public.training_sessions set cancelled_at = now() where id = $1", [cancelled]);

      await asClaims(client, { sub: s.teammate.authId });
      await expect(join(client, future)).rejects.toThrow("own_team");

      await asClaims(client, { sub: s.other.authId });
      await expect(join(client, started)).rejects.toThrow("already_started");
      await expect(join(client, cancelled)).rejects.toThrow("cancelled");
    });
  });

  it("lets a coach without a team join and leave", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);
      await asClaims(client, { sub: s.coach.authId });
      expect(await join(client, id)).toBe(1);
      const { rows } = await client.query("select public.leave_training_session($1) as n", [id]);
      expect(rows[0].n).toBe(0);
    });
  });

  it("returns ids from search only for published preparation", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);
      await client.query(
        `insert into public.training_session_preparations
           (training_session_id, content_json, content_text, created_by_profile_id, updated_by_profile_id)
         values ($1, '{"type":"doc"}', 'vyjednávání se zákazníkem', $2, $2)`,
        [id, s.owner.profileId],
      );
      await asClaims(client, { sub: s.other.authId });
      const search = async (q: string) =>
        (await client.query("select * from public.search_training_sessions($1) as id", [q])).rows.map((r) => r.id);
      expect(await search("vyjednávání")).toEqual([]);
      expect(await search("AI v")).toEqual([id]); // topic match

      await asClaims(client, { sub: s.owner.authId });
      await client.query("update public.training_session_preparations set published_at = now() where training_session_id = $1", [id]);
      await asClaims(client, { sub: s.other.authId });
      expect(await search("vyjednávání")).toEqual([id]);
      expect(await search("100%")).toEqual([]); // wildcard escaped
    });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test:integration -- training-sessions`
Expected: FAIL — `function public.join_training_session(uuid) does not exist`.

- [ ] **Step 3: Generate an empty custom migration**

Run: `pnpm db:generate:custom`
Then fill the new file with:

```sql
-- Custom SQL migration file, put your code below! --

-- Training sessions: guest RPCs, search, updated_at triggers, realtime broadcast.

create or replace function public.join_training_session(p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_team uuid;
  v_session record;
  v_count integer;
begin
  if v_profile is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select team_id into v_team from public.profiles where id = v_profile and access_removed_at is null;
  if not found then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Row lock serializes concurrent joins for the same session (last-seat race).
  select id, team_id, starts_at, cancelled_at, guest_capacity into v_session
  from public.training_sessions
  where id = p_session_id and removed_at is null
  for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_session.cancelled_at is not null then raise exception 'cancelled' using errcode = 'P0001'; end if;
  if v_session.starts_at <= now() then raise exception 'already_started' using errcode = 'P0001'; end if;
  if v_team is not distinct from v_session.team_id then raise exception 'own_team' using errcode = 'P0001'; end if;

  select count(*) into v_count from public.training_session_guests where training_session_id = p_session_id;
  if exists (select 1 from public.training_session_guests where training_session_id = p_session_id and profile_id = v_profile) then
    return v_count;
  end if;
  if v_count >= v_session.guest_capacity then raise exception 'capacity_full' using errcode = 'P0001'; end if;

  insert into public.training_session_guests (training_session_id, profile_id) values (p_session_id, v_profile);
  return v_count + 1;
end;
$$;

create or replace function public.leave_training_session(p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_session record;
  v_count integer;
begin
  if v_profile is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select id, starts_at into v_session from public.training_sessions
  where id = p_session_id and removed_at is null for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_session.starts_at <= now() then raise exception 'already_started' using errcode = 'P0001'; end if;
  delete from public.training_session_guests where training_session_id = p_session_id and profile_id = v_profile;
  select count(*) into v_count from public.training_session_guests where training_session_id = p_session_id;
  return v_count;
end;
$$;

revoke all on function public.join_training_session(uuid) from public, anon;
revoke all on function public.leave_training_session(uuid) from public, anon;
grant execute on function public.join_training_session(uuid) to authenticated;
grant execute on function public.leave_training_session(uuid) to authenticated;

create or replace function public.search_training_sessions(p_query text)
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id
  from public.training_sessions s
  left join public.training_session_preparations p
    on p.training_session_id = s.id and p.published_at is not null
  where s.removed_at is null
    and (
      s.topic ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or s.description ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or p.content_text ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    );
$$;

grant execute on function public.search_training_sessions(text) to authenticated;

create trigger training_sessions_updated_at_trigger before update on public.training_sessions
  for each row execute function public.handle_updated_at();
create trigger training_session_preparations_updated_at_trigger before update on public.training_session_preparations
  for each row execute function public.handle_updated_at();
create trigger training_session_reflections_updated_at_trigger before update on public.training_session_reflections
  for each row execute function public.handle_updated_at();
create trigger training_session_attendees_updated_at_trigger before update on public.training_session_attendees
  for each row execute function public.handle_updated_at();

create or replace function public.broadcast_training_session_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_profile_id uuid;
  v_event text;
  v_count integer;
begin
  if tg_table_name = 'training_session_guests' then
    if tg_op = 'DELETE' then
      v_session_id := old.training_session_id; v_profile_id := old.profile_id; v_event := 'guest_left';
    else
      v_session_id := new.training_session_id; v_profile_id := new.profile_id; v_event := 'guest_joined';
    end if;
  else
    v_session_id := new.id; v_event := 'session_updated';
  end if;

  select count(*) into v_count from public.training_session_guests where training_session_id = v_session_id;
  perform realtime.send(
    jsonb_build_object('session_id', v_session_id, 'guest_count', v_count, 'profile_id', v_profile_id),
    v_event,
    'community:training_sessions:feed',
    true
  );
  return null;
end;
$$;

create trigger training_session_guests_broadcast_trigger
  after insert or delete on public.training_session_guests
  for each row execute function public.broadcast_training_session_change();

create trigger training_sessions_broadcast_trigger
  after update on public.training_sessions
  for each row
  when (
    old.starts_at is distinct from new.starts_at
    or old.ends_at is distinct from new.ends_at
    or old.room_id is distinct from new.room_id
    or old.location_note is distinct from new.location_note
    or old.guest_capacity is distinct from new.guest_capacity
    or old.cancelled_at is distinct from new.cancelled_at
    or old.topic is distinct from new.topic
    or old.removed_at is distinct from new.removed_at
  )
  execute function public.broadcast_training_session_change();

drop policy if exists "Authenticated can receive training session feed" on realtime.messages;
create policy "Authenticated can receive training session feed" on realtime.messages
for select
to authenticated
using ((select realtime.topic()) = 'community:training_sessions:feed');
```

- [ ] **Step 4: Ask the user to apply it**

STOP and ask the user to run `pnpm db:up` then `pnpm db:export`, then run `pnpm db:generate` once (should report "No schema changes"). Commit the `meta/` changes it produces.

- [ ] **Step 5: Run integration tests**

Run: `pnpm test:integration -- training-sessions`
Expected: PASS (11 tests). `realtime.send` and `realtime.topic` stubs already exist in `tests/setup/bootstrap.sql`; if `handle_updated_at` or something else is missing there, add the minimal stub.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations db/sql tests/integration/training-sessions.int.test.ts tests/setup/bootstrap.sql
git commit -m "feat(training-sessions): add guest RPCs, search, triggers and realtime feed"
```

---

### Task 4: Pure logic — status, conflicts, Prague formatting, slot prefill

**Files:**
- Create: `src/lib/training-sessions/status.ts`, `conflicts.ts`, `format.ts`, `slots.ts` and a `.test.ts` next to each

**Interfaces:**
- Consumes: `SessionTiming`, `TsStatus` (Task 2), `PRAGUE_TIME_ZONE`, `TS_LIMITS`; `pragueLocalToUtcISO(date, time)` from `@/lib/reservations/utils`.
- Produces:
  - `getSessionStatus(timing: Pick<SessionTiming,"startsAt"|"endsAt"|"cancelledAt">, now: Date): TsStatus`
  - `findConflicts<T extends SessionTiming>(candidate: SessionTiming, commitments: T[]): SessionConflict<T>[]` where `interface SessionConflict<T> { commitment: T; overlapStart: string; overlapEnd: string }`
  - `pragueDateKey(value: string | Date): string` (YYYY-MM-DD), `formatDayHeading(iso: string): string`, `formatTimeRange(startIso: string, endIso: string): string`, `groupByPragueDay<T>(items: T[], getStart: (item: T) => string): DayGroup<T>[]` where `interface DayGroup<T> { dateKey: string; heading: string; items: T[] }`
  - `getUpcomingTeamSlots(input: UpcomingSlotsInput): UpcomingSlot[]` with
    `interface ScheduleSource { dayOfWeek: number; startTime: string; endTime: string; validFrom: string; validUntil: string | null; roomId: string }`,
    `interface BreakRange { startDate: string; endDate: string }`,
    `interface UpcomingSlotsInput { schedules: ScheduleSource[]; breaks: BreakRange[]; takenDateKeys: string[]; now: Date; limit?: number }`,
    `interface UpcomingSlot { dateKey: string; startsAt: string; endsAt: string; roomId: string }`

- [ ] **Step 1: Write failing tests**

`src/lib/training-sessions/status.test.ts`:
```ts
import { getSessionStatus } from "./status"

const base = { startsAt: "2026-10-06T06:00:00.000Z", endsAt: "2026-10-06T10:00:00.000Z", cancelledAt: null }

describe("getSessionStatus", () => {
  it("is upcoming before start", () => {
    expect(getSessionStatus(base, new Date("2026-10-06T05:59:00Z"))).toBe("upcoming")
  })
  it("is ongoing between start and end", () => {
    expect(getSessionStatus(base, new Date("2026-10-06T06:00:00Z"))).toBe("ongoing")
  })
  it("is past at end", () => {
    expect(getSessionStatus(base, new Date("2026-10-06T10:00:00Z"))).toBe("past")
  })
  it("is cancelled regardless of time", () => {
    expect(getSessionStatus({ ...base, cancelledAt: "2026-10-01T00:00:00Z" }, new Date("2026-10-06T07:00:00Z"))).toBe("cancelled")
  })
})
```

`src/lib/training-sessions/conflicts.test.ts`:
```ts
import { findConflicts } from "./conflicts"

const mine = { id: "a", startsAt: "2026-10-07T06:00:00Z", endsAt: "2026-10-07T10:00:00Z", cancelledAt: null }

describe("findConflicts", () => {
  it("returns the overlapping interval", () => {
    const candidate = { id: "b", startsAt: "2026-10-07T08:00:00Z", endsAt: "2026-10-07T12:00:00Z", cancelledAt: null }
    expect(findConflicts(candidate, [mine])).toEqual([
      { commitment: mine, overlapStart: "2026-10-07T08:00:00Z", overlapEnd: "2026-10-07T10:00:00Z" },
    ])
  })
  it("treats touching intervals as no conflict", () => {
    const candidate = { id: "b", startsAt: "2026-10-07T10:00:00Z", endsAt: "2026-10-07T12:00:00Z", cancelledAt: null }
    expect(findConflicts(candidate, [mine])).toEqual([])
  })
  it("ignores the same session and cancelled commitments", () => {
    expect(findConflicts(mine, [mine])).toEqual([])
    const cancelled = { ...mine, id: "c", cancelledAt: "2026-10-01T00:00:00Z" }
    const candidate = { id: "b", startsAt: "2026-10-07T08:00:00Z", endsAt: "2026-10-07T09:00:00Z", cancelledAt: null }
    expect(findConflicts(candidate, [cancelled])).toEqual([])
  })
  it("returns nothing for a cancelled candidate", () => {
    const candidate = { id: "b", startsAt: "2026-10-07T08:00:00Z", endsAt: "2026-10-07T09:00:00Z", cancelledAt: "2026-10-01T00:00:00Z" }
    expect(findConflicts(candidate, [mine])).toEqual([])
  })
})
```

`src/lib/training-sessions/format.test.ts`:
```ts
import { formatDayHeading, formatTimeRange, groupByPragueDay, pragueDateKey } from "./format"

describe("Prague formatting", () => {
  it("keys by Prague date, not UTC date", () => {
    expect(pragueDateKey("2026-10-06T22:30:00Z")).toBe("2026-10-07")
  })
  it("formats a capitalized day heading", () => {
    expect(formatDayHeading("2026-10-06T06:00:00Z")).toBe("Úterý 6. října")
  })
  it("formats a time range in CEST and CET", () => {
    expect(formatTimeRange("2026-10-06T06:00:00Z", "2026-10-06T10:00:00Z")).toBe("8:00–12:00")
    expect(formatTimeRange("2026-10-27T07:00:00Z", "2026-10-27T11:00:00Z")).toBe("8:00–12:00")
  })
  it("groups items by Prague day in input order", () => {
    const items = [
      { id: 1, s: "2026-10-06T06:00:00Z" },
      { id: 2, s: "2026-10-06T11:00:00Z" },
      { id: 3, s: "2026-10-07T06:00:00Z" },
    ]
    const groups = groupByPragueDay(items, (i) => i.s)
    expect(groups.map((g) => [g.dateKey, g.items.map((i) => i.id)])).toEqual([
      ["2026-10-06", [1, 2]],
      ["2026-10-07", [3]],
    ])
  })
})
```

`src/lib/training-sessions/slots.test.ts`:
```ts
import { getUpcomingTeamSlots } from "./slots"

const tuesday = { dayOfWeek: 2, startTime: "08:00:00", endTime: "12:00:00", validFrom: "2026-09-01", validUntil: "2026-12-31", roomId: "room-1" }

describe("getUpcomingTeamSlots", () => {
  const now = new Date("2026-10-02T08:00:00Z") // Friday

  it("returns the next weekly slots in UTC for Prague local time", () => {
    const slots = getUpcomingTeamSlots({ schedules: [tuesday], breaks: [], takenDateKeys: [], now, limit: 2 })
    expect(slots).toEqual([
      { dateKey: "2026-10-06", startsAt: "2026-10-06T06:00:00.000Z", endsAt: "2026-10-06T10:00:00.000Z", roomId: "room-1" },
      { dateKey: "2026-10-13", startsAt: "2026-10-13T06:00:00.000Z", endsAt: "2026-10-13T10:00:00.000Z", roomId: "room-1" },
    ])
  })
  it("handles the DST switch (CET after 25 Oct)", () => {
    const slots = getUpcomingTeamSlots({ schedules: [tuesday], breaks: [], takenDateKeys: [], now: new Date("2026-10-21T08:00:00Z"), limit: 1 })
    expect(slots[0].startsAt).toBe("2026-10-27T07:00:00.000Z")
  })
  it("skips breaks and dates that already have a TS", () => {
    const slots = getUpcomingTeamSlots({
      schedules: [tuesday],
      breaks: [{ startDate: "2026-10-12", endDate: "2026-10-16" }],
      takenDateKeys: ["2026-10-06"],
      now,
      limit: 1,
    })
    expect(slots[0].dateKey).toBe("2026-10-20")
  })
  it("respects validUntil and skips slots that already started today", () => {
    const slots = getUpcomingTeamSlots({
      schedules: [{ ...tuesday, validUntil: "2026-10-06" }],
      breaks: [],
      takenDateKeys: [],
      now: new Date("2026-10-06T07:00:00Z"),
    })
    expect(slots).toEqual([])
  })
  it("merges and sorts multiple schedules", () => {
    const thursday = { ...tuesday, dayOfWeek: 4, startTime: "13:00:00", endTime: "17:00:00", roomId: "room-2" }
    const slots = getUpcomingTeamSlots({ schedules: [thursday, tuesday], breaks: [], takenDateKeys: [], now, limit: 2 })
    expect(slots.map((s) => s.dateKey)).toEqual(["2026-10-06", "2026-10-08"])
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test:unit -- training-sessions`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`status.ts`:
```ts
import type { SessionTiming, TsStatus } from "./types"

export function getSessionStatus(timing: Pick<SessionTiming, "startsAt" | "endsAt" | "cancelledAt">, now: Date): TsStatus {
  if (timing.cancelledAt) return "cancelled"
  const nowMs = now.getTime()
  if (nowMs >= new Date(timing.endsAt).getTime()) return "past"
  if (nowMs >= new Date(timing.startsAt).getTime()) return "ongoing"
  return "upcoming"
}
```

`conflicts.ts`:
```ts
import type { SessionTiming } from "./types"

export interface SessionConflict<T extends SessionTiming> {
  commitment: T
  overlapStart: string
  overlapEnd: string
}

export function findConflicts<T extends SessionTiming>(candidate: SessionTiming, commitments: T[]): SessionConflict<T>[] {
  if (candidate.cancelledAt) return []
  const start = new Date(candidate.startsAt).getTime()
  const end = new Date(candidate.endsAt).getTime()
  return commitments.flatMap((commitment) => {
    if (commitment.id === candidate.id || commitment.cancelledAt) return []
    const cStart = new Date(commitment.startsAt).getTime()
    const cEnd = new Date(commitment.endsAt).getTime()
    if (!(start < cEnd && end > cStart)) return []
    return [{
      commitment,
      overlapStart: start > cStart ? candidate.startsAt : commitment.startsAt,
      overlapEnd: end < cEnd ? candidate.endsAt : commitment.endsAt,
    }]
  })
}
```

`format.ts`:
```ts
import { PRAGUE_TIME_ZONE } from "./constants"

const DATE_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: PRAGUE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
const DAY_HEADING_FORMAT = new Intl.DateTimeFormat("cs-CZ", { timeZone: PRAGUE_TIME_ZONE, weekday: "long", day: "numeric", month: "long" })
const TIME_FORMAT = new Intl.DateTimeFormat("cs-CZ", { timeZone: PRAGUE_TIME_ZONE, hour: "numeric", minute: "2-digit" })

export interface DayGroup<T> {
  dateKey: string
  heading: string
  items: T[]
}

export function pragueDateKey(value: string | Date): string {
  return DATE_KEY_FORMAT.format(typeof value === "string" ? new Date(value) : value)
}

export function formatDayHeading(iso: string): string {
  const text = DAY_HEADING_FORMAT.format(new Date(iso))
  return text.charAt(0).toLocaleUpperCase("cs-CZ") + text.slice(1)
}

export function formatTime(iso: string): string {
  return TIME_FORMAT.format(new Date(iso))
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)}–${formatTime(endIso)}`
}

export function groupByPragueDay<T>(items: T[], getStart: (item: T) => string): DayGroup<T>[] {
  const groups: DayGroup<T>[] = []
  for (const item of items) {
    const start = getStart(item)
    const dateKey = pragueDateKey(start)
    const last = groups.at(-1)
    if (last?.dateKey === dateKey) last.items.push(item)
    else groups.push({ dateKey, heading: formatDayHeading(start), items: [item] })
  }
  return groups
}
```

`slots.ts`:
```ts
import { pragueLocalToUtcISO } from "@/lib/reservations/utils"

import { TS_LIMITS } from "./constants"
import { pragueDateKey } from "./format"

export interface ScheduleSource {
  dayOfWeek: number
  startTime: string
  endTime: string
  validFrom: string
  validUntil: string | null
  roomId: string
}

export interface BreakRange {
  startDate: string
  endDate: string
}

export interface UpcomingSlotsInput {
  schedules: ScheduleSource[]
  breaks: BreakRange[]
  takenDateKeys: string[]
  now: Date
  limit?: number
}

export interface UpcomingSlot {
  dateKey: string
  startsAt: string
  endsAt: string
  roomId: string
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function addDaysToKey(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10)
}

function weekdayOfKey(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay()
}

export function getUpcomingTeamSlots({ schedules, breaks, takenDateKeys, now, limit = TS_LIMITS.slotSuggestions }: UpcomingSlotsInput): UpcomingSlot[] {
  const taken = new Set(takenDateKeys)
  const today = pragueDateKey(now)
  const slots: UpcomingSlot[] = []

  for (let offset = 0; offset <= TS_LIMITS.slotHorizonDays; offset += 1) {
    const dateKey = addDaysToKey(today, offset)
    if (taken.has(dateKey)) continue
    if (breaks.some((b) => dateKey >= b.startDate && dateKey <= b.endDate)) continue
    const weekday = weekdayOfKey(dateKey)

    for (const schedule of schedules) {
      if (schedule.dayOfWeek !== weekday) continue
      if (dateKey < schedule.validFrom) continue
      if (schedule.validUntil && dateKey > schedule.validUntil) continue
      const startsAt = pragueLocalToUtcISO(dateKey, schedule.startTime)
      if (new Date(startsAt).getTime() <= now.getTime()) continue
      slots.push({ dateKey, startsAt, endsAt: pragueLocalToUtcISO(dateKey, schedule.endTime), roomId: schedule.roomId })
    }
  }

  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, limit)
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:unit -- training-sessions`
Expected: PASS. If the `cs-CZ` heading differs in the runtime ICU (e.g. no capital), fix the implementation, not the expected string.

- [ ] **Step 5: Commit**

```bash
git add src/lib/training-sessions
git commit -m "feat(training-sessions): add status, conflict, formatting and slot helpers"
```

---

### Task 5: Validation schemas and queries

**Files:**
- Create: `src/lib/training-sessions/validation.ts` (+ `validation.test.ts`), `src/lib/training-sessions/queries.ts`

**Interfaces:**
- Produces:
  - `sessionInputSchema` (zod) → `SessionInput { topic; description: string|null; startsAt; endsAt; roomId: string|null; locationNote: string|null; guestCapacity: number; facilitatorIds: string[] }`
  - `sessionPatchSchema` = discriminated union on `kind`: `{ kind: "update" } & SessionInput` | `{ kind: "cancel" }` | `{ kind: "restore" }`
  - `preparationInputSchema` → `{ contentJson: Record<string, unknown>; action: "draft" | "publish" | "unpublish" }`
  - `reflectionInputSchema` → `{ contentJson: Record<string, unknown> }`
  - `attendanceInputSchema` → `{ attendees: { profileId: string; status: AttendanceStatus }[] }`
  - `isCapacityBelowGuests(newCapacity: number, guestCount: number): boolean`
  - queries: `listSessions(supabase, filter: ListSessionsFilter): Promise<TrainingSessionListItem[]>`, `getSessionDetail(supabase, id): Promise<TrainingSessionDetail | null>`, `getReflection(supabase, id)`, `listAttendance(supabase, id)`, `listTeamSlotSources(supabase, teamId)`, `listRooms(supabase)`, `searchSessionIds(supabase, q)`; `interface ListSessionsFilter { from?: string; to?: string; teamId?: string; ids?: string[]; order?: "asc" | "desc"; limit?: number }`

- [ ] **Step 1: Write failing validation tests**

```ts
import { isCapacityBelowGuests, preparationInputSchema, sessionInputSchema } from "./validation"

const valid = {
  topic: "AI v projektech",
  description: "",
  startsAt: "2026-10-06T06:00:00.000Z",
  endsAt: "2026-10-06T10:00:00.000Z",
  roomId: null,
  locationNote: " ",
  guestCapacity: 5,
  facilitatorIds: [],
}

describe("sessionInputSchema", () => {
  it("accepts a valid session and normalizes empty text to null", () => {
    const parsed = sessionInputSchema.parse(valid)
    expect(parsed.description).toBeNull()
    expect(parsed.locationNote).toBeNull()
  })
  it("rejects end before start", () => {
    expect(sessionInputSchema.safeParse({ ...valid, endsAt: valid.startsAt }).success).toBe(false)
  })
  it("rejects sessions longer than 12 hours", () => {
    expect(sessionInputSchema.safeParse({ ...valid, endsAt: "2026-10-06T18:01:00.000Z" }).success).toBe(false)
  })
  it("rejects capacity above 50 and negative", () => {
    expect(sessionInputSchema.safeParse({ ...valid, guestCapacity: 51 }).success).toBe(false)
    expect(sessionInputSchema.safeParse({ ...valid, guestCapacity: -1 }).success).toBe(false)
  })
})

describe("preparationInputSchema", () => {
  it("requires a known action", () => {
    expect(preparationInputSchema.safeParse({ contentJson: { type: "doc" }, action: "publish" }).success).toBe(true)
    expect(preparationInputSchema.safeParse({ contentJson: { type: "doc" }, action: "x" }).success).toBe(false)
  })
})

describe("isCapacityBelowGuests", () => {
  it("is true only when the new capacity cannot hold current guests", () => {
    expect(isCapacityBelowGuests(2, 3)).toBe(true)
    expect(isCapacityBelowGuests(3, 3)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test:unit -- validation` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `validation.ts`**

```ts
import { z } from "zod"

import { TS_LIMITS } from "./constants"

const nullableText = (max: number) =>
  z.string().trim().max(max).nullish().transform((value) => (value ? value : null))

const sessionFields = z.object({
  topic: z.string().trim().min(1).max(TS_LIMITS.topicMax),
  description: nullableText(TS_LIMITS.descriptionMax),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  roomId: z.uuid().nullable(),
  locationNote: nullableText(TS_LIMITS.locationNoteMax),
  guestCapacity: z.number().int().min(0).max(TS_LIMITS.guestCapacityMax),
  facilitatorIds: z.array(z.uuid()).max(TS_LIMITS.facilitatorsMax),
})

function hasValidDuration(value: { startsAt: string; endsAt: string }): boolean {
  const duration = new Date(value.endsAt).getTime() - new Date(value.startsAt).getTime()
  return duration > 0 && duration <= TS_LIMITS.maxDurationMs
}

const DURATION_ERROR = { message: "Konec musí být po začátku a TS může trvat nejvýše 12 hodin", path: ["endsAt"] }

export const sessionInputSchema = sessionFields.refine(hasValidDuration, DURATION_ERROR)
export type SessionInput = z.infer<typeof sessionInputSchema>

export const sessionPatchSchema = z.discriminatedUnion("kind", [
  sessionFields.extend({ kind: z.literal("update") }),
  z.object({ kind: z.literal("cancel") }),
  z.object({ kind: z.literal("restore") }),
]).refine((value) => value.kind !== "update" || hasValidDuration(value), DURATION_ERROR)
export type SessionPatch = z.infer<typeof sessionPatchSchema>

const contentJsonSchema = z.record(z.string(), z.unknown())

export const preparationInputSchema = z.object({
  contentJson: contentJsonSchema,
  action: z.enum(["draft", "publish", "unpublish"]),
})

export const reflectionInputSchema = z.object({ contentJson: contentJsonSchema })

export const attendanceInputSchema = z.object({
  attendees: z
    .array(z.object({ profileId: z.uuid(), status: z.enum(["present", "absent", "excused", "late"]) }))
    .max(TS_LIMITS.attendeesMax),
})

export function isCapacityBelowGuests(newCapacity: number, guestCount: number): boolean {
  return newCapacity < guestCount
}
```

- [ ] **Step 4: Implement `queries.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

import { SESSION_DETAIL_SELECT, SESSION_LIST_SELECT, type TrainingSessionDetail, type TrainingSessionListItem } from "./types"
import type { BreakRange, ScheduleSource } from "./slots"

export interface ListSessionsFilter {
  from?: string
  to?: string
  teamId?: string
  ids?: string[]
  order?: "asc" | "desc"
  limit?: number
}

const DEFAULT_LIST_LIMIT = 200

export async function listSessions(supabase: SupabaseClient<Database>, filter: ListSessionsFilter): Promise<TrainingSessionListItem[]> {
  let query = supabase.from("training_sessions").select(SESSION_LIST_SELECT)
  if (filter.from) query = query.gte("ends_at", filter.from)
  if (filter.to) query = query.lt("ends_at", filter.to)
  if (filter.teamId) query = query.eq("team_id", filter.teamId)
  if (filter.ids) query = query.in("id", filter.ids)
  const { data, error } = await query
    .order("starts_at", { ascending: (filter.order ?? "asc") === "asc" })
    .limit(filter.limit ?? DEFAULT_LIST_LIMIT)
  if (error) throw error
  return (data ?? []) as unknown as TrainingSessionListItem[]
}

export async function getSessionDetail(supabase: SupabaseClient<Database>, id: string): Promise<TrainingSessionDetail | null> {
  const { data, error } = await supabase.from("training_sessions").select(SESSION_DETAIL_SELECT).eq("id", id).maybeSingle()
  if (error) throw error
  return data as unknown as TrainingSessionDetail | null
}

export async function getReflection(supabase: SupabaseClient<Database>, id: string) {
  const { data, error } = await supabase
    .from("training_session_reflections")
    .select("content_json, updated_at, updated_by:profiles!training_session_reflections_updated_by_profile_id_fkey(id, name)")
    .eq("training_session_id", id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listAttendance(supabase: SupabaseClient<Database>, id: string) {
  const { data, error } = await supabase
    .from("training_session_attendees")
    .select("profile_id, status")
    .eq("training_session_id", id)
  if (error) throw error
  return data ?? []
}

export async function listTeamSlotSources(
  supabase: SupabaseClient<Database>,
  teamId: string,
): Promise<{ schedules: ScheduleSource[]; breaks: BreakRange[]; takenStarts: string[] }> {
  const [schedules, breaks, sessions] = await Promise.all([
    supabase
      .from("recurring_schedules")
      .select("day_of_week, start_time, end_time, valid_from, valid_until, room_id")
      .eq("team_id", teamId)
      .eq("schedule_type", "training_session")
      .is("removed_at", null),
    supabase.from("schedule_breaks").select("start_date, end_date"),
    supabase.from("training_sessions").select("starts_at").eq("team_id", teamId).gte("starts_at", new Date().toISOString()),
  ])
  if (schedules.error) throw schedules.error
  if (breaks.error) throw breaks.error
  if (sessions.error) throw sessions.error
  return {
    schedules: (schedules.data ?? []).map((s) => ({
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      endTime: s.end_time,
      validFrom: s.valid_from,
      validUntil: s.valid_until,
      roomId: s.room_id,
    })),
    breaks: (breaks.data ?? []).map((b) => ({ startDate: b.start_date, endDate: b.end_date })),
    takenStarts: (sessions.data ?? []).map((s) => s.starts_at),
  }
}

export async function listRooms(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.from("rooms").select("id, code, name").is("removed_at", null).order("code")
  if (error) throw error
  return data ?? []
}

export async function searchSessionIds(supabase: SupabaseClient<Database>, q: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("search_training_sessions", { p_query: q })
  if (error) throw error
  return (data ?? []) as string[]
}
```

If `recurring_schedules` / `schedule_breaks` RLS blocks students from reading, confirm with `grep -n "pgPolicy" db/schema/reservations.ts`; both are expected to be readable by authenticated users (the room calendar uses them). If not, stop and ask the user.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm test:unit -- training-sessions && pnpm typecheck` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/training-sessions
git commit -m "feat(training-sessions): add validation schemas and queries"
```

---

### Task 6: API routes

**Files:**
- Create: `src/app/api/training-sessions/_shared.ts`, `route.ts`, `[id]/route.ts`, `[id]/preparation/route.ts`, `[id]/reflection/route.ts`, `[id]/attendance/route.ts`, `[id]/guests/route.ts`

**Interfaces:**
- Consumes: schemas from Task 5, `TS_GUEST_ERROR_*` from Task 2, `contentTextFromJson` from `@/lib/essays/content-text`.
- Produces HTTP API (JSON in, `{ data }` / `{ error, code? }` out):
  - `POST /api/training-sessions` body `SessionInput` → 201 `{ data: { id } }`
  - `PATCH /api/training-sessions/[id]` body `SessionPatch` → 200 `{ data: { id } }`, 409 `{ error, code: "capacity_below_guests" }`
  - `DELETE /api/training-sessions/[id]` → 200
  - `PUT /api/training-sessions/[id]/preparation` → 200 `{ data: { publishedAt } }`
  - `PUT /api/training-sessions/[id]/reflection` → 200
  - `PUT /api/training-sessions/[id]/attendance` → 200
  - `POST|DELETE /api/training-sessions/[id]/guests` → 200 `{ data: { guestCount } }`, 409/404 `{ error, code: TsGuestErrorCode }`

- [ ] **Step 1: Create `_shared.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentUserProfile } from "@/lib/auth-helpers"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"
import { serverLogger } from "@/lib/server-logger"
import type { Database } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

export interface TsApiContext {
  profileId: string
  teamId: string | null
  supabase: SupabaseClient<Database>
}

export interface ApiFailure {
  response: NextResponse
}

export function isApiFailure<T>(value: T | ApiFailure): value is ApiFailure {
  return typeof value === "object" && value !== null && "response" in value
}

export function errorResponse(error: string, status: number, code?: string): ApiFailure {
  return { response: NextResponse.json(code ? { error, code } : { error }, { status }) }
}

export async function requireTsApiContext(): Promise<TsApiContext | ApiFailure> {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null
  if (!user) return errorResponse("Neautorizováno", 401)

  const profile = await getCurrentUserProfile(supabase, { user })
  if (!profile) return errorResponse("K této funkci nemáš přístup", 403)
  const allowed = canAccessFeature(
    {
      role: profile.role,
      beta_access_granted_at: profile.beta_access_granted_at,
      beta_cohort: ((profile as unknown as { beta_cohort: BetaCohort }).beta_cohort ?? "A") as BetaCohort,
    },
    "trainingSessions",
  )
  if (!allowed) return errorResponse("K této funkci nemáš přístup", 403)
  return { profileId: profile.id, teamId: profile.team_id, supabase }
}

/** Loads a session and asserts the caller belongs to its team. */
export async function requireOwnedSession(
  context: TsApiContext,
  id: string,
): Promise<{ id: string; team_id: string; starts_at: string; guest_capacity: number } | ApiFailure> {
  if (!z.uuid().safeParse(id).success) return errorResponse("Neplatný identifikátor", 400)
  const { data, error } = await context.supabase
    .from("training_sessions")
    .select("id, team_id, starts_at, guest_capacity")
    .eq("id", id)
    .maybeSingle()
  if (error) return mutationFailed(error)
  if (!data) return errorResponse("TS nebylo nalezeno", 404)
  if (!context.teamId || data.team_id !== context.teamId) return errorResponse("TS patří jinému týmu", 403)
  return data
}

export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T | ApiFailure> {
  try {
    const parsed = schema.safeParse(await request.json())
    if (parsed.success) return parsed.data
    return errorResponse(parsed.error.issues[0]?.message ?? "Neplatná data požadavku", 400)
  } catch {
    return errorResponse("Neplatná data požadavku", 400)
  }
}

export function mutationFailed(error: unknown): ApiFailure {
  serverLogger.console.error("Training session mutation failed:", error)
  return errorResponse("Akci se nepodařilo uložit", 500)
}
```

- [ ] **Step 2: `route.ts` (create)**

```ts
import { NextResponse } from "next/server"

import { sessionInputSchema } from "@/lib/training-sessions/validation"

import { errorResponse, isApiFailure, mutationFailed, parseJson, requireTsApiContext } from "./_shared"

export async function POST(request: Request) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  if (!context.teamId) return errorResponse("TS může vytvořit jen člen:ka týmu", 403).response

  const input = await parseJson(request, sessionInputSchema)
  if (isApiFailure(input)) return input.response

  const { data, error } = await context.supabase
    .from("training_sessions")
    .insert({
      team_id: context.teamId,
      topic: input.topic,
      description: input.description,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      room_id: input.roomId,
      location_note: input.locationNote,
      guest_capacity: input.guestCapacity,
      created_by_profile_id: context.profileId,
      updated_by_profile_id: context.profileId,
    })
    .select("id")
    .single()
  if (error || !data) return mutationFailed(error).response

  if (input.facilitatorIds.length > 0) {
    const { error: facilitatorsError } = await context.supabase.from("training_session_facilitators").insert(
      input.facilitatorIds.map((profileId) => ({
        training_session_id: data.id,
        profile_id: profileId,
        created_by_profile_id: context.profileId,
      })),
    )
    if (facilitatorsError) return mutationFailed(facilitatorsError).response
  }

  return NextResponse.json({ data: { id: data.id } }, { status: 201 })
}
```

- [ ] **Step 3: `[id]/route.ts` (update / cancel / restore / delete)**

```ts
import { NextResponse } from "next/server"

import { isCapacityBelowGuests, sessionPatchSchema } from "@/lib/training-sessions/validation"

import { errorResponse, isApiFailure, mutationFailed, parseJson, requireOwnedSession, requireTsApiContext } from "../_shared"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const session = await requireOwnedSession(context, (await params).id)
  if (isApiFailure(session)) return session.response
  const patch = await parseJson(request, sessionPatchSchema)
  if (isApiFailure(patch)) return patch.response

  const audit = { updated_by_profile_id: context.profileId }

  if (patch.kind === "cancel" || patch.kind === "restore") {
    const cancelled = patch.kind === "cancel"
    const { error } = await context.supabase
      .from("training_sessions")
      .update({
        ...audit,
        cancelled_at: cancelled ? new Date().toISOString() : null,
        cancelled_by_profile_id: cancelled ? context.profileId : null,
      })
      .eq("id", session.id)
    if (error) return mutationFailed(error).response
    return NextResponse.json({ data: { id: session.id } })
  }

  const { count, error: countError } = await context.supabase
    .from("training_session_guests")
    .select("profile_id", { count: "exact", head: true })
    .eq("training_session_id", session.id)
  if (countError) return mutationFailed(countError).response
  const guestCount = count ?? 0
  if (isCapacityBelowGuests(patch.guestCapacity, guestCount)) {
    return errorResponse(`Obsazeno je už ${guestCount} míst, kapacitu nelze snížit pod tento počet`, 409, "capacity_below_guests").response
  }

  const { error } = await context.supabase
    .from("training_sessions")
    .update({
      ...audit,
      topic: patch.topic,
      description: patch.description,
      starts_at: patch.startsAt,
      ends_at: patch.endsAt,
      room_id: patch.roomId,
      location_note: patch.locationNote,
      guest_capacity: patch.guestCapacity,
    })
    .eq("id", session.id)
  if (error) return mutationFailed(error).response

  const { error: deleteError } = await context.supabase
    .from("training_session_facilitators")
    .delete()
    .eq("training_session_id", session.id)
  if (deleteError) return mutationFailed(deleteError).response
  if (patch.facilitatorIds.length > 0) {
    const { error: insertError } = await context.supabase.from("training_session_facilitators").insert(
      patch.facilitatorIds.map((profileId) => ({
        training_session_id: session.id,
        profile_id: profileId,
        created_by_profile_id: context.profileId,
      })),
    )
    if (insertError) return mutationFailed(insertError).response
  }

  return NextResponse.json({ data: { id: session.id } })
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const session = await requireOwnedSession(context, (await params).id)
  if (isApiFailure(session)) return session.response
  const { error } = await context.supabase
    .from("training_sessions")
    .update({ removed_at: new Date().toISOString(), updated_by_profile_id: context.profileId })
    .eq("id", session.id)
  if (error) return mutationFailed(error).response
  return NextResponse.json({ data: { id: session.id } })
}
```

Note on soft delete: after setting `removed_at`, the row no longer satisfies the select policy, so PostgREST may report the update as failed under RLS (`new row violates row-level security`) because UPDATE requires the new row to be visible via SELECT policies. If that happens, add a custom-migration RPC `remove_training_session(p_session_id uuid)` (`SECURITY DEFINER`, asserts caller's team, sets `removed_at`) following Task 3's pattern and call it here instead; add an integration test for it.

- [ ] **Step 4: `[id]/preparation/route.ts`**

```ts
import { NextResponse } from "next/server"

import { contentTextFromJson } from "@/lib/essays/content-text"
import { preparationInputSchema } from "@/lib/training-sessions/validation"

import { isApiFailure, mutationFailed, parseJson, requireOwnedSession, requireTsApiContext } from "../../_shared"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const session = await requireOwnedSession(context, (await params).id)
  if (isApiFailure(session)) return session.response
  const input = await parseJson(request, preparationInputSchema)
  if (isApiFailure(input)) return input.response

  const { data: existing } = await context.supabase
    .from("training_session_preparations")
    .select("published_at")
    .eq("training_session_id", session.id)
    .maybeSingle()

  const publishedAt =
    input.action === "publish"
      ? existing?.published_at ?? new Date().toISOString()
      : input.action === "unpublish"
        ? null
        : existing?.published_at ?? null

  const { error } = await context.supabase.from("training_session_preparations").upsert(
    {
      training_session_id: session.id,
      content_json: input.contentJson,
      content_text: contentTextFromJson(input.contentJson),
      published_at: publishedAt,
      created_by_profile_id: context.profileId,
      updated_by_profile_id: context.profileId,
    },
    { onConflict: "training_session_id" },
  )
  if (error) return mutationFailed(error).response
  return NextResponse.json({ data: { publishedAt } })
}
```

Note: the upsert overwrites `created_by_profile_id` on update; acceptable (same team), but if the reviewer objects, split into insert-or-update.

- [ ] **Step 5: `[id]/reflection/route.ts`**

```ts
import { NextResponse } from "next/server"

import { contentTextFromJson } from "@/lib/essays/content-text"
import { reflectionInputSchema } from "@/lib/training-sessions/validation"

import { errorResponse, isApiFailure, mutationFailed, parseJson, requireOwnedSession, requireTsApiContext } from "../../_shared"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const session = await requireOwnedSession(context, (await params).id)
  if (isApiFailure(session)) return session.response
  if (new Date(session.starts_at).getTime() > Date.now()) {
    return errorResponse("Reflexi lze psát až po začátku TS", 409).response
  }
  const input = await parseJson(request, reflectionInputSchema)
  if (isApiFailure(input)) return input.response

  const { error } = await context.supabase.from("training_session_reflections").upsert(
    {
      training_session_id: session.id,
      content_json: input.contentJson,
      content_text: contentTextFromJson(input.contentJson),
      created_by_profile_id: context.profileId,
      updated_by_profile_id: context.profileId,
    },
    { onConflict: "training_session_id" },
  )
  if (error) return mutationFailed(error).response
  return NextResponse.json({ data: { ok: true } })
}
```

- [ ] **Step 6: `[id]/attendance/route.ts`**

```ts
import { NextResponse } from "next/server"

import { attendanceInputSchema } from "@/lib/training-sessions/validation"

import { isApiFailure, mutationFailed, parseJson, requireOwnedSession, requireTsApiContext } from "../../_shared"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const session = await requireOwnedSession(context, (await params).id)
  if (isApiFailure(session)) return session.response
  const input = await parseJson(request, attendanceInputSchema)
  if (isApiFailure(input)) return input.response

  const recorded = input.attendees.filter((a) => a.status !== "absent")
  const keepIds = recorded.map((a) => a.profileId)

  let deleteQuery = context.supabase.from("training_session_attendees").delete().eq("training_session_id", session.id)
  if (keepIds.length > 0) deleteQuery = deleteQuery.not("profile_id", "in", `(${keepIds.join(",")})`)
  const { error: deleteError } = await deleteQuery
  if (deleteError) return mutationFailed(deleteError).response

  if (recorded.length > 0) {
    const { error } = await context.supabase.from("training_session_attendees").upsert(
      recorded.map((a) => ({
        training_session_id: session.id,
        profile_id: a.profileId,
        status: a.status,
        created_by_profile_id: context.profileId,
        updated_by_profile_id: context.profileId,
      })),
      { onConflict: "training_session_id,profile_id" },
    )
    if (error) return mutationFailed(error).response
  }
  return NextResponse.json({ data: { ok: true } })
}
```

- [ ] **Step 7: `[id]/guests/route.ts`**

```ts
import { NextResponse } from "next/server"
import { z } from "zod"

import { TS_GUEST_ERROR_CODES, TS_GUEST_ERROR_MESSAGES, type TsGuestErrorCode } from "@/lib/training-sessions/constants"

import { errorResponse, isApiFailure, mutationFailed, requireTsApiContext } from "../../_shared"

function toGuestError(message: string | undefined) {
  const code = TS_GUEST_ERROR_CODES.find((c) => c === message) as TsGuestErrorCode | undefined
  if (!code) return null
  return errorResponse(TS_GUEST_ERROR_MESSAGES[code], code === "not_found" ? 404 : 409, code)
}

async function handle(rpc: "join_training_session" | "leave_training_session", params: Promise<{ id: string }>) {
  const context = await requireTsApiContext()
  if (isApiFailure(context)) return context.response
  const { id } = await params
  if (!z.uuid().safeParse(id).success) return errorResponse("Neplatný identifikátor", 400).response

  const { data, error } = await context.supabase.rpc(rpc, { p_session_id: id })
  if (error) return (toGuestError(error.message) ?? mutationFailed(error)).response
  return NextResponse.json({ data: { guestCount: data as number } })
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle("join_training_session", params)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle("leave_training_session", params)
}
```

- [ ] **Step 8: Typecheck, lint, test**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS. (Route handlers are covered by E2E in Task 11, per the testing runbook.)

- [ ] **Step 9: Commit**

```bash
git add src/app/api/training-sessions
git commit -m "feat(training-sessions): add API routes"
```

---

### Task 7: Module shell, navigation, tab bar, card and Objevovat

**Files:**
- Modify: `src/lib/navigation.ts`, `src/lib/spotlight.ts`
- Create: `src/app/(main)/ts/layout.tsx`, `src/app/(main)/ts/page.tsx`, `src/app/(main)/ts/objevovat/page.tsx`, `src/components/training-sessions/ts-tab-bar.tsx` (+ `.test.tsx`), `session-card.tsx` (+ `.test.tsx`), `session-agenda.tsx`, `guest-join-button.tsx`, `discover-filters.tsx`, `feed-refresher.tsx`, `src/lib/training-sessions/use-training-session-feed.ts`

**Interfaces:**
- Consumes: Tasks 2, 4, 5, 6.
- Produces:
  - `getActiveTsTabUrl(pathname: string): string | undefined`
  - `<SessionCard session: TrainingSessionListItem; viewer: SessionViewer; conflicts: SessionConflict<SessionTiming>[]; now: string />` where `interface SessionViewer { profileId: string; teamId: string | null }`
  - `<SessionAgenda sessions viewer commitments now emptyTitle emptyDescription />`
  - `useTrainingSessionFeed(onEvent: () => void): void`

- [ ] **Step 1: Write failing component tests**

`src/components/training-sessions/ts-tab-bar.test.tsx`:
```tsx
import { getActiveTsTabUrl } from "./ts-tab-bar"

describe("getActiveTsTabUrl", () => {
  it("maps routes to tabs", () => {
    expect(getActiveTsTabUrl("/ts/prehled")).toBe("/ts/prehled")
    expect(getActiveTsTabUrl("/ts/nova")).toBe("/ts/prehled")
    expect(getActiveTsTabUrl("/ts/objevovat")).toBe("/ts/objevovat")
    expect(getActiveTsTabUrl("/ts/3f0c2b1e-0000-4000-8000-000000000000")).toBe("/ts/objevovat")
  })
})
```

`src/components/training-sessions/session-card.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react"

import type { TrainingSessionListItem } from "@/lib/training-sessions/types"

import { SessionCard } from "./session-card"

const session: TrainingSessionListItem = {
  id: "s1",
  team_id: "t1",
  topic: "AI v projektech",
  description: null,
  starts_at: "2026-10-06T06:00:00.000Z",
  ends_at: "2026-10-06T10:00:00.000Z",
  room_id: "r1",
  location_note: null,
  guest_capacity: 3,
  cancelled_at: null,
  team: { id: "t1", name: "Tuuli", color: null, onboardingYear: 2 },
  room: { id: "r1", code: "E209", name: "E209" },
  facilitators: [{ profile: { id: "p1", name: "Anna", picture: null } }],
  guests: [{ profile_id: "g1", joined_at: "2026-10-01T00:00:00Z", profile: { id: "g1", name: "Klára", picture: null } }],
  preparation: null,
}
const now = "2026-10-02T08:00:00.000Z"

describe("SessionCard", () => {
  it("shows own-team badge and no join button for own team", () => {
    render(<SessionCard session={session} viewer={{ profileId: "p1", teamId: "t1" }} conflicts={[]} now={now} />)
    expect(screen.getByText("Můj tým")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Přihlásit se/ })).not.toBeInTheDocument()
  })

  it("shows occupancy and a join button for other teams", () => {
    render(<SessionCard session={session} viewer={{ profileId: "x", teamId: "t2" }} conflicts={[]} now={now} />)
    expect(screen.getByText("1/3 míst")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Přihlásit se/ })).toBeInTheDocument()
  })

  it("shows full state when capacity is reached", () => {
    render(<SessionCard session={{ ...session, guest_capacity: 1 }} viewer={{ profileId: "x", teamId: "t2" }} conflicts={[]} now={now} />)
    expect(screen.getByText("Obsazeno")).toBeInTheDocument()
  })

  it("shows the overlap warning", () => {
    const conflict = {
      commitment: { id: "m", startsAt: "2026-10-06T06:00:00.000Z", endsAt: "2026-10-06T08:00:00.000Z", cancelledAt: null },
      overlapStart: "2026-10-06T06:00:00.000Z",
      overlapEnd: "2026-10-06T08:00:00.000Z",
    }
    render(<SessionCard session={session} viewer={{ profileId: "x", teamId: "t2" }} conflicts={[conflict]} now={now} />)
    expect(screen.getByText("Kryje se s tvým TS · 8:00–10:00")).toBeInTheDocument()
  })

  it("mutes a cancelled session and hides guest controls", () => {
    render(<SessionCard session={{ ...session, cancelled_at: now }} viewer={{ profileId: "x", teamId: "t2" }} conflicts={[]} now={now} />)
    expect(screen.getByText("Zrušeno")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Přihlásit se/ })).not.toBeInTheDocument()
  })

  it("hides guest controls when closed to guests", () => {
    render(<SessionCard session={{ ...session, guest_capacity: 0, guests: [] }} viewer={{ profileId: "x", teamId: "t2" }} conflicts={[]} now={now} />)
    expect(screen.queryByRole("button", { name: /Přihlásit se/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test:component -- training-sessions` — Expected: FAIL (modules missing).

- [ ] **Step 3: Navigation + spotlight**

In `src/lib/navigation.ts` import `Presentation` from `lucide-react`, add after "Týmový deník":
```ts
  { title: "Tréninkové sessions", url: "/ts/prehled", icon: Presentation, feature: "trainingSessions", description: "Tréninkové sessions týmů, příprava, docházka a reflexe." },
```
and add `"/ts/prehled"` to `MODULE_HUB_ORDER` right after `"/reservations"`.

In `src/lib/spotlight.ts` import `Presentation` and add to `RAW_SPOTLIGHT_ITEMS`:
```ts
  {
    id: "page-training-sessions",
    title: "Tréninkové sessions",
    description: "Nadcházející TS, příprava a přihlášení na TS jiných týmů",
    url: "/ts/prehled",
    feature: "trainingSessions",
    icon: Presentation,
    keywords: ["ts", "training session", "tréninková session", "příprava", "facilitace", "docházka", "reflexe"],
  },
```

- [ ] **Step 4: Tab bar** — `src/components/training-sessions/ts-tab-bar.tsx`

```tsx
"use client"

import { Compass, User } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { TS_ROUTES } from "@/lib/training-sessions/constants"

const TABS = [
  { title: "Přehled", url: TS_ROUTES.overview, icon: User },
  { title: "Objevovat", url: TS_ROUTES.discover, icon: Compass },
] as const

export function getActiveTsTabUrl(pathname: string): string | undefined {
  if (pathname.startsWith(TS_ROUTES.overview) || pathname === TS_ROUTES.create) return TS_ROUTES.overview
  if (pathname.startsWith("/ts/")) return TS_ROUTES.discover
  return undefined
}

export function TsTabBar() {
  const activeUrl = getActiveTsTabUrl(usePathname())
  return (
    <nav aria-label="Tréninkové sessions" className="sticky top-0 z-40 -mx-4 border-b bg-background px-4 md:static md:z-auto md:mx-0 md:px-0">
      <div className="flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar md:container md:mx-auto md:px-6">
        {TABS.map((tab) => (
          <Link
            key={tab.url}
            href={tab.url}
            aria-current={activeUrl === tab.url ? "page" : undefined}
            data-active={activeUrl === tab.url ? "true" : undefined}
            className={[
              "relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-none",
              "px-3 py-3.5 text-sm font-medium transition-colors focus-ring",
              "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full",
              "after:bg-primary after:opacity-0 after:transition-opacity",
              "text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground",
              "data-[active=true]:text-foreground data-[active=true]:after:opacity-100",
            ].join(" ")}
          >
            <tab.icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{tab.title}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 5: Layout + root redirect**

`src/app/(main)/ts/layout.tsx`:
```tsx
import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"
import { TsTabBar } from "@/components/training-sessions/ts-tab-bar"
import { getSessionProfile } from "@/lib/auth/session"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"

export default async function TsLayout({ children }: { children: ReactNode }) {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  const allowed = canAccessFeature(
    {
      role: profile.role,
      beta_access_granted_at: profile.beta_access_granted_at,
      beta_cohort: ((profile as unknown as { beta_cohort: BetaCohort }).beta_cohort ?? "A") as BetaCohort,
    },
    "trainingSessions",
  )
  if (!allowed) return <FeatureComingSoon featureName="Tréninkové sessions" />
  return (
    <>
      <TsTabBar />
      {children}
    </>
  )
}
```

`src/app/(main)/ts/page.tsx`:
```tsx
import { redirect } from "next/navigation"

import { TS_ROUTES } from "@/lib/training-sessions/constants"

export default function TsIndexPage() {
  redirect(TS_ROUTES.overview)
}
```

- [ ] **Step 6: Realtime hook + refresher**

`src/lib/training-sessions/use-training-session-feed.ts`:
```ts
"use client"

import { useEffect, useRef } from "react"

import { createClient } from "@/lib/supabase/client"

import { TS_REALTIME_EVENTS, TS_REALTIME_TOPIC } from "./constants"

export function useTrainingSessionFeed(onEvent: () => void): void {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    const client = createClient()
    const channel = client.channel(TS_REALTIME_TOPIC, { config: { broadcast: { self: false }, private: true } })
    for (const event of Object.values(TS_REALTIME_EVENTS)) {
      channel.on("broadcast", { event }, () => onEventRef.current())
    }
    client.realtime
      .setAuth()
      .then(() =>
        channel.subscribe((status, err) => {
          if (status === "CHANNEL_ERROR") console.error("Training session feed error:", err)
        }),
      )
      .catch((err) => console.error("Failed to set auth for training session feed:", err))
    return () => {
      client.removeChannel(channel)
    }
  }, [])
}
```

`src/components/training-sessions/feed-refresher.tsx`:
```tsx
"use client"

import { useRouter } from "next/navigation"
import { useCallback, useRef } from "react"

import { useTrainingSessionFeed } from "@/lib/training-sessions/use-training-session-feed"

const REFRESH_DEBOUNCE_MS = 400

/** Re-renders the surrounding Server Component whenever the TS feed reports a change. */
export function FeedRefresher() {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS)
  }, [router])
  useTrainingSessionFeed(refresh)
  return null
}
```

- [ ] **Step 7: Guest join button** — `guest-join-button.tsx`

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog"

interface GuestJoinButtonProps {
  sessionId: string
  joined: boolean
  conflictText: string | null
}

export function GuestJoinButton({ sessionId, joined, conflictText }: GuestJoinButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function submit() {
    setPending(true)
    try {
      const res = await fetch(`/api/training-sessions/${sessionId}/guests`, { method: joined ? "DELETE" : "POST" })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(body.error ?? "Akci se nepodařilo dokončit")
        return
      }
      toast.success(joined ? "Odhlášeno z TS" : "Přihlášeno na TS")
    } finally {
      setPending(false)
      router.refresh()
    }
  }

  function onClick() {
    if (!joined && conflictText) setConfirmOpen(true)
    else void submit()
  }

  return (
    <>
      <Button size="sm" variant={joined ? "outline" : "default"} disabled={pending} onClick={onClick}>
        {joined ? "Odhlásit se" : "Přihlásit se"}
      </Button>
      <ResponsiveAlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>TS se kryje s tvým programem</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>{conflictText} Chceš se přesto přihlásit?</ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>Zpět</ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogAction onClick={() => void submit()}>Přihlásit se</ResponsiveAlertDialogAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </>
  )
}
```

Before writing, open `src/components/ui/responsive-alert-dialog.tsx` and match its actual export names; adjust imports if they differ.

- [ ] **Step 8: Session card** — `session-card.tsx`

```tsx
import { CircleAlert, MapPin, Users } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import type { SessionConflict } from "@/lib/training-sessions/conflicts"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { formatTimeRange } from "@/lib/training-sessions/format"
import { getSessionStatus } from "@/lib/training-sessions/status"
import { toTiming, type SessionTiming, type TrainingSessionListItem } from "@/lib/training-sessions/types"
import { cn } from "@/lib/utils"

import { GuestJoinButton } from "./guest-join-button"

export interface SessionViewer {
  profileId: string
  teamId: string | null
}

interface SessionCardProps {
  session: TrainingSessionListItem
  viewer: SessionViewer
  conflicts: SessionConflict<SessionTiming>[]
  now: string
}

export function SessionCard({ session, viewer, conflicts, now }: SessionCardProps) {
  const status = getSessionStatus(toTiming(session), new Date(now))
  const isOwnTeam = viewer.teamId !== null && viewer.teamId === session.team_id
  const guestCount = session.guests.length
  const joined = session.guests.some((g) => g.profile_id === viewer.profileId)
  const isFull = guestCount >= session.guest_capacity
  const canShowGuestControls = !isOwnTeam && session.guest_capacity > 0 && status === "upcoming"
  const conflict = conflicts[0]
  const conflictText = conflict ? `Kryje se s tvým TS · ${formatTimeRange(conflict.overlapStart, conflict.overlapEnd)}` : null
  const facilitatorNames = session.facilitators.map((f) => f.profile?.name).filter(Boolean).join(", ")
  const location = session.room?.code ?? session.location_note

  return (
    <article className={cn("rounded-xl border bg-card p-4 transition-colors", status === "cancelled" && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium tabular-nums text-foreground">{formatTimeRange(session.starts_at, session.ends_at)}</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-primary" style={session.team?.color ? { backgroundColor: session.team.color } : undefined} />
          {session.team?.name}
        </span>
        {isOwnTeam && <Badge variant="secondary">Můj tým</Badge>}
        {joined && <Badge variant="secondary">Přihlášeno</Badge>}
        {status === "cancelled" && <Badge variant="destructive">Zrušeno</Badge>}
      </div>

      <Link href={TS_ROUTES.detail(session.id)} className="mt-2 block font-heading text-lg font-semibold leading-snug hover:underline">
        {session.topic}
      </Link>

      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {location && (
          <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{location}</span>
        )}
        {facilitatorNames && <span>Facilitace: {facilitatorNames}</span>}
        {isOwnTeam && <span>{session.preparation?.published_at ? "Příprava je zveřejněná" : "Příprava zatím chybí"}</span>}
      </div>

      {conflictText && status !== "cancelled" && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning-strong">
          <CircleAlert className="size-3.5" aria-hidden />{conflictText}
        </p>
      )}

      {canShowGuestControls && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" aria-hidden />
            {isFull && !joined ? "Obsazeno" : `${guestCount}/${session.guest_capacity} míst`}
          </span>
          {(!isFull || joined) && <GuestJoinButton sessionId={session.id} joined={joined} conflictText={conflictText} />}
        </div>
      )}
    </article>
  )
}
```

If `team.color` is not a valid CSS color in the data, fall back to `bg-primary` only. Verify both themes (team color dot is the only non-token color and is user data, allowed).

- [ ] **Step 9: Agenda + filters**

`session-agenda.tsx`:
```tsx
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { findConflicts } from "@/lib/training-sessions/conflicts"
import { groupByPragueDay } from "@/lib/training-sessions/format"
import { toTiming, type SessionTiming, type TrainingSessionListItem } from "@/lib/training-sessions/types"

import { SessionCard, type SessionViewer } from "./session-card"

interface SessionAgendaProps {
  sessions: TrainingSessionListItem[]
  viewer: SessionViewer
  commitments: SessionTiming[]
  now: string
  emptyTitle: string
  emptyDescription: string
}

export function SessionAgenda({ sessions, viewer, commitments, now, emptyTitle, emptyDescription }: SessionAgendaProps) {
  if (sessions.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="space-y-6">
      {groupByPragueDay(sessions, (s) => s.starts_at).map((group) => (
        <section key={group.dateKey} aria-labelledby={`day-${group.dateKey}`} className="space-y-2">
          <h2 id={`day-${group.dateKey}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.heading}</h2>
          <div className="space-y-2">
            {group.items.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                viewer={viewer}
                conflicts={findConflicts(toTiming(session), commitments)}
                now={now}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
```

Check `src/components/ui/empty.tsx` export names first and match them.

`discover-filters.tsx` (server component, links + GET form):
```tsx
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { YEAR_LABELS } from "@/lib/komunita/types"
import { TS_DISCOVER_FILTER_LABELS, TS_DISCOVER_FILTERS, TS_ROUTES, type TsDiscoverFilter } from "@/lib/training-sessions/constants"
import { cn } from "@/lib/utils"

interface DiscoverFiltersProps {
  filter: TsDiscoverFilter
  year: number | null
  q: string
}

function href(params: { filter: TsDiscoverFilter; year: number | null; q: string }): string {
  const search = new URLSearchParams()
  if (params.filter !== "nadchazejici") search.set("filtr", params.filter)
  if (params.year) search.set("rocnik", String(params.year))
  if (params.q) search.set("q", params.q)
  const qs = search.toString()
  return qs ? `${TS_ROUTES.discover}?${qs}` : TS_ROUTES.discover
}

const chip = "rounded-full border px-3 py-1 text-sm transition-colors"
const chipActive = "border-primary bg-primary/10 text-primary-strong"

export function DiscoverFilters({ filter, year, q }: DiscoverFiltersProps) {
  return (
    <div className="space-y-3">
      <form action={TS_ROUTES.discover} className="flex gap-2" role="search">
        {filter !== "nadchazejici" && <input type="hidden" name="filtr" value={filter} />}
        {year && <input type="hidden" name="rocnik" value={year} />}
        <Input name="q" defaultValue={q} placeholder="Hledat podle tématu nebo přípravy…" aria-label="Hledat TS" />
        <Button type="submit" variant="outline">Hledat</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {TS_DISCOVER_FILTERS.map((f) => (
          <Link key={f} href={href({ filter: f, year, q })} className={cn(chip, f === filter && chipActive)} aria-current={f === filter ? "true" : undefined}>
            {TS_DISCOVER_FILTER_LABELS[f]}
          </Link>
        ))}
        <span aria-hidden className="mx-1 h-6 w-px bg-border" />
        {Object.entries(YEAR_LABELS).map(([value, label]) => {
          const n = Number(value)
          const active = year === n
          return (
            <Link key={value} href={href({ filter, year: active ? null : n, q })} className={cn(chip, active && chipActive)} aria-current={active ? "true" : undefined}>
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

Check `primary-strong` exists in `globals.css`; if not, use the token DESIGN.md names for text on a primary tint.

- [ ] **Step 10: Objevovat page** — `src/app/(main)/ts/objevovat/page.tsx`

```tsx
import { redirect } from "next/navigation"

import { DiscoverFilters } from "@/components/training-sessions/discover-filters"
import { FeedRefresher } from "@/components/training-sessions/feed-refresher"
import { SessionAgenda } from "@/components/training-sessions/session-agenda"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { TS_DISCOVER_FILTERS, TS_ROUTES, type TsDiscoverFilter } from "@/lib/training-sessions/constants"
import { listSessions, searchSessionIds } from "@/lib/training-sessions/queries"
import { toTiming, type TrainingSessionListItem } from "@/lib/training-sessions/types"
import Link from "next/link"

export const metadata = {
  title: "Objevovat TS",
  description: "Všechny tréninkové sessions týmů s volnými místy pro hosty",
}

interface PageProps {
  searchParams: Promise<{ filtr?: string; rocnik?: string; q?: string }>
}

const PAST_LIMIT = 100

export default async function TsDiscoverPage({ searchParams }: PageProps) {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  const supabase = await createClient()
  const params = await searchParams
  const filter: TsDiscoverFilter = (TS_DISCOVER_FILTERS as readonly string[]).includes(params.filtr ?? "")
    ? (params.filtr as TsDiscoverFilter)
    : "nadchazejici"
  const year = params.rocnik ? Number(params.rocnik) : null
  const q = (params.q ?? "").trim()
  const nowIso = new Date().toISOString()

  const ids = q ? await searchSessionIds(supabase, q) : undefined
  const isPast = filter === "probehle"
  const sessions = await listSessions(supabase, {
    ...(isPast ? { to: nowIso, order: "desc" as const, limit: PAST_LIMIT } : { from: nowIso }),
    ids,
  })

  const viewer = { profileId: profile.id, teamId: profile.team_id }
  const filtered = sessions.filter((s) => applyFilter(s, filter, viewer) && (year === null || s.team?.onboardingYear === year))

  const upcoming = isPast ? await listSessions(supabase, { from: nowIso }) : sessions
  const commitments = upcoming
    .filter((s) => s.team_id === viewer.teamId || s.guests.some((g) => g.profile_id === viewer.profileId))
    .map(toTiming)

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Objevovat"
        description="Všechny tréninkové sessions týmů s volnými místy pro hosty"
        action={profile.team_id ? <Button asChild><Link href={TS_ROUTES.create}>Nové TS</Link></Button> : undefined}
      />
      <FeedRefresher />
      <DiscoverFilters filter={filter} year={year} q={q} />
      <div className="mt-6">
        <SessionAgenda
          sessions={filtered}
          viewer={viewer}
          commitments={commitments}
          now={nowIso}
          emptyTitle="Žádné TS"
          emptyDescription={q ? "Zkus jiný výraz nebo jiný filtr." : "Pro tento filtr teď nic není."}
        />
      </div>
    </PageShell>
  )
}

function applyFilter(s: TrainingSessionListItem, filter: TsDiscoverFilter, viewer: { profileId: string; teamId: string | null }): boolean {
  switch (filter) {
    case "volna-mista":
      return !s.cancelled_at && s.team_id !== viewer.teamId && s.guests.length < s.guest_capacity
    case "muj-tym":
      return s.team_id === viewer.teamId
    case "prihlasene":
      return s.guests.some((g) => g.profile_id === viewer.profileId)
    default:
      return true
  }
}
```

Fix import order during implementation (`next/link` belongs with external imports). Note: "Nadcházející" intentionally shows closed (capacity 0) TS too, so the catalog is complete; `volna-mista` narrows to joinable ones.

- [ ] **Step 11: Run tests, typecheck, lint**

Run: `pnpm test && pnpm typecheck && pnpm lint` — Expected: PASS.

- [ ] **Step 12: Manually verify**

Run `pnpm dev`, sign in as a cohort-B user, open `/ts/objevovat` in light and dark themes, check card layout at 375 px width.

- [ ] **Step 13: Commit**

```bash
git add src/lib/navigation.ts src/lib/spotlight.ts src/app/\(main\)/ts src/components/training-sessions src/lib/training-sessions
git commit -m "feat(training-sessions): add module shell and Objevovat catalog"
```

---

### Task 8: Přehled page

**Files:**
- Create: `src/app/(main)/ts/prehled/page.tsx`

**Interfaces:**
- Consumes: `listSessions`, `SessionCard`, `SessionAgenda`, `getSessionStatus`, `toTiming`, `TS_ROUTES`.

- [ ] **Step 1: Implement the page**

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"

import { FeedRefresher } from "@/components/training-sessions/feed-refresher"
import { SessionAgenda } from "@/components/training-sessions/session-agenda"
import { SessionCard } from "@/components/training-sessions/session-card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { listSessions } from "@/lib/training-sessions/queries"
import { toTiming } from "@/lib/training-sessions/types"

export const metadata = {
  title: "Tréninkové sessions",
  description: "Tvoje nadcházející TS, příprava a TS, na které se chystáš",
}

const REFLECTION_LOOKBACK_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

export default async function TsOverviewPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  const supabase = await createClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const viewer = { profileId: profile.id, teamId: profile.team_id }

  const upcoming = await listSessions(supabase, { from: nowIso })
  const mine = upcoming.filter(
    (s) => !s.cancelled_at && (s.team_id === viewer.teamId || s.guests.some((g) => g.profile_id === viewer.profileId)),
  )
  const [nearest, ...rest] = mine
  const facilitating = mine.filter(
    (s) => s.team_id === viewer.teamId && !s.preparation?.published_at && s.facilitators.some((f) => f.profile?.id === viewer.profileId),
  )

  let missingReflections: typeof upcoming = []
  if (viewer.teamId) {
    const recent = await listSessions(supabase, {
      teamId: viewer.teamId,
      from: new Date(now.getTime() - REFLECTION_LOOKBACK_DAYS * MS_PER_DAY).toISOString(),
      to: nowIso,
      order: "desc",
    })
    const { data: reflections } = await supabase
      .from("training_session_reflections")
      .select("training_session_id")
      .in("training_session_id", recent.map((s) => s.id))
    const withReflection = new Set((reflections ?? []).map((r) => r.training_session_id))
    missingReflections = recent.filter((s) => !s.cancelled_at && !withReflection.has(s.id))
  }

  const commitments = mine.map(toTiming)

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Tréninkové sessions"
        description="Tvoje nadcházející TS, příprava a TS, na které se chystáš"
        action={viewer.teamId ? <Button asChild><Link href={TS_ROUTES.create}>Nové TS</Link></Button> : undefined}
      />
      <FeedRefresher />

      <div className="space-y-8">
        {facilitating.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-heading text-lg font-semibold">Facilituješ</h2>
            {facilitating.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning-strong">
                <span>{s.topic}: příprava zatím chybí</span>
                <Button asChild size="sm" variant="outline"><Link href={`${TS_ROUTES.detail(s.id)}?tab=priprava`}>Přidat přípravu</Link></Button>
              </div>
            ))}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold">Nejbližší TS</h2>
          {nearest ? (
            <SessionCard session={nearest} viewer={viewer} conflicts={[]} now={nowIso} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Nemáš naplánované žádné TS. <Link className="underline" href={TS_ROUTES.discover}>Podívej se do Objevovat</Link>.
            </p>
          )}
        </section>

        {rest.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-heading text-lg font-semibold">Nadcházející</h2>
            <SessionAgenda sessions={rest} viewer={viewer} commitments={commitments} now={nowIso} emptyTitle="" emptyDescription="" />
          </section>
        )}

        {missingReflections.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-heading text-lg font-semibold">Chybí reflexe</h2>
            <ul className="space-y-1 text-sm">
              {missingReflections.map((s) => (
                <li key={s.id}><Link className="underline" href={`${TS_ROUTES.detail(s.id)}?tab=reflexe`}>{s.topic}</Link></li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageShell>
  )
}
```

Note: `nearest` is passed `conflicts={[]}` on purpose — it is already the viewer's own commitment.

- [ ] **Step 2: Typecheck, lint, manual check**

Run: `pnpm typecheck && pnpm lint`. In `pnpm dev`, check `/ts/prehled` as (a) a team member, (b) a coach without a team (no "Nové TS", no crash), in both themes.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(main\)/ts/prehled
git commit -m "feat(training-sessions): add Přehled page"
```

---

### Task 9: Create / edit form with slot prefill

**Files:**
- Create: `src/components/training-sessions/slot-chips.tsx` (+ `.test.tsx`), `session-form.tsx`, `src/app/(main)/ts/nova/page.tsx`, `src/app/(main)/ts/[id]/upravit/page.tsx`

**Interfaces:**
- Consumes: `getUpcomingTeamSlots`, `listTeamSlotSources`, `listRooms`, `listTeamMembers` from `@/lib/tymovy-denik/queries`, `pragueDateKey`, `formatDayHeading`, `formatTimeRange`, `pragueLocalToUtcISO`.
- Produces: `<SlotChips slots rooms onPick />`, `<SessionForm mode initial rooms teamMembers slots />` with `interface SessionFormValues { topic: string; description: string; date: string; startTime: string; endTime: string; roomId: string | null; locationNote: string; guestCapacity: number; facilitatorIds: string[] }`.

- [ ] **Step 1: Write failing test for slot chips**

```tsx
import { fireEvent, render, screen } from "@testing-library/react"

import { SlotChips } from "./slot-chips"

describe("SlotChips", () => {
  it("renders a chip per slot and reports the picked one", () => {
    const onPick = vi.fn()
    const slot = { dateKey: "2026-10-06", startsAt: "2026-10-06T06:00:00.000Z", endsAt: "2026-10-06T10:00:00.000Z", roomId: "r1" }
    render(<SlotChips slots={[slot]} rooms={[{ id: "r1", code: "E209", name: "E209" }]} onPick={onPick} />)
    fireEvent.click(screen.getByRole("button", { name: /Úterý 6\. října · 8:00–12:00 · E209/ }))
    expect(onPick).toHaveBeenCalledWith(slot)
  })

  it("renders nothing without slots", () => {
    const { container } = render(<SlotChips slots={[]} rooms={[]} onPick={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test:component -- slot-chips` — Expected: FAIL.

- [ ] **Step 3: Implement `slot-chips.tsx`**

```tsx
"use client"

import { formatDayHeading, formatTimeRange } from "@/lib/training-sessions/format"
import type { UpcomingSlot } from "@/lib/training-sessions/slots"

interface SlotChipsProps {
  slots: UpcomingSlot[]
  rooms: { id: string; code: string; name: string }[]
  onPick: (slot: UpcomingSlot) => void
}

export function SlotChips({ slots, rooms, onPick }: SlotChipsProps) {
  if (slots.length === 0) return null
  const roomCode = new Map(rooms.map((r) => [r.id, r.code]))
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Volné termíny podle rozvrhu týmu</p>
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <button
            key={slot.startsAt}
            type="button"
            onClick={() => onPick(slot)}
            className="rounded-full border px-3 py-1 text-sm transition-colors hover:bg-accent focus-ring"
          >
            {`${formatDayHeading(slot.startsAt)} · ${formatTimeRange(slot.startsAt, slot.endsAt)} · ${roomCode.get(slot.roomId) ?? ""}`}
          </button>
        ))}
      </div>
    </div>
  )
}
```

(Raw `<button>` is used here for a chip, matching `cteni-tab-bar` precedent; if the reviewer insists, swap to `Button variant="outline" size="sm" className="rounded-full"`. Prefer `Button` if it renders acceptably.)

- [ ] **Step 4: Implement `session-form.tsx`**

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { pragueLocalToUtcISO } from "@/lib/reservations/utils"
import { TS_LIMITS, TS_ROUTES } from "@/lib/training-sessions/constants"
import { formatTime, pragueDateKey } from "@/lib/training-sessions/format"
import type { UpcomingSlot } from "@/lib/training-sessions/slots"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"

import { SlotChips } from "./slot-chips"

const NO_ROOM = "none"

export interface SessionFormValues {
  topic: string
  description: string
  date: string
  startTime: string
  endTime: string
  roomId: string | null
  locationNote: string
  guestCapacity: number
  facilitatorIds: string[]
}

interface SessionFormProps {
  mode: { kind: "create" } | { kind: "edit"; id: string }
  initial: SessionFormValues
  rooms: { id: string; code: string; name: string }[]
  teamMembers: TeamMemberProfile[]
  slots: UpcomingSlot[]
}

function toHhMm(iso: string): string {
  return formatTime(iso).padStart(5, "0")
}

export function SessionForm({ mode, initial, rooms, teamMembers, slots }: SessionFormProps) {
  const router = useRouter()
  const [values, setValues] = useState(initial)
  const [pending, setPending] = useState(false)
  const set = <K extends keyof SessionFormValues>(key: K, value: SessionFormValues[K]) => setValues((v) => ({ ...v, [key]: value }))

  function pickSlot(slot: UpcomingSlot) {
    setValues((v) => ({ ...v, date: pragueDateKey(slot.startsAt), startTime: toHhMm(slot.startsAt), endTime: toHhMm(slot.endsAt), roomId: slot.roomId }))
  }

  function toggleFacilitator(id: string) {
    set("facilitatorIds", values.facilitatorIds.includes(id) ? values.facilitatorIds.filter((x) => x !== id) : [...values.facilitatorIds, id])
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    const payload = {
      topic: values.topic,
      description: values.description,
      startsAt: pragueLocalToUtcISO(values.date, values.startTime),
      endsAt: pragueLocalToUtcISO(values.date, values.endTime),
      roomId: values.roomId,
      locationNote: values.locationNote,
      guestCapacity: values.guestCapacity,
      facilitatorIds: values.facilitatorIds,
    }
    try {
      const res = await fetch(mode.kind === "create" ? "/api/training-sessions" : `/api/training-sessions/${mode.id}`, {
        method: mode.kind === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode.kind === "create" ? payload : { kind: "update", ...payload }),
      })
      const body = (await res.json().catch(() => ({}))) as { data?: { id: string }; error?: string }
      if (!res.ok || !body.data) {
        toast.error(body.error ?? "TS se nepodařilo uložit")
        return
      }
      toast.success(mode.kind === "create" ? "TS vytvořeno" : "TS uloženo")
      router.push(TS_ROUTES.detail(body.data.id))
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {mode.kind === "create" && <SlotChips slots={slots} rooms={rooms} onPick={pickSlot} />}

      <div className="space-y-1.5">
        <Label htmlFor="ts-topic">Téma</Label>
        <Input id="ts-topic" required maxLength={TS_LIMITS.topicMax} value={values.topic} onChange={(e) => set("topic", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ts-description">Krátký popis</Label>
        <Textarea id="ts-description" maxLength={TS_LIMITS.descriptionMax} value={values.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ts-date">Datum</Label>
          <Input id="ts-date" type="date" required value={values.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ts-start">Začátek</Label>
          <Input id="ts-start" type="time" required value={values.startTime} onChange={(e) => set("startTime", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ts-end">Konec</Label>
          <Input id="ts-end" type="time" required value={values.endTime} onChange={(e) => set("endTime", e.target.value)} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ts-room">Místnost</Label>
          <Select value={values.roomId ?? NO_ROOM} onValueChange={(v) => set("roomId", v === NO_ROOM ? null : v)}>
            <SelectTrigger id="ts-room"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ROOM}>Bez místnosti</SelectItem>
              {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ts-location">Poznámka k místu</Label>
          <Input id="ts-location" maxLength={TS_LIMITS.locationNoteMax} placeholder="např. venku, online" value={values.locationNote} onChange={(e) => set("locationNote", e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ts-capacity">Místa pro hosty z jiných týmů</Label>
        <Input id="ts-capacity" type="number" min={0} max={TS_LIMITS.guestCapacityMax} value={values.guestCapacity} onChange={(e) => set("guestCapacity", Number(e.target.value))} />
        <p className="text-xs text-muted-foreground">0 znamená, že TS je jen pro tým.</p>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Facilitace</legend>
        <div className="flex flex-wrap gap-2">
          {teamMembers.map((m) => (
            <Button key={m.id} type="button" size="sm" variant={values.facilitatorIds.includes(m.id) ? "default" : "outline"} aria-pressed={values.facilitatorIds.includes(m.id)} onClick={() => toggleFacilitator(m.id)}>
              {m.name ?? "Bez jména"}
            </Button>
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={pending}>{mode.kind === "create" ? "Vytvořit TS" : "Uložit změny"}</Button>
    </form>
  )
}
```

`formatTime` returns `8:00`; `padStart(5, "0")` gives `08:00` for `<input type="time">`.

- [ ] **Step 5: `nova/page.tsx`**

```tsx
import { redirect } from "next/navigation"

import { SessionForm } from "@/components/training-sessions/session-form"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { pragueDateKey } from "@/lib/training-sessions/format"
import { listRooms, listTeamSlotSources } from "@/lib/training-sessions/queries"
import { getUpcomingTeamSlots } from "@/lib/training-sessions/slots"
import { listTeamMembers } from "@/lib/tymovy-denik/queries"

export const metadata = {
  title: "Nové TS",
  description: "Naplánuj tréninkovou session svého týmu",
}

const DEFAULT_START = "08:00"
const DEFAULT_END = "12:00"

export default async function NewTsPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.team_id) redirect(TS_ROUTES.overview)
  const supabase = await createClient()
  const [sources, rooms, teamMembers] = await Promise.all([
    listTeamSlotSources(supabase, profile.team_id),
    listRooms(supabase),
    listTeamMembers(supabase, profile.team_id),
  ])
  const now = new Date()
  const slots = getUpcomingTeamSlots({
    schedules: sources.schedules,
    breaks: sources.breaks,
    takenDateKeys: sources.takenStarts.map(pragueDateKey),
    now,
  })

  return (
    <PageShell className="max-w-2xl">
      <PageHeader title="Nové TS" description="Naplánuj tréninkovou session svého týmu" back={{ href: TS_ROUTES.overview, label: "Přehled" }} />
      <SessionForm
        mode={{ kind: "create" }}
        initial={{ topic: "", description: "", date: pragueDateKey(now), startTime: DEFAULT_START, endTime: DEFAULT_END, roomId: null, locationNote: "", guestCapacity: 0, facilitatorIds: [] }}
        rooms={rooms}
        teamMembers={teamMembers}
        slots={slots}
      />
    </PageShell>
  )
}
```

Confirm `listTeamMembers(supabase, teamId)` returns `TeamMemberProfile[]` (`grep -n "export async function listTeamMembers" -A10 src/lib/tymovy-denik/queries.ts`).

- [ ] **Step 6: `[id]/upravit/page.tsx`**

```tsx
import { notFound, redirect } from "next/navigation"

import { SessionForm } from "@/components/training-sessions/session-form"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { formatTime, pragueDateKey } from "@/lib/training-sessions/format"
import { getSessionDetail, listRooms } from "@/lib/training-sessions/queries"
import { listTeamMembers } from "@/lib/tymovy-denik/queries"

export const metadata = {
  title: "Upravit TS",
  description: "Uprav termín, místo, facilitaci a místa pro hosty",
}

export default async function EditTsPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  const { id } = await params
  const supabase = await createClient()
  const session = await getSessionDetail(supabase, id)
  if (!session) notFound()
  if (session.team_id !== profile.team_id) redirect(TS_ROUTES.detail(id))
  const [rooms, teamMembers] = await Promise.all([listRooms(supabase), listTeamMembers(supabase, session.team_id)])
  const hhmm = (iso: string) => formatTime(iso).padStart(5, "0")

  return (
    <PageShell className="max-w-2xl">
      <PageHeader title="Upravit TS" description="Uprav termín, místo, facilitaci a místa pro hosty" back={{ href: TS_ROUTES.detail(id), label: session.topic }} />
      <SessionForm
        mode={{ kind: "edit", id }}
        initial={{
          topic: session.topic,
          description: session.description ?? "",
          date: pragueDateKey(session.starts_at),
          startTime: hhmm(session.starts_at),
          endTime: hhmm(session.ends_at),
          roomId: session.room_id,
          locationNote: session.location_note ?? "",
          guestCapacity: session.guest_capacity,
          facilitatorIds: session.facilitators.flatMap((f) => (f.profile ? [f.profile.id] : [])),
        }}
        rooms={rooms}
        teamMembers={teamMembers}
        slots={[]}
      />
    </PageShell>
  )
}
```

Known limitation (document in PR): the form uses one date for start and end, so a TS crossing midnight cannot be entered — acceptable for 4h daytime sessions.

- [ ] **Step 7: Run tests, typecheck, lint; manual check in both themes**

Run: `pnpm test && pnpm typecheck && pnpm lint` — Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/training-sessions src/app/\(main\)/ts/nova src/app/\(main\)/ts/\[id\]/upravit
git commit -m "feat(training-sessions): add create and edit form with schedule prefill"
```

---

### Task 10: Detail page — preparation, attendance, reflection, actions

**Files:**
- Create: `src/app/(main)/ts/[id]/page.tsx`, `src/components/training-sessions/session-detail-tabs.tsx`, `preparation-panel.tsx`, `reflection-panel.tsx`, `attendance-panel.tsx`, `session-actions-menu.tsx`

**Interfaces:**
- Consumes: `getSessionDetail`, `getReflection`, `listAttendance`, `listTeamMembers`, `TiptapEditor` (`initialContent`, `onChange(json, text)`, `placeholder`, `editable`), `TiptapRenderer` (`content`), `AttendanceSelector` (`teamMembers`, `value`, `onChange`, `disabled`), `EMPTY_DOC`.

- [ ] **Step 1: `preparation-panel.tsx`**

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { TiptapEditor } from "@/components/essays/tiptap-editor"
import { TiptapRenderer } from "@/components/essays/tiptap-renderer"
import { Button } from "@/components/ui/button"
import { EMPTY_DOC } from "@/lib/essays/content-text"

interface PreparationPanelProps {
  sessionId: string
  canEdit: boolean
  contentJson: object | null
  publishedAt: string | null
}

type PreparationAction = "draft" | "publish" | "unpublish"

const ACTION_TOASTS: Record<PreparationAction, string> = {
  draft: "Koncept uložen",
  publish: "Příprava je zveřejněná",
  unpublish: "Příprava je zpět v konceptu",
}

export function PreparationPanel({ sessionId, canEdit, contentJson, publishedAt }: PreparationPanelProps) {
  const router = useRouter()
  const [doc, setDoc] = useState<object>(contentJson ?? EMPTY_DOC)
  const [pending, setPending] = useState(false)

  if (!canEdit) {
    if (!contentJson) return <p className="text-sm text-muted-foreground">Příprava zatím nebyla zveřejněná.</p>
    return <TiptapRenderer content={contentJson} />
  }

  async function save(action: PreparationAction) {
    setPending(true)
    try {
      const res = await fetch(`/api/training-sessions/${sessionId}/preparation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentJson: doc, action }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(body.error ?? "Přípravu se nepodařilo uložit")
        return
      }
      toast.success(ACTION_TOASTS[action])
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{publishedAt ? "Zveřejněno, vidí ji všichni." : "Koncept, vidí ho jen tvůj tým."}</p>
      <TiptapEditor initialContent={doc} onChange={(json) => setDoc(json)} placeholder="Co si mají účastníci a účastnice připravit?" />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pending} onClick={() => void save("draft")}>Uložit koncept</Button>
        {publishedAt ? (
          <Button variant="outline" disabled={pending} onClick={() => void save("unpublish")}>Zrušit zveřejnění</Button>
        ) : (
          <Button disabled={pending} onClick={() => void save("publish")}>Zveřejnit</Button>
        )}
      </div>
    </div>
  )
}
```

Note: saving a draft on an already published preparation keeps it published (API keeps `published_at`); the "Uložit koncept" label should then read "Uložit změny" — change the label when `publishedAt` is set.

- [ ] **Step 2: `reflection-panel.tsx`**

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { TiptapEditor } from "@/components/essays/tiptap-editor"
import { Button } from "@/components/ui/button"
import { EMPTY_DOC } from "@/lib/essays/content-text"

interface ReflectionPanelProps {
  sessionId: string
  started: boolean
  contentJson: object | null
  lastEditor: string | null
  updatedAt: string | null
}

const UPDATED_FORMAT = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", dateStyle: "medium", timeStyle: "short" })

export function ReflectionPanel({ sessionId, started, contentJson, lastEditor, updatedAt }: ReflectionPanelProps) {
  const router = useRouter()
  const [doc, setDoc] = useState<object>(contentJson ?? EMPTY_DOC)
  const [pending, setPending] = useState(false)

  if (!started) return <p className="text-sm text-muted-foreground">Reflexi půjde psát po začátku TS.</p>

  async function save() {
    setPending(true)
    try {
      const res = await fetch(`/api/training-sessions/${sessionId}/reflection`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentJson: doc }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(body.error ?? "Reflexi se nepodařilo uložit")
        return
      }
      toast.success("Reflexe uložena")
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Co jsme se naučili? Co fungovalo a co bychom příště udělali jinak?</p>
      <TiptapEditor initialContent={doc} onChange={(json) => setDoc(json)} placeholder="Týmová reflexe…" />
      {updatedAt && (
        <p className="text-xs text-muted-foreground">Naposledy upraveno {UPDATED_FORMAT.format(new Date(updatedAt))}{lastEditor ? ` · ${lastEditor}` : ""}</p>
      )}
      <Button disabled={pending} onClick={() => void save()}>Uložit reflexi</Button>
    </div>
  )
}
```

Use `PRAGUE_TIME_ZONE` constant instead of the string literal.

- [ ] **Step 3: `attendance-panel.tsx`**

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"

import type { TeamActivityAttendeeInput } from "@/app/api/tymovy-denik/activities/_shared"
import { AttendanceSelector } from "@/components/tymovy-denik/attendance-selector"
import { Button } from "@/components/ui/button"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"

interface AttendancePanelProps {
  sessionId: string
  people: TeamMemberProfile[]
  initial: TeamActivityAttendeeInput[]
}

export function AttendancePanel({ sessionId, people, initial }: AttendancePanelProps) {
  const [value, setValue] = useState(initial)
  const [pending, setPending] = useState(false)

  async function save() {
    setPending(true)
    try {
      const res = await fetch(`/api/training-sessions/${sessionId}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendees: value }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) toast.error(body.error ?? "Docházku se nepodařilo uložit")
      else toast.success("Docházka uložena")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      <AttendanceSelector teamMembers={people} value={value} onChange={setValue} disabled={pending} />
      <Button disabled={pending} onClick={() => void save()}>Uložit docházku</Button>
    </div>
  )
}
```

- [ ] **Step 4: `session-actions-menu.tsx`**

```tsx
"use client"

import { MoreVertical } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog"
import { TS_ROUTES } from "@/lib/training-sessions/constants"

type ConfirmKind = "cancel" | "delete"

const CONFIRM_COPY: Record<ConfirmKind, { title: string; description: string; action: string }> = {
  cancel: { title: "Zrušit TS?", description: "TS zůstane v historii označené jako zrušené.", action: "Zrušit TS" },
  delete: { title: "Smazat TS?", description: "Použij jen pro TS vytvořené omylem. Zmizí ze všech přehledů.", action: "Smazat" },
}

export function SessionActionsMenu({ sessionId, cancelled }: { sessionId: string; cancelled: boolean }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null)

  async function run(kind: ConfirmKind | "restore") {
    const res = await fetch(`/api/training-sessions/${sessionId}`, {
      method: kind === "delete" ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: kind === "delete" ? undefined : JSON.stringify({ kind }),
    })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      toast.error(body.error ?? "Akci se nepodařilo dokončit")
      return
    }
    toast.success(kind === "cancel" ? "TS zrušeno" : kind === "restore" ? "TS obnoveno" : "TS smazáno")
    if (kind === "delete") router.push(TS_ROUTES.overview)
    router.refresh()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Další akce"><MoreVertical className="size-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild><Link href={TS_ROUTES.edit(sessionId)}>Upravit</Link></DropdownMenuItem>
          {cancelled ? (
            <DropdownMenuItem onSelect={() => void run("restore")}>Obnovit</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setConfirm("cancel")}>Zrušit TS</DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete")}>Smazat</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveAlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        {confirm && (
          <ResponsiveAlertDialogContent>
            <ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogTitle>{CONFIRM_COPY[confirm].title}</ResponsiveAlertDialogTitle>
              <ResponsiveAlertDialogDescription>{CONFIRM_COPY[confirm].description}</ResponsiveAlertDialogDescription>
            </ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogFooter>
              <ResponsiveAlertDialogCancel>Zpět</ResponsiveAlertDialogCancel>
              <ResponsiveAlertDialogAction onClick={() => void run(confirm)}>{CONFIRM_COPY[confirm].action}</ResponsiveAlertDialogAction>
            </ResponsiveAlertDialogFooter>
          </ResponsiveAlertDialogContent>
        )}
      </ResponsiveAlertDialog>
    </>
  )
}
```

Check `DropdownMenuItem` supports `variant="destructive"` in this repo; otherwise use the class DESIGN.md prescribes.

- [ ] **Step 5: `session-detail-tabs.tsx`**

```tsx
"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TS_DETAIL_TABS, type TsDetailTab } from "@/lib/training-sessions/constants"

const TAB_LABELS: Record<TsDetailTab, string> = {
  prehled: "Přehled",
  priprava: "Příprava",
  dochazka: "Docházka",
  reflexe: "Reflexe",
}

interface SessionDetailTabsProps {
  panels: Partial<Record<TsDetailTab, ReactNode>>
}

export function SessionDetailTabs({ panels }: SessionDetailTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const available = TS_DETAIL_TABS.filter((t) => panels[t] !== undefined)
  const requested = searchParams.get("tab") as TsDetailTab | null
  const active = requested && available.includes(requested) ? requested : available[0]

  return (
    <Tabs value={active} onValueChange={(tab) => router.replace(`${pathname}?tab=${tab}`, { scroll: false })}>
      <TabsList>
        {available.map((t) => <TabsTrigger key={t} value={t}>{TAB_LABELS[t]}</TabsTrigger>)}
      </TabsList>
      {available.map((t) => <TabsContent key={t} value={t} className="mt-4">{panels[t]}</TabsContent>)}
    </Tabs>
  )
}
```

- [ ] **Step 6: `[id]/page.tsx`**

```tsx
import { MapPin, Users } from "lucide-react"
import { notFound, redirect } from "next/navigation"

import { AttendancePanel } from "@/components/training-sessions/attendance-panel"
import { FeedRefresher } from "@/components/training-sessions/feed-refresher"
import { GuestJoinButton } from "@/components/training-sessions/guest-join-button"
import { PreparationPanel } from "@/components/training-sessions/preparation-panel"
import { ReflectionPanel } from "@/components/training-sessions/reflection-panel"
import { SessionActionsMenu } from "@/components/training-sessions/session-actions-menu"
import { SessionDetailTabs } from "@/components/training-sessions/session-detail-tabs"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { formatDayHeading, formatTimeRange } from "@/lib/training-sessions/format"
import { getReflection, getSessionDetail, listAttendance } from "@/lib/training-sessions/queries"
import { getSessionStatus } from "@/lib/training-sessions/status"
import { toTiming } from "@/lib/training-sessions/types"
import { listTeamMembers } from "@/lib/tymovy-denik/queries"

export const metadata = {
  title: "Detail TS",
  description: "Téma, příprava, docházka a týmová reflexe tréninkové session",
}

export default async function TsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  const { id } = await params
  const supabase = await createClient()
  const session = await getSessionDetail(supabase, id)
  if (!session) notFound()

  const now = new Date()
  const status = getSessionStatus(toTiming(session), now)
  const isOwnTeam = profile.team_id !== null && profile.team_id === session.team_id
  const joined = session.guests.some((g) => g.profile_id === profile.id)
  const location = session.room?.code ?? session.location_note
  const facilitatorNames = session.facilitators.map((f) => f.profile?.name).filter(Boolean).join(", ")

  const overview = (
    <div className="space-y-3 text-sm">
      {session.description && <p className="whitespace-pre-line">{session.description}</p>}
      <p className="inline-flex items-center gap-1.5 text-muted-foreground"><Users className="size-4" aria-hidden />Místa pro jiné týmy: {session.guests.length}/{session.guest_capacity}</p>
      {session.guests.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {session.guests.map((g) => <li key={g.profile_id}><Badge variant="secondary">{g.profile?.name ?? "Bez jména"}</Badge></li>)}
        </ul>
      )}
      {!isOwnTeam && status === "upcoming" && session.guest_capacity > 0 && (joined || session.guests.length < session.guest_capacity) && (
        <GuestJoinButton sessionId={session.id} joined={joined} conflictText={null} />
      )}
    </div>
  )

  const panels: Parameters<typeof SessionDetailTabs>[0]["panels"] = {
    prehled: overview,
    priprava: (
      <PreparationPanel
        sessionId={session.id}
        canEdit={isOwnTeam}
        contentJson={(session.preparation?.content_json as object | null) ?? null}
        publishedAt={session.preparation?.published_at ?? null}
      />
    ),
  }

  if (isOwnTeam) {
    const [members, attendance, reflection] = await Promise.all([
      listTeamMembers(supabase, session.team_id),
      listAttendance(supabase, session.id),
      getReflection(supabase, session.id),
    ])
    const guestPeople = session.guests.flatMap((g) => (g.profile ? [{ id: g.profile.id, name: g.profile.name, picture: g.profile.picture, role: "student" }] : []))
    panels.dochazka = (
      <AttendancePanel
        sessionId={session.id}
        people={[...members, ...guestPeople]}
        initial={attendance.map((a) => ({ profileId: a.profile_id, status: a.status }))}
      />
    )
    panels.reflexe = (
      <ReflectionPanel
        sessionId={session.id}
        started={status !== "upcoming"}
        contentJson={(reflection?.content_json as object | null) ?? null}
        lastEditor={(reflection?.updated_by as { name: string | null } | null)?.name ?? null}
        updatedAt={reflection?.updated_at ?? null}
      />
    )
  }

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title={session.topic}
        description={`${session.team?.name ?? ""} · ${formatDayHeading(session.starts_at)} · ${formatTimeRange(session.starts_at, session.ends_at)}`}
        back={{ href: TS_ROUTES.discover, label: "Objevovat" }}
        action={isOwnTeam ? <SessionActionsMenu sessionId={session.id} cancelled={status === "cancelled"} /> : undefined}
      />
      <FeedRefresher />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {status === "cancelled" && <Badge variant="destructive">Zrušeno</Badge>}
        {location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{location}</span>}
        {facilitatorNames && <span>Facilitace: {facilitatorNames}</span>}
      </div>
      <SessionDetailTabs panels={panels} />
    </PageShell>
  )
}
```

The `PageHeader` description rule (≤ ~90 chars, no trailing period) is satisfied by the dynamic string; `metadata.description` differs by necessity (dynamic) — acceptable, or switch to `generateMetadata` returning the same string.

`SessionDetailTabs` uses `useSearchParams`; wrap it in `<Suspense>` if Next complains at build time.

- [ ] **Step 7: Typecheck, lint, test, manual check**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build` — Expected: PASS. In `pnpm dev`: as a team member create → write preparation → save draft → publish; as another team's member see the published preparation, no Docházka/Reflexe tabs. Both themes, 375 px width.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(main\)/ts/\[id\] src/components/training-sessions
git commit -m "feat(training-sessions): add detail page with preparation, attendance and reflection"
```

---

### Task 11: End-to-end flow

**Files:**
- Create: `tests/e2e/training-sessions.spec.ts`

**Interfaces:**
- Consumes fixtures from `tests/e2e/fixtures/auth.ts`: `createTestTeam(onboardingYear?, name?)`, `getSetupSessionCookie(teamId)` → `{ cookie, profileId }`, `grantBetaAccess(profileId)`, `setBetaCohort(profileId, "B")`, `setAuthCookie(context, cookie)`, `cleanupTestData()`. Read their exact signatures first (`sed -n 140,360p tests/e2e/fixtures/auth.ts`); if `cleanupTestData` doesn't delete `training_sessions` rows for test teams, add them (FK cascade from `teams` covers it if teams are deleted).

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from "@playwright/test"

import {
  cleanupTestData,
  createTestTeam,
  getSetupSessionCookie,
  grantBetaAccess,
  setAuthCookie,
  setBetaCohort,
} from "./fixtures/auth"

test.describe("training sessions", () => {
  let hostCookie: string
  let guestCookie: string

  test.beforeAll(async () => {
    const hostTeam = await createTestTeam(1, `E2E TS host ${Date.now()}`)
    const guestTeam = await createTestTeam(2, `E2E TS guest ${Date.now()}`)
    const host = await getSetupSessionCookie(hostTeam)
    const guest = await getSetupSessionCookie(guestTeam)
    for (const user of [host, guest]) {
      await grantBetaAccess(user.profileId)
      await setBetaCohort(user.profileId, "B")
    }
    hostCookie = host.cookie
    guestCookie = guest.cookie
  })

  test.afterAll(async () => {
    await cleanupTestData()
  })

  test("host creates and publishes, guest joins, host records attendance and reflection", async ({ browser }) => {
    const topic = `E2E TS ${Date.now()}`
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const hostContext = await browser.newContext()
    await setAuthCookie(hostContext, hostCookie)
    const host = await hostContext.newPage()
    await host.goto("/ts/nova")
    await host.getByLabel("Téma").fill(topic)
    await host.getByLabel("Datum").fill(tomorrow)
    await host.getByLabel("Začátek").fill("08:00")
    await host.getByLabel("Konec").fill("12:00")
    await host.getByLabel("Místa pro hosty z jiných týmů").fill("2")
    await host.getByRole("button", { name: "Vytvořit TS" }).click()
    await expect(host.getByRole("heading", { name: topic })).toBeVisible()
    const detailUrl = host.url()

    await host.getByRole("tab", { name: "Příprava" }).click()
    await host.locator(".ProseMirror").fill("Přečtěte si článek o AI")
    await host.getByRole("button", { name: "Zveřejnit" }).click()
    await expect(host.getByText("Příprava je zveřejněná").first()).toBeVisible()

    const guestContext = await browser.newContext()
    await setAuthCookie(guestContext, guestCookie)
    const guest = await guestContext.newPage()
    await guest.goto(`/ts/objevovat?q=${encodeURIComponent(topic)}`)
    const card = guest.locator("article", { hasText: topic })
    await expect(card.getByText("0/2 míst")).toBeVisible()
    await card.getByRole("button", { name: "Přihlásit se" }).click()
    await expect(card.getByText("1/2 míst")).toBeVisible()

    await guest.goto(detailUrl)
    await guest.getByRole("tab", { name: "Příprava" }).click()
    await expect(guest.getByText("Přečtěte si článek o AI")).toBeVisible()
    await expect(guest.getByRole("tab", { name: "Reflexe" })).toHaveCount(0)

    await host.reload()
    await host.getByRole("tab", { name: "Docházka" }).click()
    await host.getByRole("button", { name: "Všichni" }).click()
    await host.getByRole("button", { name: "Uložit docházku" }).click()
    await expect(host.getByText("Docházka uložena")).toBeVisible()

    await hostContext.close()
    await guestContext.close()
  })
})
```

Reflection requires a started TS; cover it by adding a second test that seeds a past TS via the service-role helper used in fixtures (follow `seedTeamActivity`'s pattern to add `seedTrainingSession(teamId, profileId, { startsAt, endsAt })` to `fixtures/auth.ts`), then opens `?tab=reflexe`, types into `.ProseMirror`, clicks "Uložit reflexi", expects toast "Reflexe uložena".

- [ ] **Step 2: Run E2E**

Run: `pnpm test:e2e -- training-sessions`
Expected: PASS. Fix selectors against the real UI rather than loosening assertions.

- [ ] **Step 3: Full verification**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm test:integration && pnpm build`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e
git commit -m "test(training-sessions): add end-to-end flow"
```

---

## Self-Review Notes

- **Spec coverage:** schema/RLS (T1), RPCs/search/triggers/realtime (T3), status/conflicts/slots (T4), API incl. capacity guard & error codes (T5–6), Objevovat with filters/search/ročník/overlap/live (T7), Přehled sections incl. facilitating nudge & missing reflections (T8), create/edit + prefill (T9), detail tabs/prep draft-publish/attendance incl. guests/reflection after start/cancel-restore-delete (T10), nav + cohort gate + spotlight (T2, T7), tests per layer (T1, T3, T4, T5, T7, T9, T11).
- **Deviation from spec:** the last-seat race test is replaced by sequential capacity tests + reviewer check of `FOR UPDATE` (see Review Focus 5) because `withRollback()` cannot share uncommitted rows across connections.
- **Copy:** every user-facing Czech string was checked for generic masculine and uses neutral wording.
