# Beta Cohort Feature Access Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give admins A/B cohort assignment where beta A sees Reading only and B sees all beta modules, while non-beta sees nothing, admins always see everything, direct URL access shows a cooking fallback, and PostHog records beta status plus cohort.

**Architecture:** Add a `beta_cohort` enum (`A|B`, default `A`) on `profiles`; create one typed central feature registry and a pure `canAccessFeature(profile, feature)` helper that is the single decision point for navigation, Spotlight, dashboard widgets, server page guards, API guards, and notifications (admin bypass first, then beta enrollment, then cohort). Self-enrollment stays and preserves cohort through opt-out; an admin-only `/beta` panel and `/api/admin/beta-cohort` route manage assignment via the service-role client; PostHog identifies signed-in users with `beta_access` + `beta_cohort` without ever using flags for authorization.

**Tech Stack:** Next.js 16 App Router (Server Components, Route Handlers), TypeScript strict, Drizzle ORM + Supabase Postgres (RLS, `supabase-js`, `createAdminClient`), PostHog JS (`posthog-js`, `posthog-js/react`, `posthog-node`), shadcn/ui, Vitest + Testing Library + Playwright, Drizzle Kit migrations.

---

## Task 1: Add `beta_cohort` enum and column to profiles

**Files:**
- Modify: `db/schema/profiles.ts:1-55`
- Create: `supabase/migrations/*_beta_cohort.sql` (generated)
- Modify: `src/lib/supabase/database.types.ts` (generated via `pnpm db:types`)

**Step 1: Inspect current profiles schema and trigger**

Read `db/schema/profiles.ts` and `supabase/migrations/20260719161140_google_profile_defaults.sql:75-155`. Note `validate_picture_only_update()` currently allows only `picture` and `beta_access_granted_at` for regular users. Confirm `beta_cohort` must remain admin-only.

**Step 2: Edit schema source of truth**

In `db/schema/profiles.ts`, add enum and column:

```ts
export const betaCohort = pgEnum("beta_cohort", ["A", "B"])

export const profiles = pgTable("profiles", {
  // ... existing columns
  betaAccessGrantedAt: timestamp("beta_access_granted_at", { withTimezone: true, mode: 'string' }),
  betaCohort: betaCohort("beta_cohort").default("A").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  // ...
}, (table) => [ /* existing indexes/FKs/policies/checks */ ])
```

Keep column `notNull` with default `A` so every row has a stable assignment.

**Step 3: Generate migration (do not hand-write)**

Run: `pnpm db:generate`
Expected: `drizzle-kit generate` creates one new file in `supabase/migrations/` containing `CREATE TYPE beta_cohort` and `ALTER TABLE profiles ADD COLUMN beta_cohort ... DEFAULT 'A'`.

**Step 4: Review migration for drops**

Run: `cat supabase/migrations/*beta_cohort*.sql`
Expected: No `DROP` statements. Per `AGENTS.md`, ask user to confirm migration has no drops before proceeding. If drops are present, stop and fix schema edit.

**Step 5: Commit schema edit (migration not yet applied)**

Run:
```bash
git add db/schema/profiles.ts supabase/migrations/*beta_cohort*.sql
git commit -m "feat: add beta_cohort enum and column to profiles"
```

Prompt user to run `pnpm db:migrate` (which runs `db:generate`, `supabase:start`, `db:up`, `db:types`, `db:export`). After migration, verify `src/lib/supabase/database.types.ts` contains `beta_cohort`.

---

## Task 2: Enforce admin-only cohort writes in the profile trigger

**Files:**
- Modify: `supabase/migrations/*_beta_cohort.sql` (extend generated SQL) OR create custom migration via `pnpm db:generate:custom`
- Test: `tests/integration/profiles.beta-cohort.int.test.ts` (new)

**Step 1: Write failing integration test for trigger behavior**

Create `tests/integration/profiles.beta-cohort.int.test.ts` using `withRollback` and `asClaims` patterns from `docs/runbooks/testing.md`:

