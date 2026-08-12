# Týmová reflexe Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build monthly Team Reflection feature — shared team document with 5 text fields per month.

**Architecture:** New `team_reflections` DB table (Drizzle schema, RLS). Server Component page fetches data, client component for list/form. Pattern follows existing `koucovani` feature exactly.

**Tech Stack:** Next.js 16, Supabase, Drizzle ORM (schema only), shadcn/ui, Tailwind CSS 4

**Design Doc:** `docs/plans/2026-07-28-tymova-reflexe-design.md`

---

### Task 1: Database Schema — `team_reflections` table

**Files:**
- Create: `db/schema/team-reflections.ts`
- Reference existing: `db/schema/individual-coaching-sessions.ts` (exact same pattern)

**Step 1: Create schema file**

```ts
import { pgTable, foreignKey, pgPolicy, uuid, text, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { teams } from "./teams"
import { profiles } from "./profiles"

export const teamReflections = pgTable("team_reflections", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  teamId: uuid("team_id").notNull(),
  month: date("month").notNull(),
  whatWentWell: text("what_went_well"),
  whatDidntGoWell: text("what_didnt_go_well"),
  whatWeDoDifferently: text("what_we_do_differently"),
  plannedActionSteps: text("planned_action_steps"),
  responsiblePerson: text("responsible_person"),
  removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  createdByProfileId: uuid("created_by_profile_id").notNull(),
  updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
  uniqueIndex("team_reflections_team_month_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops"), table.month.asc().nullsLast().op("date_ops")),
  foreignKey({
    columns: [table.teamId],
    foreignColumns: [teams.id],
    name: "team_reflections_team_id_fkey"
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.createdByProfileId],
    foreignColumns: [profiles.id],
    name: "team_reflections_created_by_profile_id_fkey"
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.updatedByProfileId],
    foreignColumns: [profiles.id],
    name: "team_reflections_updated_by_profile_id_fkey"
  }).onDelete("restrict"),
  pgPolicy("Team members can view reflections", {
    as: "permissive", for: "select", to: ["authenticated"],
    using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`,
  }),
  pgPolicy("Team members can create reflections", {
    as: "permissive", for: "insert", to: ["authenticated"],
    withCheck: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`,
  }),
  pgPolicy("Team members can update reflections", {
    as: "permissive", for: "update", to: ["authenticated"],
    using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`,
    withCheck: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`,
  }),
  pgPolicy("Team members can delete reflections", {
    as: "permissive", for: "delete", to: ["authenticated"],
    using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`,
  }),
]).enableRLS()
```

**Step 2: Register the table in `db/schema/index.ts`**

Check if `db/schema/index.ts` exists. If it re-exports all schemas, add the import. If not, Drizzle reads the directory — verify by checking how other schemas are discovered.

Run: `cat db/schema/index.ts` (check if exists)
Expected: Either empty or re-exporting all schema files. If exists, add: `export * from "./team-reflections"`

**Step 3: Generate migration**

Run: `pnpm db:generate`
Expected: Creates a new migration file in `supabase/migrations/`

**Step 4: Check migration for drops**

Read the generated migration file. Verify no DROP statements for existing tables.

**Step 5: Apply migration**

Run: `pnpm db:up`
Expected: Migration applied successfully.

**Step 6: Check generated types**

Run: `pnpm db:export` (to update `src/lib/supabase/database.types.ts`)
Check that `team_reflections` appears in the generated types.

**Step 7: Commit**

```bash
git add db/schema/team-reflections.ts supabase/migrations/YYYYMMDDHHMMSS_*.ts src/lib/supabase/database.types.ts
git commit -m "feat(db): add team_reflections table"
```

---

### Task 2: Types + Queries

**Files:**
- Create: `src/lib/tymova-reflexe/types.ts`
- Create: `src/lib/tymova-reflexe/queries.ts`

**Step 1: Create types**

```ts
import type { Tables } from "@/lib/supabase/tables"
import type { Profile } from "@/lib/auth-helpers"

