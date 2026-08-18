# Týmový deník Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Týmový deník (Team Activity Feed) — a chronological team-activity log the team fills in whenever a shared team activity happens (Cabin in the Woods, Learning Circus, any formal/informal team event). Issue #56.

**Architecture:** New `team_activities` DB table (Drizzle schema, team-member RLS). Single server page at `/tymovy-denik` fetches activities; client components render a date-descending, month-grouped feed with create/edit dialogs and soft delete. Pattern follows `tymova-reflexe` end-to-end.

**Fields (per issue #56):** Datum, Typ akce, Účast, Proč jsme tam byli, Co jsme si odnesli? / Reflexe.

**Scope decisions:**
- Free-text `activity_type` (matches the open-ended legacy sheet — enum would need migration per new type).
- No realtime, no comments/reactions — future phase (issue proposal lists them as ideas; Quick Win phase = simple CRUD feed).
- No detail page — create/edit happen in dialogs on the list page.

**Tech Stack:** Next.js 16, Supabase, Drizzle ORM (schema only), shadcn/ui, Tailwind CSS 4, Vitest, Playwright

**Reference feature:**
- `docs/plans/2026-07-28-tymova-reflexe-plan.md` (task template)
- `db/schema/team-reflections.ts` (schema template)
- `src/lib/tymova-reflexe/*` (types + queries template)
- `src/components/customer-meetings/customer-meeting-list.tsx` (month-grouping pattern)
- `tests/integration/individual-coaching-sessions.int.test.ts` (RLS test template)
- `tests/e2e/tymova-reflexe.spec.ts` + `tests/e2e/fixtures/auth.ts` (E2E template)

---

### Task 1: Database Schema — `team_activities` table

**Files:**
- Create: `db/schema/team-activities.ts`
- Reference existing: `db/schema/team-reflections.ts` (exact same pattern)

**Step 1: Create schema file**

```ts
import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, date, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { teams } from "./teams"
import { profiles } from "./profiles"

export const teamActivities = pgTable("team_activities", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  teamId: uuid("team_id").notNull(),
  occurredAt: date("occurred_at").notNull(),
  activityType: text("activity_type").notNull(),
  participants: text("participants"),
  reason: text("reason"),
  reflection: text("reflection"),
  removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  index("team_activities_team_occurred_at_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops"), table.occurredAt.asc().nullsLast().op("date_ops")),
  foreignKey({
    columns: [table.teamId],
    foreignColumns: [teams.id],
    name: "team_activities_team_id_fkey"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.createdByProfileId],
    foreignColumns: [profiles.id],
    name: "team_activities_created_by_profile_id_fkey"
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.updatedByProfileId],
    foreignColumns: [profiles.id],
    name: "team_activities_updated_by_profile_id_fkey"
  }).onDelete("restrict"),
  pgPolicy("Team members can view activities", { as: "permissive", for: "select", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
  pgPolicy("Team members can create activities", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
  pgPolicy("Team members can update activities", { as: "permissive", for: "update", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`, withCheck: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
  pgPolicy("Team members can delete activities", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)` }),
]).enableRLS()
```

Note: `db/schema/` has no `index.ts` — drizzle-kit reads the whole directory, so no registration needed.

**Step 2: Generate + apply migration with the user**

Per AGENTS.md: schema edits are applied via `pnpm db:migrate` (generate → db:up → types → export). The user must run this. Ask the user to run `pnpm db:migrate` and to check the generated SQL in `supabase/migrations/` for any unintended DROPs before it applies.

Run: `pnpm db:migrate`
Expected: new `supabase/migrations/YYYYMMDDHHMMSS_*.sql` containing `create table "public"."team_activities"`, plus regenerated `src/lib/supabase/database.types.ts` with `team_activities` row shape + `team_activities` object.

Verify manually:
- `grep -rn "team_activities" src/lib/supabase/database.types.ts` → present
- `grep -n "drop" $(ls -t supabase/migrations/*.sql | head -1)` → no unexpected drops

**Step 3: Commit**

```bash
git add db/schema/team-activities.ts supabase/migrations/ src/lib/supabase/database.types.ts
git commit -m "feat(db): add team_activities table"
```

---
### Task 2: Types + Queries

**Files:**
- Create: `src/lib/tymovy-denik/types.ts`
- Create: `src/lib/tymovy-denik/queries.ts`

**Step 1: Create types**

```ts
import type { Tables } from "@/lib/supabase/tables"
import type { Profile } from "@/lib/auth-helpers"

export type TeamActivity = Tables<"team_activities">

export interface TeamActivityWithCreator extends TeamActivity {
  created_by: Pick<Profile, "id" | "name" | "picture"> | null
  updated_by: Pick<Profile, "id" | "name" | "picture"> | null
}

export const ACTIVITY_WITH_CREATOR_SELECT =
  "*, created_by:profiles!created_by_profile_id(id, name, picture), updated_by:profiles!updated_by_profile_id(id, name, picture)"

export const EDITABLE_ACTIVITY_FIELDS = [
  "occurred_at",
  "activity_type",
  "participants",
  "reason",
  "reflection",
] as const

export type EditableActivityField = (typeof EDITABLE_ACTIVITY_FIELDS)[number]
```

**Step 2: Create queries**

```ts
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { TeamActivityWithCreator } from "./types"
import { ACTIVITY_WITH_CREATOR_SELECT } from "./types"

export async function listTeamActivities(
  supabase: SupabaseClient<Database>,
  teamId: string,
): Promise<TeamActivityWithCreator[]> {
  const { data, error } = await supabase
    .from("team_activities")
    .select(ACTIVITY_WITH_CREATOR_SELECT)
    .is("removed_at", null)
    .eq("team_id", teamId)
    .order("occurred_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as TeamActivityWithCreator[]
}

export async function getTeamActivityById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<TeamActivityWithCreator | null> {
  const { data, error } = await supabase
    .from("team_activities")
    .select(ACTIVITY_WITH_CREATOR_SELECT)
    .is("removed_at", null)
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  return data as TeamActivityWithCreator | null
}
```

**Step 3: Commit**

```bash
git add src/lib/tymovy-denik/
git commit -m "feat: add team activity types and queries"
```

---

### Task 3: Format helpers + unit test (TDD)

**Files:**
- Create: `src/lib/tymovy-denik/format.ts`
- Test: `src/lib/tymovy-denik/format.test.ts`

Pure, co-located helpers for date rendering and month grouping. Kept here (not in components) so the grouping logic the list uses is unit-testable.

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import {
  formatActivityDate,
  getActivityMonthKey,
  getActivityMonthLabel,
} from "./format"

describe("team activity format helpers", () => {
  it("formats a date as day. month. year", () => {
    expect(formatActivityDate("2026-03-12")).toBe("12. 3. 2026")
  })

  it("builds a YYYY-MM month key from a date", () => {
    expect(getActivityMonthKey("2026-03-12")).toBe("2026-03")
  })

  it("labels a month key in Czech", () => {
    expect(getActivityMonthLabel("2026-03")).toBe("Březen 2026")
  })

  it("sorts month keys lexicographically ascending", () => {
    expect("2026-02".localeCompare("2026-10")).toBeLessThan(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project unit src/lib/tymovy-denik/format.test.ts`
Expected: FAIL — module `./format` not found.

**Step 3: Write minimal implementation**

```ts
const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

export function formatActivityDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${Number(day)}. ${Number(month)}. ${year}`
}

export function getActivityMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

export function getActivityMonthLabel(key: string): string {
  const [year, month] = key.split("-")
  return `${MONTH_LABELS[Number(month) - 1]} ${year}`
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project unit src/lib/tymovy-denik/format.test.ts`
Expected: PASS (all 4 tests green).

**Step 5: Commit**

```bash
git add src/lib/tymovy-denik/format.ts src/lib/tymovy-denik/format.test.ts
git commit -m "feat: add team activity date format helpers"
```

---

### Task 4: Server Page — `/tymovy-denik`

**Files:**
- Create: `src/app/(main)/tymovy-denik/page.tsx`

**Step 1: Create page**

```tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listTeamActivities } from "@/lib/tymovy-denik/queries"
import { TeamActivityList } from "@/components/tymovy-denik/team-activity-list"
import { InfoCard } from "@/components/tymovy-denik/info-card"
import { PageHeader } from "@/components/ui/page-header"

export const metadata = {
  title: "Týmový deník | Tappka",
  description: "Chronologický záznam týmových akcí",
}

export default async function TymovyDenikPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")
  if (!profile.team_id) redirect("/")

  const activities = await listTeamActivities(supabase, profile.team_id)

  return (
    <div className="container mx-auto max-w-5xl py-4 sm:py-6 px-3 sm:px-6 space-y-4 sm:space-y-6">
      <PageHeader
        title="Týmový deník"
        description="Chronologický záznam týmových akcí, při kterých jsme trávili čas společně mimo pracovní prostředí."
        count={{ value: activities.length, label: "akcí" }}
      />
      <InfoCard />
      <TeamActivityList activities={activities} teamId={profile.team_id} profileId={profile.id} />
    </div>
  )
}
```

Note: `pluralizeCz(["akce", "akcí", "akcí"])` is used by `PageHeader` internally — pass `label: "akcí"` matching the count structure used elsewhere (see `pluralize-cz.ts`; singular/plural form follows the existing convention).

Check the plural tuple by reading `PageHeader`/`pluralizeCz` usage first — the `count.label` is the plural label displayed. Keep `"akcí"`.

**Step 2: Commit**

```bash
git add src/app/(main)/tymovy-denik/
git commit -m "feat: add team activity page route"
```

---

### Task 5: InfoCard component

**Files:**
- Create: `src/components/tymovy-denik/info-card.tsx`

**Step 1: Create InfoCard** (copy adapted from the xlsx tab intro; gender-neutral per DESIGN.md "Czech copy")

```tsx
import { Info } from "lucide-react"

export function InfoCard() {
  return (
    <div className="flex gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
      <div className="space-y-1">
        <p>
          <strong>Týmový deník</strong> je chronologický záznam společných aktivit, při kterých tým
          tráví čas mimo pracovní prostředí. Takové akce budují soudržnost týmu, posilují spolupráci
          a tím i týmovou kulturu.
        </p>
        <p>
          Zaznamenávejte všechny společné aktivity — Cabin in the Woods, Learning Circus i formální
          či neformální akce. Deník vyplňujte průběžně, ať jsou informace aktuální a dostupné pro
          budoucí reflexe.
        </p>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/tymovy-denik/info-card.tsx
git commit -m "feat: add team activity info card"
```

---
### Task 6: Team Activity Form

**Files:**
- Create: `src/components/tymovy-denik/team-activity-form.tsx`

Create/edit dialog form. Controlled `useState` + manual validation (matching `customer-meeting-form.tsx` / the reflexe form — the app does not use react-hook-form/zod in features).

**Step 1: Create form component**

```tsx
"use client"

import { useState } from "react"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type { TeamActivity, TeamActivityWithCreator } from "@/lib/tymovy-denik/types"
import { ACTIVITY_WITH_CREATOR_SELECT } from "@/lib/tymovy-denik/types"

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

interface TeamActivityFormProps {
  teamId: string
  profileId: string
  initial?: TeamActivity
  onSuccess: (activity: TeamActivityWithCreator) => void
  onCancel: () => void
}

export function TeamActivityForm({ teamId, profileId, initial, onSuccess, onCancel }: TeamActivityFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [occurredAt, setOccurredAt] = useState(initial?.occurred_at ?? today())
  const [activityType, setActivityType] = useState(initial?.activity_type ?? "")
  const [participants, setParticipants] = useState(initial?.participants ?? "")
  const [reason, setReason] = useState(initial?.reason ?? "")
  const [reflection, setReflection] = useState(initial?.reflection ?? "")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!occurredAt) {
      setError("Zadejte datum akce.")
      return
    }
    if (!activityType.trim()) {
      setError("Zadejte typ akce.")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const base = {
        team_id: teamId,
        occurred_at: occurredAt,
        activity_type: activityType.trim(),
        participants: participants.trim() || null,
        reason: reason.trim() || null,
        reflection: reflection.trim() || null,
        updated_by_profile_id: profileId,
      }

      let data: TeamActivityWithCreator
      if (initial?.id) {
        const result = await supabase
          .from("team_activities")
          .update(base)
          .eq("id", initial.id)
          .select(ACTIVITY_WITH_CREATOR_SELECT)
          .single()
        if (result.error) throw result.error
        data = result.data as TeamActivityWithCreator
        toast.success("Akce aktualizována")
      } else {
        const result = await supabase
          .from("team_activities")
          .insert({ ...base, created_by_profile_id: profileId })
          .select(ACTIVITY_WITH_CREATOR_SELECT)
          .single()
        if (result.error) throw result.error
        data = result.data as TeamActivityWithCreator
        toast.success("Akce přidána")
      }

      onSuccess(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznámá chyba")
      toast.error("Nepodařilo se uložit akci")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="occurred-at">Datum</Label>
        <Input
          id="occurred-at"
          type="date"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="activity-type">Typ akce</Label>
        <Input
          id="activity-type"
          value={activityType}
          onChange={(e) => setActivityType(e.target.value)}
          placeholder="Např. Cabin in the Woods, Learning Circus, team building"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="participants">Účast</Label>
        <Input
          id="participants"
          value={participants}
          onChange={(e) => setParticipants(e.target.value)}
          placeholder="Kdo se zúčastnil — např. celý tým, jména"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Proč jsme tam byli</Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Cíl akce, co jsme chtěli zjistit nebo vyřešit"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reflection">Co jsme si odnesli? (reflexe)</Label>
        <Textarea
          id="reflection"
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="Přínos, postřeh nebo poučení z akce"
          rows={3}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          <X className="size-4" />
          Zrušit
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {initial?.id ? "Uložit změny" : "Přidat akci"}
        </Button>
      </div>
    </form>
  )
}
```

Note on copy: label `Co jsme si odnesli? (reflexe)` intentionally keeps the past-tense meaning (a reflection on what was gained); per DESIGN.md this is the colon-pair case only when "past" is required — consider `Co jsme si odnesli:y? / Reflexe` if a stricter audit is wanted. The parens `(reflexe)` are allowed here (parenthetical addendum, not a gender pair), but prefer removing them: label `Co jsme si odnesli?` with the reflection idea visible in the placeholder. If changed, update the E2E test label references in Task 11 accordingly.

**Step 2: Commit**

```bash
git add src/components/tymovy-denik/team-activity-form.tsx
git commit -m "feat: add team activity form"
```

---
### Task 7: Team Activity Card

**Files:**
- Create: `src/components/tymovy-denik/team-activity-card.tsx`

Displays one activity, with edit (dialog) and delete (AlertDialog soft-delete) actions.

**Step 1: Create card component**

```tsx
"use client"

import { useState } from "react"
import { Pencil, Trash2, CalendarDays, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { TeamActivityForm } from "./team-activity-form"
import { formatActivityDate } from "@/lib/tymovy-denik/format"
import type { TeamActivityWithCreator } from "@/lib/tymovy-denik/types"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{children}</p>
    </div>
  )
}

interface TeamActivityCardProps {
  activity: TeamActivityWithCreator
  teamId: string
  profileId: string
  onUpdated: (activity: TeamActivityWithCreator) => void
  onDeleted: (id: string) => void
}

export function TeamActivityCard({
  activity,
  teamId,
  profileId,
  onUpdated,
  onDeleted,
}: TeamActivityCardProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("team_activities")
        .update({ removed_at: new Date().toISOString() })
        .eq("id", activity.id)
      if (error) throw error
      toast.success("Akce odstraněna")
      onDeleted(activity.id)
    } catch {
      toast.error("Nepodařilo se odstranit akci")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="p-3 sm:p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-semibold text-sm">{formatActivityDate(activity.occurred_at)}</span>
          <span className="text-sm text-muted-foreground">· {activity.activity_type}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Pencil className="size-4" />
                <span className="hidden sm:inline">Upravit</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upravit akci</DialogTitle>
              </DialogHeader>
              <TeamActivityForm
                teamId={teamId}
                profileId={profileId}
                initial={activity}
                onSuccess={(updated) => {
                  setEditOpen(false)
                  onUpdated(updated)
                }}
                onCancel={() => setEditOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="size-4" />
                <span className="hidden sm:inline">Smazat</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Odstranit akci?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tuto akci ({formatActivityDate(activity.occurred_at)} — {activity.activity_type}) odeberete z deníku.
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
      </div>

      <div className="border-t pt-4 space-y-4">
        {activity.participants && (
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <Field label="Účast">{activity.participants}</Field>
          </div>
        )}
        {activity.reason && <Field label="Proč jsme tam byli">{activity.reason}</Field>}
        {activity.reflection && <Field label="Co jsme si odnesli?">{activity.reflection}</Field>}
      </div>

      {activity.created_by && (
        <div className="border-t pt-3 text-xs text-muted-foreground">
          Vytvořil:la: {activity.created_by.name}
        </div>
      )}
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/tymovy-denik/team-activity-card.tsx
git commit -m "feat: add team activity card"
```

---

### Task 8: Team Activity List

**Files:**
- Create: `src/components/tymovy-denik/team-activity-list.tsx`

Client list: create dialog + Empty state + month-grouped feed (descending). Grouping helpers come from `src/lib/tymovy-denik/format`.

**Step 1: Create list component**

```tsx
"use client"

import { useMemo, useState } from "react"
import { Plus, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog"
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { TeamActivityForm } from "./team-activity-form"
import { TeamActivityCard } from "./team-activity-card"
import { getActivityMonthKey, getActivityMonthLabel } from "@/lib/tymovy-denik/format"
import type { TeamActivityWithCreator } from "@/lib/tymovy-denik/types"

interface TeamActivityListProps {
  activities: TeamActivityWithCreator[]
  teamId: string
  profileId: string
}

export function TeamActivityList({ activities, teamId, profileId }: TeamActivityListProps) {
  const [items, setItems] = useState(activities)
  const [createOpen, setCreateOpen] = useState(false)

  const grouped = useMemo(() => {
    const map = new Map<string, TeamActivityWithCreator[]>()
    for (const activity of items) {
      const key = getActivityMonthKey(activity.occurred_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(activity)
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, group]) => ({ key, label: getActivityMonthLabel(key), activities: group }))
  }, [items])

  function handleCreated(activity: TeamActivityWithCreator) {
    setItems((prev) =>
      [...prev, activity].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    )
    setCreateOpen(false)
  }

  function handleUpdated(activity: TeamActivityWithCreator) {
    setItems((prev) => prev.map((a) => (a.id === activity.id ? activity : a)))
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Nová akce
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nová týmová akce</DialogTitle>
            </DialogHeader>
            <TeamActivityForm
              teamId={teamId}
              profileId={profileId}
              onSuccess={handleCreated}
              onCancel={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <CalendarDays className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Žádné akce</EmptyTitle>
            <EmptyDescription>
              Zatím není v deníku žádný záznam. Přidejte první společnou akci.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="size-4" />
                  Přidat akci
                </Button>
              </DialogTrigger>
            </Dialog>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.key} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label} · {group.activities.length}
              </h2>
              <div className="space-y-4">
                {group.activities.map((activity) => (
                  <TeamActivityCard
                    key={activity.id}
                    activity={activity}
                    teamId={teamId}
                    profileId={profileId}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/tymovy-denik/team-activity-list.tsx
git commit -m "feat: add team activity list"
```

---
### Task 9: Sidebar Navigation

**Files:**
- Modify: `src/components/app-sidebar.tsx`

Mirror the existing "Týmová reflexe" beta-gated nav item.

**Step 1: Add the nav item**

1. Add `Activity` to the lucide-react icon import block at the top:
   ```tsx
   import { LayoutDashboard, CalendarDays, Users, Mail, Database, ChevronRight, Heart, BookOpen, Handshake, GraduationCap, NotebookPen, Activity } from "lucide-react"
   ```

2. Add an item to the "Hlavní" group in `getNavData`, after "Týmová reflexe" (around line 98):
   ```tsx
   {
     title: "Týmový deník",
     url: "/tymovy-denik",
     icon: Activity,
   },
   ```

3. Add the active-state const next to `isTymovaReflexeActive` (line ~149):
   ```tsx
   const isTymovyDenikActive = pathname.startsWith("/tymovy-denik")
   ```

4. Add the beta-gated render block, after the "Týmová reflexe" block (around line 312):
   ```tsx
   // Týmový deník — beta-only
   if (item.title === "Týmový deník") {
     if (!isBeta) return null

     return (
       <SidebarMenuItem key={item.title}>
         <SidebarMenuButton
           asChild
           isActive={isTymovyDenikActive}
           tooltip={item.title}
         >
           <Link href={item.url} onClick={closeSidebarOnMobile}>
             <item.icon className="size-4" />
             <span>{item.title}</span>
             <Badge
               variant="secondary"
               className="ml-auto h-5 text-[10px] px-1.5"
             >
               Beta
             </Badge>
           </Link>
         </SidebarMenuButton>
       </SidebarMenuItem>
     )
   }
   ```

**Step 2: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat: add team diary sidebar entry"
```

---

### Task 10: Integration Test — RLS on `team_activities`

**Files:**
- Create: `tests/integration/team-activities.int.test.ts`
- Reference: `tests/integration/individual-coaching-sessions.int.test.ts`

Verifies team-member RLS allow/deny + soft-delete + FK cascade for the new table. Seeding must create two auth users, two profiles on the **same team**, plus a third profile on a **different team** — reusing the seeding pattern below (adapt the email suffixes to be unique per test run to avoid collisions with other tests).

**Step 1: Create the test**

```ts
import { describe, expect, it } from "vitest"
import { withRollback } from "@/tests/setup/tx"
import { insertAuthUser } from "@/tests/setup/factories"
import { asClaims } from "@/tests/setup/rls"
import type { PoolClient } from "pg"

async function seed(client: PoolClient) {
  const memberAuth = await insertAuthUser(client)
  const outsiderAuth = await insertAuthUser(client)

  const { rows: memberUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [memberAuth.id],
  )
  const { rows: outsiderUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [outsiderAuth.id],
  )

  await client.query(
    "update public.users set verified_work_email = google_email, verified_work_email_at = now() where id = any($1)",
    [[memberUserRows[0].id, outsiderUserRows[0].id]],
  )

  const { rows: teamRows } = await client.query(
    "insert into public.teams (name) values ('TA-denik-tým') returning id",
  )
  const { rows: otherTeamRows } = await client.query(
    "insert into public.teams (name) values ('TA-denik-jiný') returning id",
  )
  const teamId = teamRows[0].id as string
  const otherTeamId = otherTeamRows[0].id as string

  await client.query(
    `insert into public.profiles (name, work_email, user_id, role, team_id)
     values ('Člen', 'ta-int-member@studenti.czu.cz', $1, 'student', $2)`,
    [memberUserRows[0].id, teamId],
  )
  const { rows: memberProfiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [memberUserRows[0].id],
  )

  await client.query(
    `insert into public.profiles (name, work_email, user_id, role, team_id)
     values ('Mimo tým', 'ta-int-outsider@studenti.czu.cz', $1, 'student', $2)`,
    [outsiderUserRows[0].id, otherTeamId],
  )
  const { rows: outsiderProfiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [outsiderUserRows[0].id],
  )

  return {
    teamId,
    otherTeamId,
    memberProfileId: memberProfiles[0].id as string,
    outsiderProfileId: outsiderProfiles[0].id as string,
    memberAuthId: memberAuth.id as string,
    outsiderAuthId: outsiderAuth.id as string,
  }
}

async function insertActivity(client: PoolClient, teamId: string, profileId: string, occurredAt = "2026-03-12") {
  const { rows } = await client.query(
    `insert into public.team_activities
       (team_id, occurred_at, activity_type, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, 'Cabin in the Woods', $3, $3)
     returning id`,
    [teamId, occurredAt, profileId],
  )
  return rows[0].id as string
}

describe("team_activities RLS", () => {
  it("lets a team member insert and select their own team's activities", async () => {
    await withRollback(async (client) => {
      const { teamId, memberProfileId, memberAuthId } = await seed(client)

      await asClaims(client, { sub: memberAuthId })
      await insertActivity(client, teamId, memberProfileId)

      const { rows } = await client.query(
        "select activity_type from public.team_activities where team_id = $1",
        [teamId],
      )
      expect(rows).toHaveLength(1)
      expect(rows[0].activity_type).toBe("Cabin in the Woods")
    })
  })

  it("does not let a member of another team select the activities", async () => {
    await withRollback(async (client) => {
      const { teamId, memberProfileId, outsiderAuthId } = await seed(client)
      await insertActivity(client, teamId, memberProfileId)

      await asClaims(client, { sub: outsiderAuthId })
      const { rows } = await client.query(
        "select id from public.team_activities where team_id = $1",
        [teamId],
      )
      expect(rows).toHaveLength(0)
    })
  })

  it("does not let a member of another team insert an activity into someone else's team", async () => {
    await withRollback(async (client) => {
      const { teamId, outsiderProfileId, outsiderAuthId } = await seed(client)

      await asClaims(client, { sub: outsiderAuthId })
      await expect(
        client.query(
          `insert into public.team_activities
             (team_id, occurred_at, activity_type, created_by_profile_id, updated_by_profile_id)
           values ($1, '2026-03-12', 'Spoofed', $2, $2)`,
          [teamId, outsiderProfileId],
        ),
      ).rejects.toThrow()
    })
  })

  it("lets a team member update and soft-delete (removed_at) an activity", async () => {
    await withRollback(async (client) => {
      const { teamId, memberProfileId, memberAuthId } = await seed(client)
      const activityId = await insertActivity(client, teamId, memberProfileId)

      await asClaims(client, { sub: memberAuthId })
      await client.query(
        `update public.team_activities
           set participants = 'Celý tým', updated_by_profile_id = $2
         where id = $1`,
        [activityId, memberProfileId],
      )
      await client.query(
        `update public.team_activities
           set removed_at = now(), updated_by_profile_id = $2
         where id = $1`,
        [activityId, memberProfileId],
      )

      const { rows } = await client.query(
        "select id from public.team_activities where id = $1",
        [activityId],
      )
      expect(rows).toHaveLength(0) // soft-deleted rows are filtered, not error
    })
  })

  it("cascades deletion of the team to its activities", async () => {
    await withRollback(async (client) => {
      const { teamId, memberProfileId } = await seed(client)
      const activityId = await insertActivity(client, teamId, memberProfileId)

      await client.query("delete from public.teams where id = $1", [teamId])

      const { rows } = await client.query(
        "select id from public.team_activities where id = $1",
        [activityId],
      )
      expect(rows).toHaveLength(0)
    })
  })
})
```

**Step 2: Run the test**

Run: `pnpm test:integration -- team-activities`
Expected: PASS (all 6 cases). If bootstrapping complains about a missing relation, do NOT edit migrations — add the minimal shim to `tests/setup/bootstrap.sql` (see AGENTS.md).

**Step 3: Commit**

```bash
git add tests/integration/team-activities.int.test.ts
git commit -m "test: add RLS integration test for team_activities"
```

---

### Task 11: E2E Test

**Files:**
- Modify: `tests/e2e/fixtures/auth.ts` (add `seedTeamActivity` + cleanup row)
- Create: `tests/e2e/tymovy-denik.spec.ts`
- Reference: `tests/e2e/tymova-reflexe.spec.ts`

**Step 1: Add `seedTeamActivity` to the fixture**

Add after `seedTeamReflection` (around line 324):

```ts
/** Seeds a team activity row directly, bypassing the UI. */
export async function seedTeamActivity(
  teamId: string,
  profileId: string,
  occurredAt: string,
): Promise<{ activityId: string }> {
  const rows = (await restFetch("/team_activities", "POST", {
    team_id: teamId,
    occurred_at: occurredAt,
    activity_type: "E2E team building",
    created_by_profile_id: profileId,
    updated_by_profile_id: profileId,
  })) as { id: string }[];
  return { activityId: rows[0].id };
}
```

In `cleanupTestData()`, add a Phase 2 entry next to `team_reflections` (line ~274):

```ts
restFetch(`/team_activities?team_id=eq.${tid}`, "DELETE").catch(() => {}),
```

**Step 2: Create the spec**

```ts
import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  createTestTeam,
  getSetupSessionCookie,
  grantBetaAccess,
  setAuthCookie,
} from "./fixtures/auth";

function uniqueDate(): string {
  const seed = Date.now();
  const year = 1990 + (seed % 30);
  const month = String((seed % 12) + 1).padStart(2, "0");
  const day = String((seed % 28) + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

test.describe("týmový deník - unauthenticated", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/tymovy-denik");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe("týmový deník - single user", () => {
  let cookieValue: string;

  test.beforeAll(async () => {
    const teamId = await createTestTeam();
    const user = await getSetupSessionCookie(teamId);
    await grantBetaAccess(user.profileId);
    cookieValue = user.cookie;
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookieValue);
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("list page shows empty state", async ({ page }) => {
    await page.goto("/tymovy-denik");
    expect((await page.getByRole("heading", { name: "Týmový deník" }).count()) > 0).toBe(true);
    await expect(page.getByText("Žádné akce")).toBeVisible();
  });

  test("creating an activity adds it to the feed", async ({ page }) => {
    await page.goto("/tymovy-denik");
    await page.getByRole("button", { name: /Nová akce/i }).click();
    await page.getByLabel("Typ akce").fill("Cabin in the Woods");
    await page.getByLabel("Účast").fill("Celý tým");
    await page.getByLabel("Proč jsme tam byli").fill("Teambuilding");
    await page.getByLabel(/Co jsme si odnesli/).fill("Silnější vazby");
    await page.getByRole("button", { name: "Přidat akci" }).click();

    await expect(page.getByText("Cabin in the Woods")).toBeVisible();
    await expect(page.getByText("Teambuilding")).toBeVisible();
  });

  test("deleting an activity removes it from the feed", async ({ page }) => {
    const activityType = `E2E smazat ${Date.now()}`;
    await page.goto("/tymovy-denik");
    await page.getByRole("button", { name: /Nová akce/i }).click();
    await page.getByLabel("Typ akce").fill(activityType);
    await page.getByRole("button", { name: "Přidat akci" }).click();
    await expect(page.getByText(activityType)).toBeVisible();

    await page.getByRole("button", { name: "Smazat" }).click();
    await page.getByRole("button", { name: "Odstranit" }).click();
    await expect(page.getByText(activityType)).toHaveCount(0);
  });
});
```

Note: date inputs default to today, so the "creating" test doesn't need to set Datum. The `uniqueDate` helper exists for seeding via `seedTeamActivity` if a pre-seeded-data test is added later.

**Step 3: Run the E2E suite**

Run: `pnpm test:e2e -- tymovy-denik`
Expected: PASS.

**Step 4: Commit**

```bash
git add tests/e2e/fixtures/auth.ts tests/e2e/tymovy-denik.spec.ts
git commit -m "test: add E2E tests for team diary"
```

---

### Task 12: Verify

Run everything:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration -- team-activities
pnpm test:e2e -- tymovy-denik
```

Expected: all green.

If any failures: fix, re-run, then commit:

```bash
git add -A
git commit -m "chore: fix verification issues"
```

---

### Task 13: Final Review

**Step 1: Review the diff**

```bash
git log --oneline -10
git status
```

**Step 2: Manual smoke test (light + dark themes)**

Run `pnpm dev` and on `/tymovy-denik` verify:
- List renders grouped by month, newest first
- Create dialog validates required fields (Datum, Typ akce)
- Edit dialog updates a card in place
- Delete confirms via AlertDialog and removes the card
- Empty state shows for a fresh team
- Sidebar shows "Týmový deník" with Beta badge; hidden for non-beta users
- Both light and dark themes look correct (no hardcoded colors; semantic tokens only)

**Step 3: Final commit state stays clean**

The plan is done when Tasks 1–12 are committed and Task 13 passes.