- Non-admin via `supabase-js` cannot update `beta_cohort` (expect Postgres error containing `Only picture and beta_access_granted_at` or new message).
- Service-role client can update `beta_cohort`.

Run: `pnpm test:integration -- profiles.beta-cohort`
Expected: FAIL (trigger still allows cohort or test setup incomplete).

**Step 2: Adjust trigger in the same beta_cohort migration**

Per `AGENTS.md` Functions & triggers rule: the migration SQL must contain `CREATE OR REPLACE FUNCTION public.validate_picture_only_update()` with extended checks.

Add handling so the `user_id`-only linking fast path includes:
```sql
and old.beta_cohort is not distinct from new.beta_cohort
```

And the regular-user guard includes:
```sql
or old.beta_cohort is distinct from new.beta_cohort
```
Raise same exception. Keep bypass for `service_role`/`postgres`/`supabase_admin`.

If using custom migration: `pnpm db:generate:custom`, paste the full `CREATE OR REPLACE` function (copy current function from `20260719161140_google_profile_defaults.sql` and add the two beta_cohort lines), then `pnpm db:up` and `pnpm db:export`, then `pnpm db:generate` once (should report "No schema changes").

**Step 3: Run integration test to verify it passes**

Run: `pnpm test:integration -- profiles.beta-cohort`
Expected: PASS

**Step 4: Commit**

Run:
```bash
git add supabase/migrations/*beta_cohort*.sql tests/integration/profiles.beta-cohort.int.test.ts
git commit -m "feat: restrict beta_cohort to admin/service role"
```

---

## Task 3: Central feature registry and access helper (TDD)

**Files:**
- Create: `src/lib/feature-access.ts`
- Create: `src/lib/feature-access.test.ts`

**Step 1: Write failing unit tests**

Create `src/lib/feature-access.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { canAccessFeature, BETA_FEATURES } from "./feature-access"

const nonBeta = { role: "student", beta_access_granted_at: null, beta_cohort: "A" as const }
const a = { role: "student", beta_access_granted_at: "2026-01-01T00:00:00Z", beta_cohort: "A" as const }
const b = { role: "student", beta_access_granted_at: "2026-01-01T00:00:00Z", beta_cohort: "B" as const }
const adminNoBeta = { role: "admin", beta_access_granted_at: null, beta_cohort: "A" as const }

describe("canAccessFeature", () => {
  it("denies all beta features without enrollment", () => {
    for (const f of Object.keys(BETA_FEATURES) as (keyof typeof BETA_FEATURES)[]) {
      expect(canAccessFeature(nonBeta, f)).toBe(false)
    }
  })
  it("A gets reading only", () => {
    expect(canAccessFeature(a, "reading")).toBe(true)
    expect(canAccessFeature(a, "customerMeetings")).toBe(false)
    expect(canAccessFeature(a, "birthGiving")).toBe(false)
  })
  it("B gets all beta features", () => {
    for (const f of Object.keys(BETA_FEATURES) as (keyof typeof BETA_FEATURES)[]) {
      expect(canAccessFeature(b, f)).toBe(true)
    }
  })
  it("admin bypasses regardless of beta status", () => {
    for (const f of Object.keys(BETA_FEATURES) as (keyof typeof BETA_FEATURES)[]) {
      expect(canAccessFeature(adminNoBeta, f)).toBe(true)
    }
  })
})
```

Run: `pnpm test:unit -- feature-access`
Expected: FAIL with "Cannot find module './feature-access'"

**Step 2: Implement minimal registry and helper**

Create `src/lib/feature-access.ts`:

```ts
export const BETA_FEATURES = {
  reading: ["A", "B"],
  customerMeetings: ["B"],
  coaching: ["B"],
  teamReflection: ["B"],
  teamDiary: ["B"],
  teamDocuments: ["B"],
  toolsTechniques: ["B"],
  personalityTests: ["B"],
  birthGiving: ["B"],
  portfolio: ["B"],
  dashboardMetrics: ["B"],
} as const

export type BetaFeature = keyof typeof BETA_FEATURES
export type BetaCohort = "A" | "B"
export type AccessProfile = { role: string; beta_access_granted_at: string | null; beta_cohort: BetaCohort }

export function canAccessFeature(profile: AccessProfile | null | undefined, feature: BetaFeature): boolean {
  if (!profile) return false
  if (profile.role === "admin") return true
  if (!profile.beta_access_granted_at) return false
  const allowed = BETA_FEATURES[feature]
  return (allowed as readonly string[]).includes(profile.beta_cohort)
}
```