export type TeamReflection = Tables<"team_reflections">

export interface TeamReflectionWithCreator extends TeamReflection {
  created_by: Pick<Profile, "id" | "name" | "picture"> | null
}

export const REFLECTION_WITH_CREATOR_SELECT = "*, created_by:profiles!created_by_profile_id(id, name, picture)"
```

**Step 2: Create queries**

```ts
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { TeamReflectionWithCreator } from "./types"
import { REFLECTION_WITH_CREATOR_SELECT } from "./types"

export async function listTeamReflections(
  supabase: SupabaseClient<Database>,
  teamId: string,
): Promise<TeamReflectionWithCreator[]> {
  const { data, error } = await supabase
    .from("team_reflections")
    .select(REFLECTION_WITH_CREATOR_SELECT)
    .is("removed_at", null)
    .eq("team_id", teamId)
    .order("month", { ascending: false })

  if (error) throw error
  return (data ?? []) as TeamReflectionWithCreator[]
}

export async function getTeamReflectionForMonth(
  supabase: SupabaseClient<Database>,
  teamId: string,
  month: string,
): Promise<TeamReflectionWithCreator | null> {
  const { data, error } = await supabase
    .from("team_reflections")
    .select(REFLECTION_WITH_CREATOR_SELECT)
    .is("removed_at", null)
    .eq("team_id", teamId)
    .eq("month", month)
    .maybeSingle()

  if (error) throw error
  return data as TeamReflectionWithCreator | null
}
```

**Step 3: Commit**

```bash
git add src/lib/tymova-reflexe/
git commit -m "feat: add team reflection types and queries"
```

---

### Task 3: Server Page — `/tymova-reflexe`

**Files:**
- Create: `src/app/(main)/tymova-reflexe/page.tsx`

**Step 1: Create page**

```tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listTeamReflections } from "@/lib/tymova-reflexe/queries"
import { TeamReflectionList } from "@/components/tymova-reflexe/team-reflection-list"
import { InfoCard } from "@/components/tymova-reflexe/info-card"

export const metadata = {
  title: "Týmová reflexe | Tappka",
  description: "Měsíční reflexe týmové spolupráce",
}

export default async function TymovaReflexePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")
  if (!profile.team_id) redirect("/")

  const reflections = await listTeamReflections(supabase, profile.team_id)

  return (
    <div className="container mx-auto max-w-5xl py-4 sm:py-6 px-3 sm:px-6 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Týmová reflexe</h1>
          <p className="text-sm text-muted-foreground">
            Měsíční ohlédnutí za týmovou spoluprací
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold tabular-nums leading-none">{reflections.length}</p>
          <p className="text-sm text-muted-foreground">reflexí</p>
        </div>
      </div>
      <InfoCard />
      <TeamReflectionList
        reflections={reflections}
        teamId={profile.team_id}
        profile={profile}
      />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(main)/tymova-reflexe/
git commit -m "feat: add team reflection page route"
```

---

### Task 4: InfoCard component

**Files:**
- Create: `src/components/tymova-reflexe/info-card.tsx`

**Step 1: Create InfoCard**

```tsx
import { Info } from "lucide-react"

export function InfoCard() {
  return (
    <div className="flex gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
      <div className="space-y-1">
        <p>
          <strong>Týmová reflexe</strong> je pravidelný proces, při kterém se tým ohlíží za svými
          zkušenostmi a výsledky, aby identifikoval úspěchy i oblasti ke zlepšení.
        </p>
        <p>
          Reflexe probíhá <strong>jednou měsíčně</strong> (na konci měsíce před Houston Callingem).
          Výjimkou je leden a květen — místo měsíční reflexe se provádí celosemestrální reflexe.
        </p>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/tymova-reflexe/info-card.tsx
git commit -m "feat: add team reflection info card"
```

---

### Task 5: Team Reflection Form

**Files:**
- Create: `src/components/tymova-reflexe/team-reflection-form.tsx`

**Step 1: Create form component**

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
import type { TeamReflection, TeamReflectionWithCreator } from "@/lib/tymova-reflexe/types"
import { REFLECTION_WITH_CREATOR_SELECT } from "@/lib/tymova-reflexe/types"

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function monthLabel(monthStr: string): string {
  const m = Number(monthStr.slice(5, 7))
  return `${MONTH_LABELS[m - 1]} ${monthStr.slice(0, 4)}`
}

function availableMonths(): string[] {
  const now = new Date()
  const result: string[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`)
  }
  return result
}