Also export `isBetaEnrolled(profile)` helper if needed.

**Step 3: Run tests to verify they pass**

Run: `pnpm test:unit -- feature-access`
Expected: PASS (all 4)

**Step 4: Commit**

Run:
```bash
git add src/lib/feature-access.ts src/lib/feature-access.test.ts
git commit -m "feat: add central beta feature registry and access helper"
```

---

## Task 4: Migrate navigation to feature keys and update gating

**Files:**
- Modify: `src/lib/navigation.ts:17-69`
- Modify: `src/lib/navigation.test.ts`
- Modify: `src/components/navigation/module-grid.tsx`
- Modify: `src/components/navigation/module-grid.test.tsx`

**Step 1: Write failing test for new navigation shape**

Extend `src/lib/navigation.test.ts` to assert every beta-gated entry has `feature` instead of `betaOnly` and that `getHubModules` filters by `canAccessFeature`:

```ts
it("maps reading to A,B and others to B only", () => {
  const reading = NAV_MODULES.find(m => m.url === "/cteni/prehled")!
  expect(reading.feature).toBe("reading")
  expect(BETA_FEATURES[reading.feature]).toEqual(["A","B"])
})
```

Run: `pnpm test:unit -- navigation`
Expected: FAIL (feature field missing)

**Step 2: Update navigation config**

In `src/lib/navigation.ts`:
- Import `BetaFeature`
- Change `NavModule` from `betaOnly?: boolean` to `feature?: BetaFeature`
- Update every beta entry: `feature: "reading"` for Čtení, `feature: "customerMeetings"` for `/schuzky`, etc., using the registry.
- Keep non-beta entries with no `feature`.
- Change `getHubModules` signature to accept `AccessProfile` or delegate to caller building allowed set via `canAccessFeature`.

**Step 3: Update ModuleGrid and tests to use feature**

Adjust `src/components/navigation/module-grid.tsx` to show Beta badge when `m.feature` exists, and filter via caller-provided allowed modules. Update `module-grid.test.tsx` to assert badge count equals `NAV_MODULES.filter(m => m.feature).length`.

**Step 4: Run tests**

Run: `pnpm test:unit -- navigation` and `pnpm test:component -- module-grid`
Expected: PASS

**Step 5: Commit**

Run:
```bash
git add src/lib/navigation.ts src/lib/navigation.test.ts src/components/navigation/module-grid.tsx src/components/navigation/module-grid.test.tsx
git commit -m "feat: migrate navigation to feature-key gating"
```

---

## Task 5: Apply cohort gating to sidebar, Spotlight, profile areas, and dashboard

**Files:**
- Modify: `src/components/app-sidebar.tsx:40-165`
- Modify: `src/lib/spotlight.ts` and `src/lib/spotlight.test.ts`
- Modify: `src/components/spotlight/spotlight-dialog.tsx`
- Modify: `src/components/navigation/profile-hub.tsx` and `src/components/nav-user.tsx`
- Modify: `src/app/(main)/page.tsx:58-132` (dashboard)
- Modify: `src/components/settings/notification-preferences-form.tsx`
- Modify: `src/app/(main)/moduly/page.tsx`
- Modify: `src/lib/spotlight.test.ts` existing beta tests

**Step 1: Write failing component tests for sidebar and Spotlight filtering**

Add tests asserting:
- Cohort A sidebar shows Reading but not Birth Giving.
- Cohort B sidebar shows all beta.
- Spotlight `betaOnly` replaced by feature filtering: `getSpotlightItems({ user: { beta_access_granted_at, beta_cohort, role }})` respects A vs B.

Run: `pnpm test:component -- sidebar` or `pnpm test -- spotlight`
Expected: FAIL

**Step 2: Implement gating**

- In `app-sidebar.tsx`, replace `isBeta` boolean with `profile` passed to `canAccessFeature`. For each `item.feature`, skip if `!canAccessFeature(profile, item.feature)`.
- In `spotlight.ts`, replace `betaOnly` with `feature` and filter via `canAccessFeature`.
- In `profile-hub.tsx`/`nav-user.tsx`, gate Portfolio link via `canAccessFeature(profile, "portfolio")` (keeps existing `role` display).
- In `moduly/page.tsx`, build allowed hub modules via `NAV_MODULES.filter(m => !m.feature || canAccessFeature(profile, m.feature))`.
- In `page.tsx` dashboard, replace `hasMetricsAccess = !!profile.beta_access_granted_at` with `canAccessFeature(profile, "dashboardMetrics")`; gate `metrics` widget and `reading` widget accordingly.
- In `notification-preferences-form.tsx`, gate toggles via `canAccessFeature(profile, "reading")` instead of raw beta boolean, preserving existing disabled/checked behavior.

**Step 3: Run tests**

Run: `pnpm test:unit -- spotlight` and `pnpm test:component -- profile-hub spotlight module-grid`
Expected: PASS

**Step 4: Commit**

Run:
```bash
git add src/components/app-sidebar.tsx src/lib/spotlight.ts src/lib/spotlight.test.ts src/components/spotlight/spotlight-dialog.tsx src/components/navigation/profile-hub.tsx src/components/nav-user.tsx src/app/(main)/page.tsx src/components/settings/notification-preferences-form.tsx src/app/(main)/moduly/page.tsx
git commit -m "feat: gate sidebar, spotlight, moduly, and dashboard by cohort"
```

---

## Task 6: Create friendly cooking fallback component

**Files:**
- Create: `src/components/beta/feature-coming-soon.tsx`
- Create: `src/components/beta/feature-coming-soon.test.tsx`

**Step 1: Write failing component test**

Create `src/components/beta/feature-coming-soon.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { FeatureComingSoon } from "./feature-coming-soon"

it("renders feature name, no actions, and hidden animation", () => {
  render(<FeatureComingSoon featureName="Čtení" />)
  expect(screen.getByRole("heading", { name: /V kuchyni se něco chystá/i })).toBeInTheDocument()
  expect(screen.getByText(/Funkce.*Čtení.*probublává/)).toBeInTheDocument()
  expect(screen.queryByRole("link")).not.toBeInTheDocument()
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  const anim = document.querySelector("[data-testid='cooking-animation']")
  expect(anim).toHaveAttribute("aria-hidden", "true")
})
```

Run: `pnpm test:component -- feature-coming-soon`
Expected: FAIL (file missing)

**Step 2: Implement component**

Create `src/components/beta/feature-coming-soon.tsx`:
- Centered layout, not full-screen, within normal chrome.
- Lucide icons: `CookingPot` (or `Soup`/`Flame` fallback), two steam curls, one `Droplets`/`Carrot` dropping with CSS keyframes.
- Semantic tokens only (`bg-muted`, `text-primary`, `border`), no hardcoded hex.
- Czech copy (inclusive, gender-neutral, present tense):
  ```
  V kuchyni se něco chystá
  Funkce **Čtení** právě probublává v našem hrnci. Až bude správně dochucená, naservírujeme ji.
  ```
- Animation `motion-safe:animate-*` or `supports-[...]` + `motion-reduce:animate-none`, container `aria-hidden="true"` and `data-testid="cooking-animation"`.
- Props: `{ featureName: string }`.

**Step 3: Verify themes**

Run: `pnpm test:component -- feature-coming-soon`
Expected: PASS. Manually check light/dark in dev.

**Step 4: Commit**

Run:
```bash
git add src/components/beta/feature-coming-soon.tsx src/components/beta/feature-coming-soon.test.tsx
git commit -m "feat: add cooking fallback for restricted features"
```