interface TeamReflectionFormProps {
  teamId: string
  profileId: string
  initial?: Partial<TeamReflection>
  onSuccess: (reflection: TeamReflectionWithCreator) => void
  onCancel: () => void
}

export function TeamReflectionForm({ teamId, profileId, initial, onSuccess, onCancel }: TeamReflectionFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(initial?.month ?? getCurrentMonth())
  const [whatWentWell, setWhatWentWell] = useState(initial?.what_went_well ?? "")
  const [whatDidntGoWell, setWhatDidntGoWell] = useState(initial?.what_didnt_go_well ?? "")
  const [whatWeDoDifferently, setWhatWeDoDifferently] = useState(initial?.what_we_do_differently ?? "")
  const [plannedActionSteps, setPlannedActionSteps] = useState(initial?.planned_action_steps ?? "")
  const [responsiblePerson, setResponsiblePerson] = useState(initial?.responsible_person ?? "")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const isEdit = !!initial?.id
      const base = {
        team_id: teamId,
        month,
        what_went_well: whatWentWell.trim() || null,
        what_didnt_go_well: whatDidntGoWell.trim() || null,
        what_we_do_differently: whatWeDoDifferently.trim() || null,
        planned_action_steps: plannedActionSteps.trim() || null,
        responsible_person: responsiblePerson.trim() || null,
        updated_by_profile_id: profileId,
      }

      let data: TeamReflectionWithCreator
      if (isEdit) {
        const result = await supabase
          .from("team_reflections")
          .update(base)
          .eq("id", initial!.id!)
          .select(REFLECTION_WITH_CREATOR_SELECT)
          .single()
        if (result.error) throw result.error
        data = result.data as TeamReflectionWithCreator
      } else {
        const result = await supabase
          .from("team_reflections")
          .insert({ ...base, created_by_profile_id: profileId })
          .select(REFLECTION_WITH_CREATOR_SELECT)
          .single()
        if (result.error) throw result.error
        data = result.data as TeamReflectionWithCreator
      }

      toast.success(initial ? "Reflexe aktualizována" : "Reflexe vytvořena")
      onSuccess(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznámá chyba")
      toast.error("Nepodařilo se uložit reflexi")
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
        <Label htmlFor="month">Měsíc reflexe</Label>
        {initial ? (
          <Input id="month" value={monthLabel(month)} disabled />
        ) : (
          <select
            id="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {availableMonths().map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="what-went-well">Co se povedlo</Label>
        <Textarea
          id="what-went-well"
          value={whatWentWell}
          onChange={(e) => setWhatWentWell(e.target.value)}
          placeholder="Úspěchy a pozitiva za uplynulý měsíc"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="what-didnt-go-well">Co se nepovedlo</Label>
        <Textarea
          id="what-didnt-go-well"
          value={whatDidntGoWell}
          onChange={(e) => setWhatDidntGoWell(e.target.value)}
          placeholder="Problémy a výzvy, které nastaly"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="what-we-do-differently">Co uděláme jinak</Label>
        <Textarea
          id="what-we-do-differently"
          value={whatWeDoDifferently}
          onChange={(e) => setWhatWeDoDifferently(e.target.value)}
          placeholder="Změny přístupu do budoucna"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="action-steps">Plánované akční kroky</Label>
        <Textarea
          id="action-steps"
          value={plannedActionSteps}
          onChange={(e) => setPlannedActionSteps(e.target.value)}
          placeholder="Konkrétní kroky ke zlepšení"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="responsible-person">Zodpovědná osoba za AK</Label>
        <Input
          id="responsible-person"
          value={responsiblePerson}
          onChange={(e) => setResponsiblePerson(e.target.value)}
          placeholder="Jméno člena týmu"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Zrušit
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {initial ? "Uložit změny" : "Vytvořit reflexi"}
        </Button>
      </div>
    </form>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/tymova-reflexe/team-reflection-form.tsx
git commit -m "feat: add team reflection form"
```

---

### Task 6: Team Reflection Card

**Files:**
- Create: `src/components/tymova-reflexe/team-reflection-card.tsx`

**Step 1: Create card component**

```tsx
"use client"

import { useState } from "react"
import { Pencil, Trash2, Calendar } from "lucide-react"
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
import { TeamReflectionForm } from "./team-reflection-form"
import type { TeamReflectionWithCreator } from "@/lib/tymova-reflexe/types"

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function monthLabel(monthStr: string): string {
  const m = Number(monthStr.slice(5, 7))
  return `${MONTH_LABELS[m - 1]} ${monthStr.slice(0, 4)}`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{children}</p>
    </div>
  )
}

interface TeamReflectionCardProps {
  reflection: TeamReflectionWithCreator
  teamId: string
  profileId: string
  onUpdated: (reflection: TeamReflectionWithCreator) => void
  onDeleted: (id: string) => void
}

export function TeamReflectionCard({
  reflection,
  teamId,
  profileId,
  onUpdated,
  onDeleted,
}: TeamReflectionCardProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("team_reflections")
        .update({ removed_at: new Date().toISOString() })
        .eq("id", reflection.id)

      if (error) throw error
      toast.success("Reflexe odstraněna")
      onDeleted(reflection.id)
    } catch {
      toast.error("Nepodařilo se odstranit reflexi")
    } finally {
      setDeleting(false)
    }
  }

  function handleUpdated(updated: TeamReflectionWithCreator) {
    setEditOpen(false)
    onUpdated(updated)
    toast.success("Reflexe aktualizována")
  }

  return (
    <Card className="p-3 sm:p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-semibold text-sm">{monthLabel(reflection.month)}</span>
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
                <DialogTitle>Upravit reflexi</DialogTitle>
              </DialogHeader>
              <TeamReflectionForm
                teamId={teamId}
                profileId={profileId}
                initial={reflection}
                onSuccess={handleUpdated}
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
                <AlertDialogTitle>Odstranit reflexi?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tato akce reflexi za {monthLabel(reflection.month)} odstraní.
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
        {reflection.what_went_well && (
          <Field label="Co se povedlo">{reflection.what_went_well}</Field>
        )}
        {reflection.what_didnt_go_well && (
          <Field label="Co se nepovedlo">{reflection.what_didnt_go_well}</Field>
        )}
        {reflection.what_we_do_differently && (
          <Field label="Co uděláme jinak">{reflection.what_we_do_differently}</Field>
        )}
        {reflection.planned_action_steps && (
          <Field label="Plánované akční kroky">{reflection.planned_action_steps}</Field>
        )}
        {reflection.responsible_person && (
          <Field label="Zodpovědná osoba">{reflection.responsible_person}</Field>
        )}
      </div>

      {reflection.created_by && (
        <div className="border-t pt-3 text-xs text-muted-foreground">
          Vytvořil/a: {reflection.created_by.name}
        </div>
      )}
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/tymova-reflexe/team-reflection-card.tsx
git commit -m "feat: add team reflection card"
```

---

### Task 7: Team Reflection List

**Files:**
- Create: `src/components/tymova-reflexe/team-reflection-list.tsx`

**Step 1: Create list component**

```tsx
"use client"

import { useState } from "react"
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
import { TeamReflectionForm } from "./team-reflection-form"
import { TeamReflectionCard } from "./team-reflection-card"
import type { TeamReflectionWithCreator } from "@/lib/tymova-reflexe/types"
import type { Profile } from "@/lib/auth-helpers"

const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

function monthLabel(monthStr: string): string {
  const m = Number(monthStr.slice(5, 7))
  return `${MONTH_LABELS[m - 1]} ${monthStr.slice(0, 4)}`
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

interface TeamReflectionListProps {
  reflections: TeamReflectionWithCreator[]
  teamId: string
  profile: Pick<Profile, "id" | "name">
}

export function TeamReflectionList({ reflections, teamId, profile }: TeamReflectionListProps) {
  const [items, setItems] = useState(reflections)
  const [createOpen, setCreateOpen] = useState(false)

  const currentMonth = getCurrentMonth()
  const hasCurrentMonthReflection = items.some((r) => r.month === currentMonth)

  function handleCreated(reflection: TeamReflectionWithCreator) {
    setItems((prev) => {
      const updated = [reflection, ...prev]
      updated.sort((a, b) => b.month.localeCompare(a.month))
      return updated
    })
    setCreateOpen(false)
  }

  function handleUpdated(reflection: TeamReflectionWithCreator) {
    setItems((prev) => prev.map((r) => (r.id === reflection.id ? reflection : r)))
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-end gap-4">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={hasCurrentMonthReflection}>
              <Plus className="size-4" />
              {hasCurrentMonthReflection ? "Reflexe za tento měsíc existuje" : "Nová reflexe"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nová týmová reflexe</DialogTitle>
            </DialogHeader>
            <TeamReflectionForm
              teamId={teamId}
              profileId={profile.id}
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
            <EmptyTitle>Žádné reflexe</EmptyTitle>
            <EmptyDescription>
              Zatím nemáte žádné záznamy. Vytvořte první měsíční reflexi.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={hasCurrentMonthReflection}>
                  <Plus className="size-4" />
                  Přidat reflexi
                </Button>
              </DialogTrigger>
            </Dialog>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-4">
          {items.map((reflection) => (
            <TeamReflectionCard
              key={reflection.id}
              reflection={reflection}
              teamId={teamId}
              profileId={profile.id}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/tymova-reflexe/team-reflection-list.tsx
git commit -m "feat: add team reflection list"
```

---

### Task 8: Sidebar Navigation

**Files:**
- Modify: `src/components/app-sidebar.tsx`

**Step 1: Add navigation item**

After the "Koučování" section (around line 98), add a new nav item in the `getNavData` function:

Add import for the icon at the top (add `RefreshCw` or another icon):
```tsx
import { LayoutDashboard, CalendarDays, Users, Mail, Database, ChevronRight, Heart, BookOpen, Handshake, GraduationCap, RefreshCw } from "lucide-react"
```

Add the nav item in the "Hlavní" section after koucovani:
```tsx
{
  title: "Týmová reflexe",
  url: "/tymova-reflexe",
  icon: RefreshCw,
},
```

Add the active state detection:
After `const isCteniActive`, add:
```tsx
const isTymovaReflexeActive = pathname.startsWith("/tymova-reflexe")
```

Add the conditional render block for beta-gating (before the standard menu item return, around line 278):
```tsx
// Týmová reflexe — beta-only
if (item.title === "Týmová reflexe") {
  if (!isBeta) return null

  return (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        asChild
        isActive={isTymovaReflexeActive}
        tooltip={item.title}
      >
        <Link href={item.url} onClick={closeSidebarOnMobile}>
          <item.icon className="size-4" />
          <span>{item.title}</span>
          <Badge variant="secondary" className="ml-auto h-5 text-[10px] px-1.5">
            Beta
          </Badge>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
```

Also add `RefreshCw` to the existing icon import list.

**Step 2: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat: add team reflection sidebar entry"
```

---

### Task 9: Verify Build

**Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: No TypeScript errors

**Step 2: Lint**

Run: `pnpm lint`
Expected: No lint errors

**Step 3: Test**

Run: `pnpm test`
Expected: All existing tests pass

---

### Task 10: Summary Commit (if needed)

Make sure all files are committed.

```bash
git status
git log --oneline -5
```