---

## Task 7: Replace page redirects with cooking screen and enforce cohort

**Files:**
- Modify: `src/app/(main)/birth-giving/page.tsx`, `src/app/(main)/birth-giving/[eventId]/page.tsx`, `src/app/(main)/birth-giving/nova/page.tsx`, `src/app/(main)/birth-giving/historie/nova/page.tsx`
- Modify: `src/app/(main)/tymovy-denik/page.tsx`, `src/app/(main)/tymovy-denik/[id]/page.tsx`
- Modify: `src/app/(main)/osobnostni-testy/page.tsx`, `src/app/(main)/schuzky/page.tsx`, `src/app/(main)/schuzky/[meetingId]/page.tsx`
- Modify: `src/app/(main)/tymove-dokumenty/page.tsx`, `src/app/(main)/nastroje-techniky/page.tsx`, `src/app/(main)/koucovani/page.tsx`
- Modify: `src/app/(main)/tymova-reflexe/page.tsx`, `src/app/(main)/tymova-reflexe/[id]/page.tsx`, `src/app/(main)/tymova-reflexe/nova/page.tsx`, `src/app/(main)/tymova-reflexe/rocnikova/[id]/page.tsx`, `src/app/(main)/tymova-reflexe/rocnikova/nova/page.tsx`, `src/app/(main)/tymova-reflexe/semestralni/[id]/page.tsx`, `src/app/(main)/tymova-reflexe/semestralni/nova/page.tsx`
- Modify: `src/app/(main)/cteni/layout.tsx` or per-cteni pages if they become beta-gated (currently not; keep reading as beta-gated via layout)
- Modify: `src/app/(main)/komunita/profil/[id]/page.tsx` if portfolio tab is gated (optional)

**Step 1: Write failing E2E or component test for direct URL**

Extend `tests/e2e/*` or create `src/app/(main)/birth-giving/page.test.tsx` asserting cohort A visiting `/birth-giving` sees cooking screen with feature name, not skeletons or data.

Run: appropriate test suite
Expected: FAIL (still redirects to `/`)

**Step 2: Implement guard**

In each page, replace:

```ts
if (!profile.beta_access_granted_at) redirect("/")
```

with:

```ts
import { canAccessFeature } from "@/lib/feature-access"
import { FeatureComingSoon } from "@/components/beta/feature-coming-soon"

if (!canAccessFeature(profile, "birthGiving")) {
  return <FeatureComingSoon featureName="Birth Giving" />
}
// similarly: "teamDiary", "personalityTests", "customerMeetings", "teamDocuments", etc.
```

For Reading (`/cteni/*`), guard the layout:

```ts
if (!canAccessFeature(profile, "reading")) return <FeatureComingSoon featureName="Čtení" />
```

Ensure guard runs **before** any data queries.

**Step 3: Run tests**

Run: `pnpm test:component` and `pnpm test:e2e -- birth-giving` (or targeted)
Expected: PASS

**Step 4: Commit**

Run:
```bash
git add src/app/(main)/birth-giving/* src/app/(main)/tymovy-denik/* src/app/(main)/osobnostni-testy/page.tsx src/app/(main)/schuzky/* src/app/(main)/tymove-dokumenty/page.tsx src/app/(main)/nastroje-techniky/page.tsx src/app/(main)/koucovani/page.tsx src/app/(main)/tymova-reflexe/* src/app/(main)/cteni/layout.tsx
git commit -m "feat: render cooking screen for cohort-restricted pages"
```

---

## Task 8: Update API guards to cohort-aware 403s

**Files:**
- Modify: `src/app/api/birth-giving/_shared.ts:40-47`
- Modify: `src/app/api/tymovy-denik/activities/_shared.ts:89`
- Modify: `src/app/api/profile/notification-preferences/route.ts:17-19`
- Modify: `src/app/api/recurring-schedules/route.ts`, `src/app/api/recurring-schedules/[id]/route.ts`, `src/app/api/schedule-breaks/route.ts` (if beta-gated)
- Modify: `src/lib/birth-giving/queries.ts`, `src/lib/tymova-reflexe/*`, `src/lib/team-documents/*` RPC checks if needed
- Test: `src/app/api/birth-giving/_shared.test.ts` (new) or extend existing

**Step 1: Write failing test for API 403 on cohort A**

Mock `getCurrentUserProfile` returning cohort A and call `requireBirthGivingApiContext()`; expect 403 with beta message.

Run: `pnpm test:unit -- birth-giving`
Expected: FAIL (currently allows A)

**Step 2: Replace beta boolean checks with feature check**

In each `_shared.ts` / route:

```ts
import { canAccessFeature } from "@/lib/feature-access"
if (!canAccessFeature(profile, "birthGiving")) {
  return { response: NextResponse.json({ error: "Tato funkce vyžaduje beta přístup" }, { status: 403 }) }
}
```

For notification preferences, gate via `reading` so A can still manage reading notifications, but B-only features remain gated elsewhere.

**Step 3: Run tests**

Run: `pnpm test:unit -- birth-giving notification-preferences` and `pnpm test:integration` if RPCs touched
Expected: PASS

**Step 4: Commit**

Run:
```bash
git add src/app/api/birth-giving/_shared.ts src/app/api/tymovy-denik/activities/_shared.ts src/app/api/profile/notification-preferences/route.ts
git commit -m "feat: enforce cohort on API routes"
```

---

## Task 9: Preserve cohort through self-enrollment opt-out/opt-in

**Files:**
- Modify: `src/app/api/profile/beta-access/route.ts:26-31`
- Test: `src/app/api/profile/beta-access/route.test.ts` (new)

**Step 1: Write failing test**

Test that `PATCH { beta_access: false }` sets `beta_access_granted_at` to `null` but does **not** reset `beta_cohort`; re-enabling preserves previous cohort (B stays B, A stays A). Also test new enrollees get `beta_cohort: "A"` via DB default.

Run: `pnpm test:unit -- beta-access`
Expected: FAIL (currently only touches timestamp)

**Step 2: Implement**

In `src/app/api/profile/beta-access/route.ts`, when `beta_access` is true and `profile.beta_cohort` is null (legacy), set `beta_cohort: "A"` explicitly; when false, update only `beta_access_granted_at`. Ensure no cohort reset on opt-out.

```ts
const beta_access_granted_at = beta_access ? new Date().toISOString() : null
const patch: Record<string, unknown> = { beta_access_granted_at }
if (beta_access && !profile.beta_cohort) patch.beta_cohort = "A"
await supabase.from("profiles").update(patch).eq("id", profile.id)
```

Note: With `notNull` default `A`, legacy check is defensive.

**Step 3: Run tests**

Run: `pnpm test:unit -- beta-access`
Expected: PASS

**Step 4: Commit**

Run:
```bash
git add src/app/api/profile/beta-access/route.ts src/app/api/profile/beta-access/route.test.ts
git commit -m "feat: preserve cohort through beta opt-out"
```

---

## Task 10: Admin cohort assignment API

**Files:**
- Create: `src/app/api/admin/beta-cohort/route.ts`
- Create: `src/app/api/admin/beta-cohort/route.test.ts`

**Step 1: Write failing tests**

Cover:
- 401 when unauthenticated
- 403 when non-admin
- 400 when cohort invalid or missing
- 404 when target not found or not beta-enrolled
- 200 when admin updates A->B via service-role client (mock `createAdminClient`)

Run: `pnpm test:unit -- admin/beta-cohort`
Expected: FAIL (route missing)

**Step 2: Implement route**

Create `src/app/api/admin/beta-cohort/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentUserProfile } from "@/lib/auth-helpers"
import { z } from "zod"

const schema = z.object({ profileId: z.string().uuid(), beta_cohort: z.enum(["A","B"]) })

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 })
  const caller = await getCurrentUserProfile(supabase, { user })
  if (!caller || caller.role !== "admin") return NextResponse.json({ error: "Nedostatečná oprávnění" }, { status: 403 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Neplatná data" }, { status: 400 })
  const { profileId, beta_cohort } = parsed.data
  const admin = createAdminClient()
  const { data: target } = await admin.from("profiles").select("id, beta_access_granted_at, beta_cohort").eq("id", profileId).maybeSingle()
  if (!target || !target.beta_access_granted_at) return NextResponse.json({ error: "Profil nenalezen nebo není v betě" }, { status: 404 })
  const { data, error } = await admin.from("profiles").update({ beta_cohort }).eq("id", profileId).select("id, beta_cohort").single()
  if (error) return NextResponse.json({ error: "Nepodařilo se uložit" }, { status: 500 })
  return NextResponse.json({ data })
}
```

Important: explicit admin check **before** using `createAdminClient`.

**Step 3: Run tests**

Run: `pnpm test:unit -- admin/beta-cohort`
Expected: PASS

**Step 4: Commit**

Run:
```bash
git add src/app/api/admin/beta-cohort/route.ts src/app/api/admin/beta-cohort/route.test.ts
git commit -m "feat: add admin cohort assignment endpoint"
```

---

## Task 11: Admin panel on `/beta` page

**Files:**
- Modify: `src/app/(main)/beta/page.tsx:1-15`
- Create: `src/components/beta/beta-admin-panel.tsx`
- Create: `src/components/beta/beta-admin-panel.test.tsx`
- Modify: `src/components/beta/beta-page-content.tsx` (if needed to split)

**Step 1: Write failing component test**

Test `beta-admin-panel.test.tsx`:
- Renders search input and cohort selects for each beta participant.
- Changing select to B calls fetch `PATCH /api/admin/beta-cohort` with `{ profileId, beta_cohort: "B" }`, disables control while saving, shows success toast.
- Failed fetch rolls back value and shows destructive toast.

Run: `pnpm test:component -- beta-admin-panel`
Expected: FAIL

**Step 2: Implement server page + client panel**

Update `src/app/(main)/beta/page.tsx` to also fetch beta participants when caller is admin:

```ts
let participants: Participant[] = []
if (profile.role === "admin") {
  const admin = createAdminClient()
  const { data } = await admin.from("profiles").select("id, name, work_email, team_id, beta_cohort, beta_access_granted_at").not("beta_access_granted_at", "is", null).is("access_removed_at", null).order("name")
  participants = data ?? []
  // optionally join teams for display
}
return (
  <>
    <BetaPageContent initialBetaAccess={betaAccess} />
    {profile.role === "admin" && <BetaAdminPanel participants={participants} />}
  </>
)
```

Create `src/components/beta/beta-admin-panel.tsx`:
- Client component, searchable table (Input + Select from `src/components/ui/select`).
- For each row, `Select` with options A/B, `disabled={savingId === p.id}`.
- On change, optimistic update + `fetch("/api/admin/beta-cohort", { method: "PATCH", body: JSON.stringify({ profileId: p.id, beta_cohort: value }) })`.
- Use `sonner` `toast` for success/error, `router.refresh()` after success.
- Filter via `useMemo` on name/email includes search.
- Apply inclusive Czech copy: labels `Beta účastníci:ice`, placeholders `Hledat podle jména nebo e-mailu`.

**Step 3: Run tests and manual check**

Run: `pnpm test:component -- beta-admin-panel` and `pnpm typecheck`
Expected: PASS. Verify in browser that non-admin does not see panel.

**Step 4: Commit**

Run:
```bash
git add src/app/\(main\)/beta/page.tsx src/components/beta/beta-admin-panel.tsx src/components/beta/beta-admin-panel.test.tsx
git commit -m "feat: add admin cohort management to beta page"
```

---

## Task 12: PostHog cohort person properties (analytics only)

**Files:**
- Create: `src/components/posthog/posthog-identify.tsx`
- Modify: `src/app/(main)/layout.tsx:13-58` or `src/app/layout.tsx` to mount component
- Modify: `src/app/posthog-provider.tsx` if adding reset logic

**Step 1: Write failing test for identify helper**

Create test for `posthog-identify` helper that given `{ id, beta_access, beta_cohort }` calls `posthog.identify` with correct properties and `posthog.setPersonProperties`.

Run: `pnpm test:unit -- posthog-identify`
Expected: FAIL

**Step 2: Implement**

Create `src/components/posthog/posthog-identify.tsx`:

```tsx
"use client"
import { useEffect } from "react"
import { usePostHog } from "posthog-js/react"

export function PostHogIdentify({ distinctId, betaAccess, betaCohort }: { distinctId: string; betaAccess: boolean; betaCohort: "A" | "B" }) {
  const posthog = usePostHog()
  useEffect(() => {
    if (!posthog) return
    posthog.identify(distinctId, { beta_access: betaAccess, beta_cohort: betaCohort })
  }, [posthog, distinctId, betaAccess, betaCohort])
  return null
}
```

Mount inside `(main)/layout.tsx` after `getSessionProfile()`:

```tsx
<PostHogIdentify distinctId={profile.id} betaAccess={!!profile.beta_access_granted_at} betaCohort={(profile.beta_cohort as "A"|"B") ?? "A"} />
```

On logout (`NavUser`/`ProfileHub`), call `posthog.reset()` before `supabase.auth.signOut()`.

**Step 3: Verify**

Run: `pnpm test:unit -- posthog-identify` and `pnpm typecheck`
Expected: PASS. Verify events in PostHog are segmentable by `beta_cohort`.

**Step 4: Commit**

Run:
```bash
git add src/components/posthog/posthog-identify.tsx src/app/\(main\)/layout.tsx src/components/nav-user.tsx src/components/navigation/profile-hub.tsx
git commit -m "feat: identify PostHog with beta cohort"
```

---

## Task 13: Regression hardening for notifications and RLS notes

**Files:**
- Review: `src/lib/notifications/book-notifications.ts`, `src/lib/notifications/essay-notifications.ts`, `src/lib/notifications/birth-giving-notifications.ts`
- Modify only if needed: `src/app/api/profile/notification-preferences/route.ts` already gated via Task 8
- Create: `src/lib/notifications/feature-notifications.test.ts` (if gap found)
- Document: `docs/plans/2026-08-27-beta-cohort-feature-access-design.md` amendment if RLS needs follow-up

**Step 1: Audit**

Check that reading notifications still fire for A (do not narrow to B). Birth Giving and other B-only notifications must check `canAccessFeature(..., feature)` instead of raw `beta_access_granted_at`.

**Step 2: Fix only the narrow gaps**

If a notification sender filters coaches/students via `beta_access_granted_at is not null`, extend to also check `beta_cohort` in `B` where appropriate, or delegate to `canAccessFeature` after fetching profile row.

**Step 3: Test**

Run: `pnpm test:unit -- notifications`
Expected: PASS

**Step 4: Commit (only if changed)**

Run:
```bash
git add src/lib/notifications/*
git commit -m "feat: align notifications with cohort gating"
```

---

## Task 14: Full verification and rollout checklist

**Files:**
- No new files; verification only.

**Step 1: Run fast suite**

Run: `pnpm test`
Expected: All unit + component tests PASS

**Step 2: Run integration and E2E for touched areas**

Run:
```bash
pnpm test:integration -- profiles.beta-cohort
pnpm test:e2e -- beta cohort feature-access
```
Expected: PASS; E2E covers direct URL cooking screen, sidebar filtering, moduly hub, admin assignment, PostHog identify.

**Step 3: Static checks and build**

Run:
```bash
pnpm typecheck
pnpm lint
pnpm build
```
Expected: exit 0, no errors.

**Step 4: Migration review gate**

Confirm `pnpm db:generate` reports "No schema changes" after `pnpm db:migrate`. Re-inspect the committed migration file for any `DROP`.

**Step 5: Update design doc if behavior changed**

If any task forced a visible product decision change (e.g., RLS postponed), amend `docs/plans/2026-08-27-beta-cohort-feature-access-design.md` with an Amendment section dated `2026-08-27`.

Do not create a PR or push until verification passes per `verification-before-completion`.

