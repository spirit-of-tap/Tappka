# Sidebar Design Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every issue raised in `docs/design-reviews/2026-07-28-sidebar-design-review.md` — the cross-cutting design-system gaps (hardcoded colors, missing focus rings, inconsistent empty states/headers/containers/loading states) plus the per-page findings for all 8 sidebar sections.

**Architecture:** Build the missing shared primitives first (semantic color tokens, a focus-ring utility, `PageHeader`, `PageShell`, a `pluralizeCz` helper), fix the 5 standalone correctness bugs next since they're small and independent, then do one pass per sidebar section applying the shared primitives plus that section's own findings. The reservations keyboard-accessibility item is the largest single piece of new interaction code, so it runs last.

**Tech Stack:** Next.js App Router, React Server + Client Components, Tailwind v4 (`@theme inline` token mapping in `src/app/globals.css`), shadcn/ui, `sonner` toasts, Vitest + React Testing Library.

## Global Constraints

- TypeScript strict mode — no `any`, `interface` over `type` (except derived DB types), `??` over `||`.
- Naming: PascalCase components/types, camelCase vars/functions, UPPER_SNAKE_CASE constants, kebab-case files.
- Imports: external → `@/` internal → styles, one blank line between groups.
- Never hardcode magic values — extract to named constants or `as const` objects.
- Realtime channels (none touched by this plan) must stay on `broadcast`, never `postgres_changes`.
- No DB schema changes in this plan — skip the migration workflow entirely.
- Run `pnpm test` (unit + component) and `pnpm typecheck` before each commit; this plan touches no integration/E2E-only surfaces so those layers aren't required per-task, but run `pnpm test` in full before the final task.
- One correction to the source review: the finding that schůzky's Czech pluralization ternary "mishandles values like 22-24" is incorrect — Czech CLDR pluralization (`few` = i ∈ {2,3,4} exactly, not last-digit modulo) means the existing `n >= 2 && n <= 4` check is already linguistically correct for 22-24 (→ "schůzek", not "schůzky"). Task 8 extracts the logic into a shared, tested helper for reuse, but does **not** change its behavior.

---

## File structure

New files this plan creates:
- `src/lib/utils/pluralize-cz.ts` + `.test.ts` — shared Czech plural-form helper.
- `src/components/ui/page-header.tsx` + `.test.tsx` — shared list-page header (title + de-emphasized count + primary action).
- `src/components/ui/page-shell.tsx` + `.test.tsx` — shared page container (padding + named max-width variants).
- `src/lib/dashboard/types.test.ts` — unit tests for the new widget-availability filter.
- `src/app/(main)/komunita/profil/[id]/loading.tsx`, `src/app/(main)/komunita/tymy/[id]/loading.tsx`
- `src/app/(main)/tymova-reflexe/loading.tsx`, `src/app/(main)/tymova-reflexe/[id]/loading.tsx`, `src/app/(main)/tymova-reflexe/semestralni/[id]/loading.tsx`
- `src/app/(main)/zpetna-vazba/loading.tsx`

Existing files this plan modifies are named per-task below.

---

### Task 1: Semantic color tokens + shared focus-ring utility

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: Tailwind utility classes `bg-success`/`text-success`/`border-success` (+ `-foreground` variants), same for `warning` and `info`, usable anywhere in the app the moment this task lands. Produces a `.focus-ring` utility class equivalent to shadcn `Button`'s own focus treatment.

- [ ] **Step 1: Add the three semantic tokens to `:root` (light theme)**

In `src/app/globals.css`, inside the existing `:root { ... }` block (starts at line 74), add these lines directly after the `--destructive-foreground` declaration (currently line 99):

```css
  --success: oklch(0.6 0.14 145); /* Positive/available status */
  --success-foreground: oklch(1 0 0);
  --warning: oklch(0.758 0.152 69.3); /* Same hue as --chart-2 Amber */
  --warning-foreground: oklch(0.145 0 0);
  --info: oklch(0.635 0.089 195.1); /* Same hue as --chart-3 Teal */
  --info-foreground: oklch(1 0 0);
```

- [ ] **Step 2: Add the dark-theme variants to `.dark`**

Inside the existing `.dark { ... }` block (starts at line 124), add directly after its `--destructive-foreground` declaration (currently line 147):

```css
  --success: oklch(0.72 0.15 145); /* Brightened for dark, same pattern as --primary/--destructive above */
  --success-foreground: oklch(1 0 0);
  --warning: oklch(0.792 0.137 72.4); /* Same hue as dark --chart-2 */
  --warning-foreground: oklch(0.145 0 0);
  --info: oklch(0.761 0.103 195.2); /* Same hue as dark --chart-3 */
  --info-foreground: oklch(1 0 0);
```

- [ ] **Step 3: Map the tokens into Tailwind's `@theme inline` block**

In the `@theme inline { ... }` block (starts at line 20), add directly after the existing `--color-destructive-foreground: var(--destructive-foreground);` line:

```css
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
```

- [ ] **Step 4: Add the shared focus-ring utility**

Near the bottom of `src/app/globals.css` (after the existing `mark[data-color=...]` rules), add:

```css
@layer utilities {
  .focus-ring {
    @apply outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px];
  }
}
```

- [ ] **Step 5: Verify the build compiles the new tokens/utility**

Run: `pnpm build`
Expected: build succeeds with no Tailwind/CSS errors. Then run `grep -n "color-success\|color-warning\|color-info\|focus-ring" src/app/globals.css` and confirm all six token mappings and the `.focus-ring` rule are present.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add semantic status tokens and shared focus-ring utility"
```

---

### Task 2: Shared `pluralizeCz` helper, `PageHeader`, and `PageShell` components

**Files:**
- Create: `src/lib/utils/pluralize-cz.ts`
- Test: `src/lib/utils/pluralize-cz.test.ts`
- Create: `src/components/ui/page-header.tsx`
- Test: `src/components/ui/page-header.test.tsx`
- Create: `src/components/ui/page-shell.tsx`
- Test: `src/components/ui/page-shell.test.tsx`

**Interfaces:**
- Produces: `pluralizeCz(count: number, forms: [one: string, few: string, many: string]): string`.
- Produces: `\<PageHeader title={string} description?={string} count?={\{ value: number; label: string }} action?={ReactNode} />`.
- Produces: `\<PageShell size?={"full" | "narrow" | "medium" | "wide"} className?={string}>{children}\</PageShell>` (default `size="full"`).
- Consumes (PageShell only): `cn` from `@/lib/utils`.

- [ ] **Step 1: Write the failing test for `pluralizeCz`**

```ts
// src/lib/utils/pluralize-cz.test.ts
import { describe, expect, it } from "vitest"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"

describe("pluralizeCz", () => {
  it("uses the 'one' form for 1", () => {
    expect(pluralizeCz(1, ["schůzka", "schůzky", "schůzek"])).toBe("schůzka")
  })

  it("uses the 'few' form for 2-4", () => {
    expect(pluralizeCz(2, ["schůzka", "schůzky", "schůzek"])).toBe("schůzky")
    expect(pluralizeCz(4, ["schůzka", "schůzky", "schůzek"])).toBe("schůzky")
  })

  it("uses the 'many' form for 0 and 5+", () => {
    expect(pluralizeCz(0, ["schůzka", "schůzky", "schůzek"])).toBe("schůzek")
    expect(pluralizeCz(5, ["schůzka", "schůzky", "schůzek"])).toBe("schůzek")
  })

  it("uses the 'many' form for 22-24, not 'few' (Czech plural rules key off the absolute value, not the last digit)", () => {
    expect(pluralizeCz(22, ["schůzka", "schůzky", "schůzek"])).toBe("schůzek")
    expect(pluralizeCz(24, ["schůzka", "schůzky", "schůzek"])).toBe("schůzek")
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm vitest run src/lib/utils/pluralize-cz.test.ts`
Expected: FAIL with "Cannot find module '@/lib/utils/pluralize-cz'".

- [ ] **Step 3: Implement `pluralizeCz`**

```ts
// src/lib/utils/pluralize-cz.ts
/**
 * Czech grammatical number for count nouns, backed by Intl.PluralRules('cs')
 * (CLDR): "one" is exactly 1, "few" is the integer 2-4, everything else
 * (0, 5+, including 22-24 which is NOT "few" in Czech) takes the third form.
 */
export function pluralizeCz(
  count: number,
  forms: [one: string, few: string, many: string],
): string {
  const [one, few, many] = forms
  const rule = new Intl.PluralRules("cs").select(count)
  if (rule === "one") return one
  if (rule === "few") return few
  return many
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm vitest run src/lib/utils/pluralize-cz.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing test for `PageHeader`**

```tsx
// src/components/ui/page-header.test.tsx
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { PageHeader } from "@/components/ui/page-header"

describe("PageHeader", () => {
  it("renders the title as an h1 and an optional description", () => {
    render(<PageHeader title="Zákaznické schůzky" description="Záznamník schůzek" />)
    expect(screen.getByRole("heading", { level: 1, name: "Zákaznické schůzky" })).toBeInTheDocument()
    expect(screen.getByText("Záznamník schůzek")).toBeInTheDocument()
  })

  it("renders the count next to the action instead of as a dominant stat", () => {
    render(<PageHeader title="Koučování" count={{ value: 7, label: "sezení" }} action={<button>Nové sezení</button>} />)
    expect(screen.getByText("7 sezení")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Nové sezení" })).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run it to confirm it fails**

Run: `pnpm vitest run src/components/ui/page-header.test.tsx`
Expected: FAIL with "Cannot find module '@/components/ui/page-header'".

- [ ] **Step 7: Implement `PageHeader`**

```tsx
// src/components/ui/page-header.tsx
import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  description?: string
  count?: { value: number; label: string }
  action?: ReactNode
}

export function PageHeader({ title, description, count, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        {count && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {count.value} {count.label}
          </span>
        )}
        {action}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Run the test to confirm it passes**

Run: `pnpm vitest run src/components/ui/page-header.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 9: Write the failing test for `PageShell`**

```tsx
// src/components/ui/page-shell.test.tsx
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { PageShell } from "@/components/ui/page-shell"

describe("PageShell", () => {
  it("applies horizontal padding by default so content never touches the viewport edge", () => {
    render(<PageShell><p>content</p></PageShell>)
    expect(screen.getByText("content").parentElement).toHaveClass("px-3", "sm:px-6")
  })

  it("applies the requested max-width variant", () => {
    render(<PageShell size="narrow"><p>content</p></PageShell>)
    expect(screen.getByText("content").parentElement).toHaveClass("max-w-2xl")
  })
})
```

- [ ] **Step 10: Run it to confirm it fails**

Run: `pnpm vitest run src/components/ui/page-shell.test.tsx`
Expected: FAIL with "Cannot find module '@/components/ui/page-shell'".

- [ ] **Step 11: Implement `PageShell`**

```tsx
// src/components/ui/page-shell.tsx
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type PageShellSize = "full" | "narrow" | "medium" | "wide"

const SIZE_CLASSES: Record<PageShellSize, string> = {
  full: "",
  narrow: "max-w-2xl",
  medium: "max-w-3xl",
  wide: "max-w-4xl",
}

interface PageShellProps {
  size?: PageShellSize
  className?: string
  children: ReactNode
}

export function PageShell({ size = "full", className, children }: PageShellProps) {
  return (
    <div
      className={cn(
        "container mx-auto space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 12: Run the test to confirm it passes**

Run: `pnpm vitest run src/components/ui/page-shell.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 13: Commit**

```bash
git add src/lib/utils/pluralize-cz.ts src/lib/utils/pluralize-cz.test.ts \
  src/components/ui/page-header.tsx src/components/ui/page-header.test.tsx \
  src/components/ui/page-shell.tsx src/components/ui/page-shell.test.tsx
git commit -m "feat: add pluralizeCz helper and shared PageHeader/PageShell components"
```

---

### Task 3: Fix the 5 standalone correctness bugs

**Files:**
- Modify: `src/lib/dashboard/types.ts`
- Test: `src/lib/dashboard/types.test.ts`
- Modify: `src/app/(main)/page.tsx`
- Modify: `src/components/individual-coaching-sessions/individual-coaching-session-card.tsx`
- Modify: `src/components/individual-coaching-sessions/individual-coaching-session-list.tsx`
- Modify: `src/components/reservations/my-reservations.tsx`
- Modify: `src/lib/tymova-reflexe/month-grid.ts`
- Test: `src/lib/tymova-reflexe/month-grid.test.ts` (create if it doesn't already exist)
- Modify: `src/components/tymova-reflexe/team-reflection-list.tsx`

**Interfaces:**
- Produces (from `month-grid.ts`): `isSemesterMonth(monthKey: string): boolean`, exported alongside the existing `buildSchoolYears`/`rocnikForSchoolYear`.
- Produces (from `dashboard/types.ts`): `availableWidgetIds(ids: DashboardWidgetId[], hasMetricsAccess: boolean): DashboardWidgetId[]` and `availableWidgets(widgets: DashboardWidgetMeta[], hasMetricsAccess: boolean): DashboardWidgetMeta[]`.

#### Bug 1 — dashboard "metrics" widget can get stuck on an infinite skeleton

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/dashboard/types.test.ts
import { describe, expect, it } from "vitest"
import { availableWidgetIds, availableWidgets, DASHBOARD_WIDGETS } from "@/lib/dashboard/types"

describe("availableWidgetIds", () => {
  it("keeps metrics when the user has beta access", () => {
    expect(availableWidgetIds(["quick-actions", "metrics"], true)).toEqual(["quick-actions", "metrics"])
  })

  it("drops a stale 'metrics' entry when beta access is missing, so it can never render as a permanent skeleton", () => {
    expect(availableWidgetIds(["quick-actions", "metrics"], false)).toEqual(["quick-actions"])
  })
})

describe("availableWidgets", () => {
  it("excludes the metrics catalog entry when beta access is missing", () => {
    const ids = availableWidgets(DASHBOARD_WIDGETS, false).map((w) => w.id)
    expect(ids).not.toContain("metrics")
  })

  it("includes the metrics catalog entry when beta access is present", () => {
    const ids = availableWidgets(DASHBOARD_WIDGETS, true).map((w) => w.id)
    expect(ids).toContain("metrics")
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm vitest run src/lib/dashboard/types.test.ts`
Expected: FAIL — `availableWidgetIds`/`availableWidgets` are not exported yet.

- [ ] **Step 3: Implement the filter helpers**

In `src/lib/dashboard/types.ts`, add after `sanitizeWidgetIds`:

```ts
/**
 * Drops widgets whose extra precondition isn't met (currently: 'metrics'
 * requires beta access), so a stale saved layout can't reference a widget
 * that will never get a node and render as a permanent loading skeleton.
 */
export function availableWidgetIds(ids: DashboardWidgetId[], hasMetricsAccess: boolean): DashboardWidgetId[] {
  return hasMetricsAccess ? ids : ids.filter((id) => id !== "metrics")
}

export function availableWidgets(widgets: DashboardWidgetMeta[], hasMetricsAccess: boolean): DashboardWidgetMeta[] {
  return hasMetricsAccess ? widgets : widgets.filter((w) => w.id !== "metrics")
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm vitest run src/lib/dashboard/types.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire the helpers into the dashboard page**

In `src/app/(main)/page.tsx`, change:

```ts
import {
  sanitizeWidgetIds,
  widgetsForRole,
  type DashboardWidgetId,
} from "@/lib/dashboard/types";
```
to:
```ts
import {
  sanitizeWidgetIds,
  widgetsForRole,
  availableWidgetIds,
  availableWidgets,
  type DashboardWidgetId,
} from "@/lib/dashboard/types";
```

Then change (currently line 69):
```ts
  const layout = sanitizeWidgetIds(layoutRow?.widgets, profile.role);
```
to:
```ts
  const hasMetricsAccess = !!profile.beta_access_granted_at;
  const layout = availableWidgetIds(
    sanitizeWidgetIds(layoutRow?.widgets, profile.role),
    hasMetricsAccess,
  );
```

And change the `DashboardEditor` call (currently line 142-146):
```tsx
      <DashboardEditor
        initialLayout={layout}
        catalog={widgetsForRole(profile.role)}
        nodes={nodes}
      />
```
to:
```tsx
      <DashboardEditor
        initialLayout={layout}
        catalog={availableWidgets(widgetsForRole(profile.role), hasMetricsAccess)}
        nodes={nodes}
      />
```

(The existing `if (has("metrics") && stats && profile.beta_access_granted_at)` node-building guard stays as-is — it's now unreachable-safe rather than "sometimes never resolves", because `has("metrics")` can no longer be true when beta access is missing.)

#### Bug 2 — duplicate "Sezení aktualizováno" toast on coaching-session edit

- [ ] **Step 6: Remove the redundant toast**

In `src/components/individual-coaching-sessions/individual-coaching-session-card.tsx`, change (currently lines 92-96):

```ts
  function handleUpdated(updated: IndividualCoachingSessionWithCoach) {
    setEditOpen(false)
    onUpdated(updated)
    toast.success("Sezení aktualizováno")
  }
```
to:
```ts
  function handleUpdated(updated: IndividualCoachingSessionWithCoach) {
    setEditOpen(false)
    onUpdated(updated)
  }
```

(`IndividualCoachingSessionForm`'s own `onSuccess` caller already fires `toast.success("Sezení aktualizováno")` at `individual-coaching-session-form.tsx:89` before invoking this callback — that stays the single source of truth for both create and edit.)

#### Bug 3 — empty-state "Přidat sezení" button only works by accident

- [ ] **Step 7: Fix the incomplete `Dialog` wrapper**

In `src/components/individual-coaching-sessions/individual-coaching-session-list.tsx`, change (currently lines 199-208):

```tsx
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
```
to:
```tsx
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Přidat sezení
            </Button>
          </EmptyContent>
```

This reuses the single already-mounted `Dialog`/`DialogContent` at lines 132-150 via the shared `createOpen`/`setCreateOpen` state, instead of nesting a second, contentless `Dialog`.

#### Bug 4 — `EditReservationDialog` mounted twice

- [ ] **Step 8: Delete the duplicate mount**

In `src/components/reservations/my-reservations.tsx`, the component renders `<EditReservationDialog reservation={reservation} open={editOpen} onOpenChange={setEditOpen} />` twice back-to-back (currently lines 186-190 and 209-213, with an `AlertDialog` in between). Delete the second occurrence (lines 209-213), keeping the `AlertDialog` block and the first `EditReservationDialog` mount.

#### Bug 5 — "Nová reflexe" CTA can create a monthly reflection in a semester-only month

- [ ] **Step 9: Write the failing test for `isSemesterMonth`**

```ts
// src/lib/tymova-reflexe/month-grid.test.ts
import { describe, expect, it } from "vitest"
import { isSemesterMonth } from "@/lib/tymova-reflexe/month-grid"

describe("isSemesterMonth", () => {
  it("is true for January and May", () => {
    expect(isSemesterMonth("2026-01-01")).toBe(true)
    expect(isSemesterMonth("2026-05-01")).toBe(true)
  })

  it("is false for every other month", () => {
    expect(isSemesterMonth("2026-09-01")).toBe(false)
    expect(isSemesterMonth("2026-12-01")).toBe(false)
  })
})
```

- [ ] **Step 10: Run it to confirm it fails**

Run: `pnpm vitest run src/lib/tymova-reflexe/month-grid.test.ts`
Expected: FAIL — `isSemesterMonth` is not exported.

- [ ] **Step 11: Export `isSemesterMonth`**

In `src/lib/tymova-reflexe/month-grid.ts`, add directly after the `SEMESTER_MONTHS` constant (currently line 26):

```ts
export function isSemesterMonth(monthKey: string): boolean {
  const month = Number(monthKey.split("-")[1])
  return SEMESTER_MONTHS.has(month)
}
```

- [ ] **Step 12: Run the test to confirm it passes**

Run: `pnpm vitest run src/lib/tymova-reflexe/month-grid.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 13: Route the CTA by month type in `team-reflection-list.tsx`**

Change the import (currently just importing types from `month-grid`, or add if absent):
```ts
import { isSemesterMonth } from "@/lib/tymova-reflexe/month-grid"
```

Change (currently lines 44-45):
```ts
  const currentMonth = getCurrentMonth()
  const hasCurrentMonthReflection = items.some((r) => r.month === currentMonth)
```
to:
```ts
  const currentMonth = getCurrentMonth()
  const currentMonthIsSemester = isSemesterMonth(currentMonth)
  const hasCurrentReflection = currentMonthIsSemester
    ? semesterItems.some((r) => r.semester_month === currentMonth)
    : items.some((r) => r.month === currentMonth)
  const newReflectionHref = currentMonthIsSemester
    ? "/tymova-reflexe/semestralni/nova"
    : "/tymova-reflexe/nova"
```

Change the CTA block (currently lines 73-82):
```tsx
      {!hasCurrentMonthReflection && (
        <div className="flex items-center justify-end gap-4">
          <Button size="sm" asChild>
            <Link href="/tymova-reflexe/nova">
              <Plus className="size-4" />
              Nová reflexe
            </Link>
          </Button>
        </div>
      )}
```
to:
```tsx
      {!hasCurrentReflection && (
        <div className="flex items-center justify-end gap-4">
          <Button size="sm" asChild>
            <Link href={newReflectionHref}>
              <Plus className="size-4" />
              Nová reflexe
            </Link>
          </Button>
        </div>
      )}
```

And the empty-state CTA (currently lines 98-105, `Link href="/tymova-reflexe/nova"`) to use `newReflectionHref` the same way.

- [ ] **Step 14: Run the full unit/component suite**

Run: `pnpm test`
Expected: all pass, including the new tests from steps 1-12.

- [ ] **Step 15: Commit**

```bash
git add src/lib/dashboard/types.ts src/lib/dashboard/types.test.ts \
  "src/app/(main)/page.tsx" \
  src/components/individual-coaching-sessions/individual-coaching-session-card.tsx \
  src/components/individual-coaching-sessions/individual-coaching-session-list.tsx \
  src/components/reservations/my-reservations.tsx \
  src/lib/tymova-reflexe/month-grid.ts src/lib/tymova-reflexe/month-grid.test.ts \
  src/components/tymova-reflexe/team-reflection-list.tsx
git commit -m "fix: dashboard stuck-metrics skeleton, duplicate toast/dialog/mount bugs, wrong-month reflection CTA"
```

---

### Task 4: Dashboard — remaining findings

**Files:**
- Modify: `src/components/dashboard/dashboard-editor.tsx`

**Interfaces:**
- Consumes: `Empty`, `EmptyMedia`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription`, `EmptyContent` from `@/components/ui/empty` (already used elsewhere in the app, e.g. `individual-coaching-session-list.tsx`).
- Consumes: `.focus-ring` utility from Task 1.

- [ ] **Step 1: Fix the icon-button size override**

Change all three occurrences of `className="size-6"` on the move-up/move-down/remove `Button`s (currently lines 167, 177, 187 — the third also has `text-destructive hover:text-destructive`) to use the existing `icon-sm` size variant instead of overriding via `className`:

```tsx
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Posunout výš"
                >
```
(repeat for the down and remove buttons, keeping `disabled`/`onClick`/`aria-label`/the destructive className on the remove button, just swapping `size="icon" className="size-6"` → `size="icon-sm"`).

- [ ] **Step 2: Rebuild the empty-dashboard state on the shared `Empty` primitives**

Add the import:
```ts
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
```

Replace the hand-rolled block (currently lines 79-104):
```tsx
      <div className="rounded-xl border border-dashed p-8">
        <div className="mb-6 text-center">
          <LayoutDashboard className="size-8 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-medium">Tvůj dashboard je zatím prázdný</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Vyber si widgety, které tu chceš mít.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 max-w-2xl mx-auto">
          {catalog.map((w) => (
            <button
              key={w.id}
              onClick={() => add(w.id)}
              className="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
            >
              <Plus className="size-4 mt-0.5 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-medium">{w.label}</span>
                <span className="block text-xs text-muted-foreground">{w.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
```
with:
```tsx
      <Empty>
        <EmptyMedia variant="icon">
          <LayoutDashboard className="size-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>Tvůj dashboard je zatím prázdný</EmptyTitle>
          <EmptyDescription>Vyber si widgety, které tu chceš mít.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="grid gap-3 sm:grid-cols-2 max-w-2xl mx-auto w-full">
            {catalog.map((w) => (
              <button
                key={w.id}
                onClick={() => add(w.id)}
                className="focus-ring flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
              >
                <Plus className="size-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-medium">{w.label}</span>
                  <span className="block text-xs text-muted-foreground">{w.description}</span>
                </span>
              </button>
            ))}
          </div>
        </EmptyContent>
      </Empty>
```

- [ ] **Step 3: Add `focus-ring` to the widget-picker popover buttons**

Change (currently lines 121-129):
```tsx
                  <button
                    key={w.id}
                    onClick={() => add(w.id)}
                    className="w-full rounded-md p-2 text-left transition-colors hover:bg-muted"
                  >
```
to:
```tsx
                  <button
                    key={w.id}
                    onClick={() => add(w.id)}
                    className="focus-ring w-full rounded-md p-2 text-left transition-colors hover:bg-muted"
                  >
```

- [ ] **Step 4: Add a success toast on layout save**

In `persist()` (currently lines 46-60), change:
```ts
      if (!res.ok) throw new Error();
      router.refresh();
```
to:
```ts
      if (!res.ok) throw new Error();
      router.refresh();
      toast.success('Rozložení uloženo.');
```

- [ ] **Step 5: Move the "Upravit" toggle out of its own toolbar row**

Change the wrapper from a full-width `flex justify-end` row to a `Popover`+`Button` group placed in the caller's hero row instead. In `dashboard-editor.tsx`, change the outer return (currently lines 107-109) from:
```tsx
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
```
to:
```tsx
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 -mt-12 sm:-mt-2">
```
This pulls the toolbar up to sit alongside the hero heading's baseline instead of stacking a second full-width bar below it (the hero block in `page.tsx` renders directly above `<DashboardEditor />` with `mb-8`, so a small negative margin here is the minimal fix; do not change `page.tsx`'s markup structure).

- [ ] **Step 6: Normalize the spacing rhythm on the hero/editor/support blocks**

In `src/app/(main)/page.tsx`, change the hero wrapper (currently line 133) from `<div className="mb-8">` to `<div className="mb-6">`, and the support-line wrapper (currently line 149) from `<div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">` to `<div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">`. This aligns both to the same `space-y-4`/`gap-*` step (`4`→1rem, doubled to `6`→1.5rem for section breaks) `DashboardEditor` already uses internally, instead of three unrelated one-off values (32px/16px/40px).

- [ ] **Step 7: Verify**

Run: `pnpm test && pnpm typecheck`
Expected: all pass. Then run `pnpm dev`, open `/` as a user with an empty dashboard layout and as a user with widgets, and confirm: the empty state matches the visual style of the Koučování/Zák. schůzky empty states, the edit-mode icon buttons are visibly larger, tabbing through the widget picker shows a focus ring, saving a layout change shows both a success and (on a simulated failure) error toast.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/dashboard-editor.tsx "src/app/(main)/page.tsx"
git commit -m "fix: dashboard empty state, icon-button sizing, focus rings, toolbar layout, spacing rhythm"
```

---

### Task 5: Místnosti — semantic color tokens

**Files:**
- Modify: `src/components/reservations/room-card.tsx`
- Modify: `src/lib/reservations/utils.ts`
- Modify: `src/components/reservations/day-schedule.tsx`
- Modify: `src/components/reservations/week-schedule.tsx`
- Modify: `src/components/reservations/conflict-resolution-dialog.tsx`

**Interfaces:**
- Consumes: `success`/`warning` tokens from Task 1 (`bg-success`, `border-success`, `bg-warning`, `border-warning`, etc. — all generated automatically by the `@theme inline` mapping).

- [ ] **Step 1: Fix the room-status color (the actual "Volná"/"Obsazeno" bug)**

In `src/components/reservations/room-card.tsx`, change (currently lines 26-28):
```ts
  const statusColor = isOccupied
    ? "border-red-500 bg-red-50 dark:bg-red-950/20"
    : "border-green-500 bg-green-50 dark:bg-green-950/20";
```
to:
```ts
  const statusColor = isOccupied
    ? "border-destructive bg-destructive/5"
    : "border-success bg-success/5";
```
(`statusBadge`, further down, already uses `variant: "destructive"` for occupied — leave that as-is; only `default` for "Volná" is a separate concern the badge component itself controls and is out of scope here since it's a `Badge` variant, not a raw color class.)

Also find the gray filtered-out banner (`grep -n "gray-200\|gray-800" src/components/reservations/room-card.tsx`) and replace `bg-gray-200 ... text-gray-800` (and its dark variants) with `bg-muted text-muted-foreground` — these are exactly what the existing `muted` token already means, no new token needed.

- [ ] **Step 2: Fix `getReservationColorClasses`**

In `src/lib/reservations/utils.ts`, change (currently lines 342-350):
```ts
export function getReservationColorClasses(kind: ReservationKind | string): string {
  switch (kind) {
    case "training_session":
      return "bg-red-100 dark:bg-red-950/50 border-red-500 text-red-900 dark:text-red-100";
    case "houston_calling":
      return "bg-purple-100 dark:bg-purple-950/50 border-purple-500 text-purple-900 dark:text-purple-100";
    default:
      return "bg-blue-100 dark:bg-blue-950/50 border-blue-500 text-blue-900 dark:text-blue-100";
  }
}
```
to:
```ts
export function getReservationColorClasses(kind: ReservationKind | string): string {
  switch (kind) {
    case "training_session":
      return "bg-chart-1/10 border-chart-1 text-chart-1";
    case "houston_calling":
      return "bg-chart-4/10 border-chart-4 text-chart-4";
    default:
      return "bg-chart-3/10 border-chart-3 text-chart-3";
  }
}
```
(Reservation *kind* is a category, not a status — map onto the existing categorical `chart-1..5` tokens rather than the new status tokens.)

- [ ] **Step 3: Fix the schedule-break color**

In `src/components/reservations/day-schedule.tsx` (around line 381) and `src/components/reservations/week-schedule.tsx` (around lines 215, 234, 275), replace hardcoded `emerald-100`/`emerald-50` (and dark variants) used for schedule breaks with `bg-warning/10 border-warning` — a schedule break is a "this slot is unavailable" caution state, which is what `warning` represents.

- [ ] **Step 4: Fix the conflict-resolution-dialog color**

In `src/components/reservations/conflict-resolution-dialog.tsx` (around lines 73, 81), replace hardcoded `orange-600`/`orange-50`/`orange-200` with `text-warning`/`bg-warning/10`/`border-warning/20` respectively.

- [ ] **Step 5: Verify no hardcoded status colors remain**

Run: `grep -rn "red-[0-9]\|green-[0-9]\|purple-[0-9]\|blue-[0-9]\|emerald-[0-9]\|orange-[0-9]\|gray-[0-9]" src/components/reservations/room-card.tsx src/lib/reservations/utils.ts src/components/reservations/day-schedule.tsx src/components/reservations/week-schedule.tsx src/components/reservations/conflict-resolution-dialog.tsx`
Expected: no matches.

Run: `pnpm test && pnpm typecheck`
Expected: all pass (no existing test asserts these exact class strings — confirm by checking `grep -rl "getReservationColorClasses\|statusColor" src/components/reservations/*.test.tsx src/lib/reservations/*.test.ts` for any hits and updating their expected class strings if present).

- [ ] **Step 6: Commit**

```bash
git add src/components/reservations/room-card.tsx src/lib/reservations/utils.ts \
  src/components/reservations/day-schedule.tsx src/components/reservations/week-schedule.tsx \
  src/components/reservations/conflict-resolution-dialog.tsx
git commit -m "fix: migrate reservations hardcoded colors onto semantic/chart tokens"
```

---

### Task 6: Místnosti — replace `window.confirm()` with the shared `AlertDialog`

**Files:**
- Modify: `src/components/reservations/reservation-detail-dialog.tsx`
- Modify: `src/components/reservations/training-sessions-manager.tsx`
- Modify: `src/components/reservations/schedule-breaks-manager.tsx`

**Interfaces:**
- Consumes: `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction` from `@/components/ui/alert-dialog` (the same primitives `my-reservations.tsx` already uses at lines 192-207).

- [ ] **Step 1: `reservation-detail-dialog.tsx`**

Find the `window.confirm("Opravdu chceš zrušit tuto rezervaci?")` call (around line 223). Introduce a local `deleteConfirmOpen` state (`useState(false)`), replace the direct cancel handler with one that opens an `AlertDialog` styled exactly like `my-reservations.tsx:192-207`, using the copy `Opravdu chceš zrušit tuto rezervaci? Tato akce nelze vrátit zpět.` for the description, and call the existing cancel logic from the `AlertDialogAction onClick`.

- [ ] **Step 2: `training-sessions-manager.tsx`**

Find the `window.confirm(...)` call (around line 191) guarding the delete action. Apply the identical `AlertDialog` pattern: local open state, `AlertDialogTrigger` on the existing delete button (remove its direct `onClick={handleDelete}` and instead let it open the dialog), `AlertDialogAction` calls the real delete handler.

- [ ] **Step 3: `schedule-breaks-manager.tsx`**

Same pattern as Step 2 for its `window.confirm(...)` call (around line 102).

- [ ] **Step 4: Verify no native confirms remain in reservations**

Run: `grep -rn "window.confirm" src/components/reservations/`
Expected: no matches.

Run: `pnpm test && pnpm typecheck`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/reservations/reservation-detail-dialog.tsx \
  src/components/reservations/training-sessions-manager.tsx \
  src/components/reservations/schedule-breaks-manager.tsx
git commit -m "fix: replace native window.confirm with the shared AlertDialog in reservations"
```

---

### Task 7: Místnosti — remaining polish

**Files:**
- Modify: `src/components/reservations/room-filter.tsx`

- [ ] **Step 1: Add a loading indicator to availability filtering**

In `checkAvailability` (around lines 69-148), add an `isChecking` state (`useState(false)`), set it `true` before the fetch and `false` in a `finally`, and surface it as a small `Spinner` (from `@/components/ui/spinner`, already used elsewhere in the app, e.g. `search-page-client.tsx:92-94`) next to the "X volné z Y místností" counter in `rooms-with-filter.tsx` (around lines 71-75) when `isChecking` is true.

- [ ] **Step 2: Replace arbitrary pixel widths**

Change `w-[140px]` (around line 232, time picker wrapper) to `w-36`, and `w-[120px]` (around line 247, duration `Select`) to `w-32`.

- [ ] **Step 3: Verify**

Run: `pnpm test && pnpm typecheck`, then `pnpm dev` and manually confirm the filter bar still lays out correctly at mobile width and the spinner appears during a slow-network simulation (Chrome DevTools throttling).

- [ ] **Step 4: Commit**

```bash
git add src/components/reservations/room-filter.tsx src/components/reservations/rooms-with-filter.tsx
git commit -m "fix: add loading feedback to room availability filter, drop arbitrary pixel widths"
```

---

### Task 8: Zák. schůzky — full pass

**Files:**
- Modify: `src/app/(main)/schuzky/page.tsx`
- Modify: `src/app/(main)/schuzky/[meetingId]/page.tsx`
- Modify: `src/components/customer-meetings/customer-meeting-list.tsx`
- Modify: `src/components/customer-meetings/customer-meeting-detail.tsx`
- Modify: `src/components/customer-meetings/customer-meeting-form.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 2), `pluralizeCz` (Task 2), `.focus-ring` (Task 1).

- [ ] **Step 1: Replace the hand-rolled header with `PageHeader`**

In `src/app/(main)/schuzky/page.tsx`, import `PageHeader` from `@/components/ui/page-header` and `pluralizeCz` from `@/lib/utils/pluralize-cz`. Replace the header block (currently lines 24-33):
```tsx
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Zákaznické schůzky</h1>
          <p className="text-sm text-muted-foreground">
            Záznamník schůzek s lidmi z praxe
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold tabular-nums leading-none">{meetings.length}</p>
          <p className="text-sm text-muted-foreground">
            {meetings.length === 1 ? "schůzka" : meetings.length >= 2 && meetings.length <= 4 ? "schůzky" : "schůzek"}
          </p>
        </div>
      </div>
```
with:
```tsx
      <PageHeader
        title="Zákaznické schůzky"
        description="Záznamník schůzek s lidmi z praxe"
        count={{ value: meetings.length, label: pluralizeCz(meetings.length, ["schůzka", "schůzky", "schůzek"]) }}
      />
```
(The "Nová schůzka" button lives inside `CustomerMeetingList` today — leave it there for now; `PageHeader`'s `action` slot is for a page-level primary CTA, and moving the button up here would require threading `onCreated`/dialog-open state from the child up to the page, which is a larger refactor than this pass needs. The visual fix that matters — shrinking the oversized count and unifying the h1 scale — is achieved either way.)

- [ ] **Step 2: Fix the meeting-card link focus ring**

In `customer-meeting-list.tsx`, add `focus-ring rounded-xl` to the `className` of the card `Link`s at (currently) lines 165 and 249.

- [ ] **Step 3: Fix the month-group disclosure accessibility**

For both disclosure `<button>` elements (currently lines 146-161 and 224-239), add `aria-expanded={!collapsed.has(group.key)}` (or the undated-section equivalent) and `aria-controls` pointing at an `id` added to the following content `div` (currently lines 163 and 242), e.g. `id={`month-${group.key}-content`}` / `aria-controls={`month-${group.key}-content`}`.

- [ ] **Step 4: Fix the toggle verb/affordance**

Replace the text toggle (`{collapsed.has(...) ? "rozbalit" : "skrýt"}`, lines 159 and 237) with a `ChevronDown`/`ChevronRight` icon from `lucide-react` (already imported in this file) that rotates via `transition-transform` + a `rotate-0`/`-rotate-90` class keyed on collapsed state, removing the ambiguous verb-swap text entirely.

- [ ] **Step 5: Fix the empty-month line contrast and noise**

Change `text-muted-foreground/40 italic` (line 244) to `text-muted-foreground/70` (drop `italic`). Additionally, seed the `collapsed` state (in the `useState<Set<string>>` initializer) with the keys of any month in `groups` whose `count === 0`, so genuinely empty months default to collapsed instead of always showing the "— tento měsíc žádná schůzka" line.

- [ ] **Step 6: Map Supabase errors to Czech copy**

In `customer-meeting-form.tsx`, change the inline error banner (around line 91, currently rendering raw `err.message` for non-validation failures) to use the same generic Czech fallback string already used for the toast at line 83 (e.g. `"Nepodařilo se uložit schůzku."`) instead of the raw driver error.

- [ ] **Step 7: Fix the delete-trigger button variant**

In `customer-meeting-detail.tsx` (around line 112), change the "Smazat" trigger from `variant="outline"` with a `className="text-destructive"` override to `variant="destructive"` directly.

- [ ] **Step 8: Add a status badge to the meeting detail header**

In `src/app/(main)/schuzky/[meetingId]/page.tsx` (around line 45), derive a status from comparing `meeting.meeting_at` to `Date.now()` (three cases: no date set, in the future, in the past) and render a small `Badge` next to the date with the corresponding label ("Bez data" / "Naplánováno" / "Proběhlo").

- [ ] **Step 9: Verify**

Run: `pnpm test && pnpm typecheck`. Manually check `/schuzky`: header count no longer dominates, keyboard-tabbing to a meeting card shows a focus ring, month headers announce expanded/collapsed state to a screen reader (verify via the browser's accessibility tree inspector), collapse toggles show a rotating chevron, empty months default collapsed, the delete button on a meeting detail page is solid destructive-red, and the detail header shows a status badge.

- [ ] **Step 10: Commit**

```bash
git add "src/app/(main)/schuzky/page.tsx" "src/app/(main)/schuzky/[meetingId]/page.tsx" \
  src/components/customer-meetings/customer-meeting-list.tsx \
  src/components/customer-meetings/customer-meeting-detail.tsx \
  src/components/customer-meetings/customer-meeting-form.tsx
git commit -m "fix: schuzky header/focus-ring/a11y/copy/status findings from design review"
```

---

### Task 9: Koučování — full pass

**Files:**
- Modify: `src/app/(main)/koucovani/page.tsx`
- Modify: `src/components/individual-coaching-sessions/individual-coaching-session-list.tsx`
- Modify: `src/components/individual-coaching-sessions/individual-coaching-session-card.tsx`
- Modify: `src/components/individual-coaching-sessions/info-card.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `pluralizeCz`, `.focus-ring`.

- [ ] **Step 1: Replace the header with `PageHeader`**

Same pattern as Task 8 Step 1: replace `koucovani/page.tsx`'s hand-rolled `h1` + oversized count block with `\<PageHeader title="Koučování" description={...} count={\{ value: sessions.length, label: pluralizeCz(sessions.length, ["sezení", "sezení", "sezení"]) }} />` (the Czech word "sezení" doesn't inflect across 1/2-4/5+, so all three forms are identical — still route it through `pluralizeCz` for consistency/DRY with the rest of the app rather than a one-off literal).

- [ ] **Step 2: Fix icon-only button accessibility and touch targets**

In `individual-coaching-session-card.tsx`, on the Edit button (currently lines 127-130) add `aria-label="Upravit sezení"` and change `<span className="hidden sm:inline">Upravit</span>` to `<span className="sr-only sm:not-sr-only sm:inline">Upravit</span>` (same for the Delete button at lines 147-150, `aria-label="Smazat sezení"`). Change both buttons' `size="sm"` to `size="icon"` at the base breakpoint and `sm:size-auto`-equivalent... concretely: keep `size="sm"` (it already includes visible text at `sm:`) but widen the action-row gap (line 124) from `gap-2` to `gap-3` below the `sm:` breakpoint so the destructive action isn't flush against Edit.

- [ ] **Step 3: Add a semester-completion status chip**

In `koucovani/page.tsx`, compute the current semester's session count (reuse the season-boundary logic already established in `src/lib/tymova-reflexe/month-grid.ts` is a different domain — for coaching sessions, simply filter `sessions` where `session_at` falls within the current semester window, using the same `SEMESTER_MONTHS`/school-year boundaries is overkill here; instead compute "sessions since the start of the current calendar half" is out of scope for this domain's actual rule). Read `info-card.tsx`'s exact wording first (`grep -n "semestr" src/components/individual-coaching-sessions/info-card.tsx`) to match the real expectation being described, then add a small `Badge` in `PageHeader`'s `action` slot reading e.g. `"{n} tento semestr"` where `n` counts sessions with `session_at` in the current semester's date range, using whatever semester-boundary helper already exists in `src/lib/` for this feature (search `grep -rln "semestr" src/lib/` before writing a new one — reuse if found, otherwise add a small local date-range check in `koucovani/page.tsx` only, not a new shared module, since this plan doesn't have evidence of a reusable existing helper for this specific domain).

- [ ] **Step 4: Add a "no notes yet" invitation**

In `individual-coaching-session-card.tsx` (around line 174), change:
```tsx
      {(session.key_takeaways || session.action_steps) && (
```
to also render an `else` branch when neither field is set:
```tsx
      {session.key_takeaways || session.action_steps ? (
        <div className="border-t pt-4 space-y-4">
          {/* existing Field blocks unchanged */}
        </div>
      ) : (
        <div className="border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Zatím žádné poznámky — uprav sezení a doplň, co sis odnesl.
          </p>
        </div>
      )}
```

- [ ] **Step 5: Add focus-ring to the month/"Bez data" toggle buttons**

In `individual-coaching-session-list.tsx`, add `focus-ring` to the `className` of both toggle buttons (currently lines 155-170 and 218-233).

- [ ] **Step 6: Verify**

Run: `pnpm test && pnpm typecheck`. Manually check `/koucovani`: header matches the schuzky pattern, resizing to mobile keeps Edit/Delete labelled for screen readers (inspect the accessibility tree), a session with no notes shows the invitation line, tabbing to month toggles shows a focus ring.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(main)/koucovani/page.tsx" \
  src/components/individual-coaching-sessions/individual-coaching-session-list.tsx \
  src/components/individual-coaching-sessions/individual-coaching-session-card.tsx \
  src/components/individual-coaching-sessions/info-card.tsx
git commit -m "fix: koucovani header/a11y/touch-target/notes-invitation findings from design review"
```

---

### Task 10: Týmová reflexe — full pass

**Files:**
- Modify: `src/components/tymova-reflexe/semester-reflection-card.tsx`
- Modify: `src/components/tymova-reflexe/team-reflection-calendar.tsx`
- Modify: `src/components/tymova-reflexe/semester-topic-editor.tsx`
- Modify: `src/components/tymova-reflexe/team-reflection-detail.tsx`
- Modify: `src/components/tymova-reflexe/team-reflection-card.tsx`
- Modify: `src/app/(main)/tymova-reflexe/page.tsx`
- Create: `src/app/(main)/tymova-reflexe/loading.tsx`
- Create: `src/app/(main)/tymova-reflexe/[id]/loading.tsx`
- Create: `src/app/(main)/tymova-reflexe/semestralni/[id]/loading.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `.focus-ring`, existing `chart-5` token (already defined in `globals.css`, no new token needed here).

- [ ] **Step 1: Swap the violet accent to the `chart-5` token**

In `semester-reflection-card.tsx` (around line 56) and `team-reflection-calendar.tsx` (around lines 42-49 and 122), replace every `violet-500`/`violet-600` (and any dark variants) with `chart-5` equivalents (`bg-chart-5`, `border-chart-5`, `text-chart-5`, using `/NN` opacity suffixes where the original used a `-100`/`-50` tint, e.g. `bg-violet-100` → `bg-chart-5/10`).

- [ ] **Step 2: Unify save-status copy**

In `semester-topic-editor.tsx` (around line 150), change the dirty-state label from `"Neuloženo"` to `"Neuložené změny"` to match `team-reflection-detail.tsx:213`. If both components implement their own `InlineSaveStatus`-shaped JSX independently, leave the duplication for now (out of scope) — this step only needs the copy to match.

- [ ] **Step 3: Fix the magic font size**

In `team-reflection-card.tsx` (around line 36, `PreviewField`'s label) and `team-reflection-calendar.tsx` (around line 117, the legend), replace `text-[11px]` with `text-xs`.

- [ ] **Step 4: Fix the mobile calendar grid**

In `team-reflection-calendar.tsx` (around line 147), change the base-breakpoint grid from `grid-cols-4` to `grid-cols-3` (9 months / 3 columns = 3 even rows, matching the existing `sm:`/`md:` breakpoints' column counts — check the surrounding responsive classes and only change the base one).

- [ ] **Step 5: Replace the header with `PageHeader`**

In `src/app/(main)/tymova-reflexe/page.tsx` (around lines 33-39), replace the hand-rolled `h1` + oversized reflection-count block with `\<PageHeader title="Týmová reflexe" description={...} count={\{ value: reflections.length + semesterReflections.length, label: "reflexí" }} />` (adjust the exact description string to whatever the current `<p>` under the h1 says).

- [ ] **Step 6: Add the three missing `loading.tsx` files**

Each of the three new files is identical to the app's existing convention (`src/app/(main)/komunita/loading.tsx`):

```tsx
import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner className="size-8 text-muted-foreground" />
    </div>
  );
}
```

- [ ] **Step 7: Verify**

Run: `pnpm test && pnpm typecheck`. Manually check `/tymova-reflexe`: no `violet-*` classes remain (`grep -rn "violet-" src/components/tymova-reflexe/` returns nothing), the mobile calendar grid has no orphaned trailing cell, and throttled network shows a spinner on first navigation into the list, a reflection detail, and a semester reflection detail.

- [ ] **Step 8: Commit**

```bash
git add src/components/tymova-reflexe/semester-reflection-card.tsx \
  src/components/tymova-reflexe/team-reflection-calendar.tsx \
  src/components/tymova-reflexe/semester-topic-editor.tsx \
  src/components/tymova-reflexe/team-reflection-card.tsx \
  "src/app/(main)/tymova-reflexe/page.tsx" \
  "src/app/(main)/tymova-reflexe/loading.tsx" \
  "src/app/(main)/tymova-reflexe/[id]/loading.tsx" \
  "src/app/(main)/tymova-reflexe/semestralni/[id]/loading.tsx"
git commit -m "fix: tymova-reflexe chart-5 token, save-status copy, type scale, grid, header, loading states"
```

---

### Task 11: Komunita — full pass

**Files:**
- Modify: `src/lib/komunita/types.ts`
- Modify: `src/components/komunita/komunita-content.tsx`
- Modify: `src/components/komunita/user-card.tsx`
- Modify: `src/components/komunita/team-badges.tsx`
- Modify: `src/app/(main)/komunita/page.tsx`
- Modify: `src/app/(main)/komunita/profil/[id]/page.tsx`
- Modify: `src/app/(main)/komunita/tymy/[id]/page.tsx`
- Create: `src/app/(main)/komunita/profil/[id]/loading.tsx`
- Create: `src/app/(main)/komunita/tymy/[id]/loading.tsx`

**Interfaces:**
- Consumes: `PageShell` (Task 2), `.focus-ring` (Task 1), `chart-1..5`/`destructive`/`warning` tokens.

- [ ] **Step 1: Migrate `ROLE_COLORS` onto category tokens**

In `src/lib/komunita/types.ts`, change (currently lines 44-49):
```ts
export const ROLE_COLORS: Record<ProfileRole, string> = {
  student: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  mentor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  coach: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};
```
to:
```ts
export const ROLE_COLORS: Record<ProfileRole, string> = {
  student: 'bg-chart-3/15 text-chart-3',
  mentor: 'bg-chart-5/15 text-chart-5',
  coach: 'bg-chart-2/15 text-chart-2',
  admin: 'bg-destructive/15 text-destructive',
};
```
This is used as-is by `feedback-note-card.tsx:73` too (`ROLE_COLORS[role]`), so no caller changes are needed — the type stays `Record<ProfileRole, string>`.

- [ ] **Step 2: Migrate the "Nad rámec četby" highlight block**

In `src/app/(main)/komunita/profil/[id]/page.tsx` (around lines 216-246), replace the raw `amber-*` classes with `warning`-token equivalents (`bg-warning/10`, `border-warning/20`, `text-warning`) so the same amber hue now routes through the token layer.

- [ ] **Step 3: Add focus rings to card/pill Links**

Add `focus-ring` to the `className` of: the whole-card `Link` in `user-card.tsx` (around line 25), the `TeamPill` `Link` in `team-badges.tsx` (around line 21), the "Zpět" `Link` and the essay-card `Link`s in `profil/[id]/page.tsx` (around lines 74-80, 184, 192, 233, 237).

- [ ] **Step 4: Add actionable empty/no-results states**

In `komunita-content.tsx` (around lines 100-101), add a "Vymazat hledání" `Button` calling the same `setQuery('')` handler the search bar's existing clear button (lines 71-81) already uses. In `tymy/[id]/page.tsx` (around lines 152-155), leave as-is unless a clear action exists on that page too (it's a static "no members" state with nothing to clear — no action to add there).

- [ ] **Step 5: Fix the duplicated thumbnail sizing**

In `profil/[id]/page.tsx` (lines 184 and 233), remove the inline `style={\{ height: '60px' }}` and keep the existing `h-15` Tailwind class (Tailwind v4's dynamic spacing scale already resolves `h-15` to `3.75rem` = 60px, so this is a no-op visually and just removes the redundant declaration).

- [ ] **Step 6: Apply `PageShell` across the section**

Import `PageShell` from `@/components/ui/page-shell` in all three route files. In `komunita/page.tsx` and `tymy/[id]/page.tsx`, replace the outer `<div className="container mx-auto py-6 space-y-6">` with `<PageShell>...</PageShell>` (default `size="full"` matches the existing unconstrained width). In `profil/[id]/page.tsx`, keep the full-bleed banner (lines 68-81) outside `PageShell` as its own top-level element, then wrap everything from the current `<div className="max-w-5xl mx-auto px-4 sm:px-6">` (lines 84/164) onward in `<PageShell size="wide">` instead (dropping the bespoke wrapper div), matching the section's `wide`/`max-w-4xl` convention established in Task 12.

- [ ] **Step 7: Add the two missing `loading.tsx` files**

Same convention as Task 10 Step 6 (copy `komunita/loading.tsx` verbatim into `profil/[id]/` and `tymy/[id]/`).

- [ ] **Step 8: Verify**

Run: `pnpm test && pnpm typecheck`. Manually check `/komunita`: role badges render in the new token colors, tabbing to a person card or team pill shows a focus ring, a no-results search shows a working "Vymazat hledání" button, and navigating into a profile or team on a throttled connection shows a spinner.

- [ ] **Step 9: Commit**

```bash
git add src/lib/komunita/types.ts src/components/komunita/komunita-content.tsx \
  src/components/komunita/user-card.tsx src/components/komunita/team-badges.tsx \
  "src/app/(main)/komunita/page.tsx" "src/app/(main)/komunita/profil/[id]/page.tsx" \
  "src/app/(main)/komunita/tymy/[id]/page.tsx" \
  "src/app/(main)/komunita/profil/[id]/loading.tsx" "src/app/(main)/komunita/tymy/[id]/loading.tsx"
git commit -m "fix: komunita color tokens, focus rings, actionable empty state, shared PageShell, loading states"
```

---

### Task 12: Čtení — full pass

**Files:**
- Modify: `src/app/(main)/knihovna/[bookId]/page.tsx`
- Modify: `src/app/(main)/knihovna/nova/page.tsx`
- Modify: `src/app/(main)/prehled/page.tsx`
- Modify: `src/app/(main)/hledat/page.tsx`
- Modify: `src/app/(main)/eseje/[essayId]/page.tsx`
- Modify: `src/app/(main)/eseje/nova/page.tsx`
- Modify: `src/app/(main)/eseje/ke-kontrole/page.tsx`
- Modify: `src/app/(main)/settings/kniha-knih/page.tsx`
- Modify: `src/components/search/search-page-client.tsx`
- Modify: `src/components/essays/essay-editor-form.tsx`
- Modify: `src/components/books/coach-dashboard.tsx`
- Modify: `src/components/essays/essay-comment-thread.tsx`
- Modify: `src/components/essays/my-essay-list.tsx`
- Modify: `src/components/books/book-card.tsx`
- Modify: `src/components/books/book-essays-list.tsx`
- Modify: `src/components/essays/essay-card.tsx`
- Modify: `src/components/essays/essay-vote-button.tsx`
- Delete: `src/components/books/library-filters.tsx`

**Interfaces:**
- Consumes: `PageShell` (Task 2), `.focus-ring` (Task 1), `destructive`/`success`/`warning` tokens (Task 1).

- [ ] **Step 1: Add toast feedback to every silent mutation**

In `essay-editor-form.tsx`'s `handlePublish` (around lines 57-80): after the `fetch`, check `res.ok`; on success call `toast.success("Esej publikována.")` before `router.push(...)`; on failure call `toast.error("Nepodařilo se publikovat esej.")` instead of doing nothing. Import `toast` from `"sonner"` (same import every other feature area already uses, e.g. `dashboard-editor.tsx:5`).

In `coach-dashboard.tsx` (around lines 20-52), add `toast.success`/`toast.error` pairs to the approve/reject/remove handlers, matching the Czech verb for each action (e.g. `"Esej schválena."` / `"Nepodařilo se esej schválit."`, `"Esej zamítnuta."` / `"Nepodařilo se esej zamítnout."`, `"Esej odebrána."` / `"Nepodařilo se esej odebrat."`).

In `essay-comment-thread.tsx` (around lines 25-42), add `toast.error("Nepodařilo se odeslat komentář.")` in the failure branch of the post handler (success already reflects visibly via the new comment appearing in the thread, so no success toast needed there).

- [ ] **Step 2: Fix `/hledat`'s missing heading**

In `search-page-client.tsx` (around line 81), add a visually-hidden `<h1 className="sr-only">Hledat</h1>` immediately before the search `Input` at line 85.

- [ ] **Step 3: Apply `PageShell` across the section, consolidating container widths**

Replace each page's ad hoc container div with `PageShell`:
- `prehled/page.tsx` (currently `py-6` no max-w) → `<PageShell size="full">`
- `hledat/page.tsx` (currently `py-10 max-w-2xl`) → `<PageShell size="narrow">` (also drops the odd `py-10` in favor of the shared `py-4 sm:py-6`)
- `eseje/[essayId]/page.tsx` and `eseje/nova/page.tsx` (currently `max-w-2xl`) → `<PageShell size="narrow">`
- `eseje/ke-kontrole/page.tsx` (currently `max-w-3xl`) → `<PageShell size="medium">`
- `knihovna/[bookId]/page.tsx` and `settings/kniha-knih/page.tsx` (currently `max-w-4xl`) → `<PageShell size="wide">`
- `knihovna/nova/page.tsx` (currently `max-w-2xl`) → `<PageShell size="narrow">`

- [ ] **Step 4: Fix the knihovna status-pill colors**

In `knihovna/[bookId]/page.tsx`, change (currently lines 29-38):
```ts
const STATUS_PILL: Record<BookStatus, string> = {
  approved:
    'border-emerald-600/20 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-950/40 dark:text-emerald-400',
  pending:
    'border-amber-600/20 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-950/40 dark:text-amber-400',
  rejected:
    'border-red-600/20 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-950/40 dark:text-red-400',
};

const STATUS_DOT: Record<BookStatus, string> = {
  approved: 'bg-emerald-500',
  pending: 'bg-amber-500',
  rejected: 'bg-red-500',
};
```
to:
```ts
const STATUS_PILL: Record<BookStatus, string> = {
  approved: 'border-success/20 bg-success/10 text-success',
  pending: 'border-warning/20 bg-warning/10 text-warning',
  rejected: 'border-destructive/20 bg-destructive/10 text-destructive',
};

const STATUS_DOT: Record<BookStatus, string> = {
  approved: 'bg-success',
  pending: 'bg-warning',
  rejected: 'bg-destructive',
};
```

- [ ] **Step 5: Fix the stale "knihovna" back-link copy**

In `knihovna/[bookId]/page.tsx` (around lines 105-110) and `knihovna/nova/page.tsx` (around lines 9-13), change "Zpět do knihovny" to "Zpět do hledání" (the link target `/hledat` is unchanged — only the label was wrong).

- [ ] **Step 6: Delete the orphaned component**

Run `grep -rln "library-filters\|LibraryFilters" src/` to confirm zero references outside the file itself, then delete `src/components/books/library-filters.tsx`.

- [ ] **Step 7: Add `aria-pressed` to filter pills**

In `search-page-client.tsx`, add `aria-pressed={selectedCategory === key}` to the category pills (around lines 100-113) and the equivalent `aria-pressed={selectedTeam === teamId}` (or whatever the team-selection variable is named) to the team pills (around lines 250-259).

- [ ] **Step 8: Add focus-ring to row-as-Link patterns**

Add `focus-ring` to the `className` of: the essay row `Link` in `my-essay-list.tsx` (around lines 44-48), `book-card.tsx` (around line 18), `book-essays-list.tsx` (around lines 30-33), and the equivalent row `Link` in `coach-review-list.tsx` if it uses the same bare-hover pattern.

- [ ] **Step 9: Fix the "0 b." vs "0 bodů" inconsistency**

In `knihovna/[bookId]/page.tsx` (around lines 163-165), change the spelled-out `"0 bodů"` to the abbreviated `"0 b."` form already used by `src/lib/books/points.ts`'s formatting helpers, `my-essay-list.tsx:92-94`, and `essay-card.tsx:69-71` — call the same shared formatter those three already use instead of a local literal.

- [ ] **Step 10: Add a `prefers-reduced-motion` guard to the vote-button animation**

In `essay-vote-button.tsx` (around lines 64-84), move the `vote-pop`/`count-up`/`particle` `@keyframes` and the rules that use them out of the inline `<style>` tag and into `src/app/globals.css` under `@media (prefers-reduced-motion: no-preference) { ... }`, keeping the component's `className` hooks (e.g. `.vote-pop`) unchanged so no JSX needs to change beyond removing the `<style jsx>`/`<style>` block.

- [ ] **Step 11: Verify**

Run: `pnpm test && pnpm typecheck`. Manually check: publishing an essay while offline (DevTools "Offline" throttling) shows an error toast instead of silently doing nothing; `/hledat` announces an "Hledat" landmark to a screen reader; every Čtení route uses one of the four `PageShell` widths with no viewport-edge content; a rejected book's status pill is the same red as a rejected essay's point pill elsewhere; toggling a category filter announces pressed state; the vote-button animation is disabled under OS "reduce motion" (macOS: System Settings → Accessibility → Display → Reduce motion).

- [ ] **Step 12: Commit**

```bash
git add "src/app/(main)/knihovna/[bookId]/page.tsx" "src/app/(main)/knihovna/nova/page.tsx" \
  "src/app/(main)/prehled/page.tsx" "src/app/(main)/hledat/page.tsx" \
  "src/app/(main)/eseje/[essayId]/page.tsx" "src/app/(main)/eseje/nova/page.tsx" \
  "src/app/(main)/eseje/ke-kontrole/page.tsx" "src/app/(main)/settings/kniha-knih/page.tsx" \
  src/components/search/search-page-client.tsx src/components/essays/essay-editor-form.tsx \
  src/components/books/coach-dashboard.tsx src/components/essays/essay-comment-thread.tsx \
  src/components/essays/my-essay-list.tsx src/components/books/book-card.tsx \
  src/components/books/book-essays-list.tsx src/components/essays/essay-card.tsx \
  src/components/essays/essay-vote-button.tsx src/app/globals.css
git rm src/components/books/library-filters.tsx
git commit -m "fix: cteni toast feedback, PageShell, status tokens, a11y, dead code, reduced-motion findings"
```

---

### Task 13: Zpětná vazba — full pass

**Files:**
- Modify: `src/components/feedback/new-feedback-form.tsx`
- Modify: `src/components/feedback/feedback-note-card.tsx`
- Modify: `src/components/feedback/feedback-board.tsx`
- Modify: `src/components/feedback/floating-feedback.tsx`
- Modify: `src/app/(main)/zpetna-vazba/page.tsx`
- Create: `src/app/(main)/zpetna-vazba/loading.tsx`
- Test: extend `src/components/feedback/new-feedback-form.test.tsx`, `src/components/feedback/feedback-note-card.test.tsx`

**Interfaces:**
- Consumes: `PageShell` (Task 2), `warning` token (Task 1), `usePathname` from `next/navigation`.

- [ ] **Step 1: Write the failing test for toast feedback on post failure**

Add to `src/components/feedback/new-feedback-form.test.tsx`:
```tsx
it("shows an error toast when the post fails", async () => {
  const toastModule = await import("sonner")
  const errorSpy = vi.spyOn(toastModule.toast, "error").mockImplementation(() => "")
  fetchSpy.mockResolvedValueOnce({ ok: false, json: async () => ({}) } as Response)

  render(<NewFeedbackForm onCreated={vi.fn()} />)
  await userEvent.type(screen.getByRole("textbox"), "Ahoj")
  await userEvent.click(screen.getByRole("button", { name: /Odeslat/i }))

  await waitFor(() => expect(errorSpy).toHaveBeenCalled())
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm vitest run src/components/feedback/new-feedback-form.test.tsx`
Expected: FAIL — no `toast.error` call is made today (the handler swallows a non-ok response silently).

- [ ] **Step 3: Add toast feedback to `new-feedback-form.tsx`**

Add `import { toast } from 'sonner';`. Change `handleSubmit` (currently lines 20-38):
```ts
  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setIsPosting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      });
      const { data } = await res.json();
      if (data) {
        onCreated(data);
        setBody('');
      }
    } finally {
      setIsPosting(false);
    }
  };
```
to:
```ts
  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setIsPosting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      onCreated(data);
      setBody('');
    } catch {
      toast.error('Nepodařilo se odeslat zpětnou vazbu.');
    } finally {
      setIsPosting(false);
    }
  };
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm vitest run src/components/feedback/new-feedback-form.test.tsx`
Expected: PASS (all tests, including the new one).

- [ ] **Step 5: Write the failing test for toast feedback on archive/delete failure**

Add to `src/components/feedback/feedback-note-card.test.tsx` (read the existing file first to match its render/props setup):
```tsx
it("shows an error toast when archiving fails", async () => {
  const toastModule = await import("sonner")
  const errorSpy = vi.spyOn(toastModule.toast, "error").mockImplementation(() => "")
  fetchSpy.mockResolvedValueOnce({ ok: false, json: async () => ({}) } as Response)

  render(<FeedbackNoteCard feedback={FEEDBACK_FIXTURE} isAdmin onChanged={vi.fn()} onDeleted={vi.fn()} />)
  await userEvent.click(screen.getByRole("button", { name: /Archivovat/i }))

  await waitFor(() => expect(errorSpy).toHaveBeenCalled())
})
```
(Reuse whatever fixture/mock-setup constant the existing tests in this file already define for `feedback`/`fetchSpy` rather than redefining one.)

- [ ] **Step 6: Run it to confirm it fails**

Run: `pnpm vitest run src/components/feedback/feedback-note-card.test.tsx`
Expected: FAIL.

- [ ] **Step 7: Add toast feedback to `feedback-note-card.tsx`**

Add `import { toast } from 'sonner';`. Change `patch` (currently lines 32-45):
```ts
  const patch = async (payload: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/feedback/${feedback.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const { data } = await res.json();
      if (data) onChanged(data);
    } finally {
      setIsSaving(false);
    }
  };
```
to:
```ts
  const patch = async (payload: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/feedback/${feedback.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      onChanged(data);
    } catch {
      toast.error('Nepodařilo se uložit změnu.');
    } finally {
      setIsSaving(false);
    }
  };
```
Apply the equivalent `if (!res.ok) throw new Error()` / `catch { toast.error('Nepodařilo se smazat příspěvek.'); }` change to `handleDelete` (currently lines 47-55).

- [ ] **Step 8: Run the test to confirm it passes**

Run: `pnpm vitest run src/components/feedback/feedback-note-card.test.tsx`
Expected: PASS.

- [ ] **Step 9: Add the spinner-swap to note-card actions**

In the same file, swap the leading icon on the "Archivovat"/"Obnovit" and "Smazat" buttons for a `Spinner` (from `@/components/ui/spinner`) while `isSaving` is true, matching `new-feedback-form.tsx`'s existing pattern.

- [ ] **Step 10: Tone down the sticky-note surface and strengthen the compose form**

Change the card's `className` (currently lines 62-66) from a full amber background to a neutral card with a warm accent border:
```tsx
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-l-4 border-l-warning bg-card p-4 shadow-sm transition-transform',
        tiltFor(feedback.id),
      )}
```
(drop the `amber-*`/dark-`amber-*` classes entirely; the `border-l-warning` accent replaces the sticky-note-color metaphor with a corner-accent one, keeping the tilt).

In `new-feedback-form.tsx`, strengthen its container's visual weight so it still reads as the primary action now that the note cards are quieter — change (line 41) `className="flex flex-col gap-3 rounded-xl border bg-card p-4"` to `className="flex flex-col gap-3 rounded-xl border-2 border-primary/20 bg-card p-4 shadow-sm"`.

- [ ] **Step 11: Add an archive-tab count badge**

In `feedback-board.tsx` (around line 75), add a `Badge` showing `archived.length` to the "Archiv" `TabsTrigger`, matching the existing `Badge` on the "Aktivní" trigger (lines 69-73).

- [ ] **Step 12: Consolidate the empty state onto `Empty*` primitives**

Replace the bare `<p>` empty state (currently lines 43-45) with the `Empty`/`EmptyMedia`/`EmptyHeader`/`EmptyTitle`/`EmptyDescription` primitives (same pattern as `coach-review-list.tsx:77-84`), using an `Inbox` icon from `lucide-react` and the existing `emptyText` prop as the `EmptyDescription`.

- [ ] **Step 13: Fix the page heading and container**

In `src/app/(main)/zpetna-vazba/page.tsx`, change the `h1` (currently line 23, `text-2xl font-bold`) to `text-xl sm:text-2xl font-bold tracking-tight` to match the shared convention, and replace the outer `<div className="container mx-auto max-w-5xl py-6">` (line 21) with `<PageShell size="wide">` from `@/components/ui/page-shell`.

- [ ] **Step 14: Suppress the floating button on its own page**

In `floating-feedback.tsx`, add `import { usePathname } from 'next/navigation';` and, at the top of the component body:
```ts
  const pathname = usePathname();
  if (pathname === '/zpetna-vazba') return null;
```

- [ ] **Step 15: Add the missing `loading.tsx`**

Same convention as prior tasks — copy `komunita/loading.tsx` verbatim into `src/app/(main)/zpetna-vazba/loading.tsx`.

- [ ] **Step 16: Verify**

Run: `pnpm test && pnpm typecheck`. Manually check `/zpetna-vazba`: posting feedback with the network offline shows an error toast, note cards read as a quiet neutral surface with a left accent instead of a loud amber block, the compose box now visually reads as the primary surface, the Archiv tab shows a count, the empty state matches the app's icon+copy convention, content has visible side padding on mobile, and the floating heart button disappears while already on this page.

- [ ] **Step 17: Commit**

```bash
git add src/components/feedback/new-feedback-form.tsx src/components/feedback/new-feedback-form.test.tsx \
  src/components/feedback/feedback-note-card.tsx src/components/feedback/feedback-note-card.test.tsx \
  src/components/feedback/feedback-board.tsx src/components/feedback/floating-feedback.tsx \
  "src/app/(main)/zpetna-vazba/page.tsx" "src/app/(main)/zpetna-vazba/loading.tsx"
git commit -m "fix: zpetna-vazba toast feedback, empty state, heading/shell, note-card treatment, floating button"
```

---

### Task 14: Místnosti — keyboard-reachable reservation create/edit interaction

**Files:**
- Modify: `src/components/reservations/day-schedule.tsx`
- Modify: `src/components/reservations/week-schedule.tsx`
- Modify: `src/components/reservations/my-reservations.tsx`

**Interfaces:**
- Consumes: `.focus-ring` (Task 1). No new shared component — this is new interaction code on existing elements.

This is the largest and highest-risk item in the review (the review itself flags it "large" effort), so it's last and gets its own dedicated verification pass.

- [ ] **Step 1: Make the reservation row in `my-reservations.tsx` keyboard-operable**

Find the clickable row `div` (around lines 108-111, a plain `div` with `onClick` and no keyboard affordance). Add `role="button"`, `tabIndex={0}`, `focus-ring`, and an `onKeyDown` handler that calls the same handler as `onClick` when `event.key === "Enter" || event.key === " "` (preventing the default scroll-on-space behavior via `event.preventDefault()`).

- [ ] **Step 2: Add a keyboard-reachable "create reservation" affordance to `day-schedule.tsx`**

The drag-to-select interaction (empty slot cells, lines ~418-427; reservation blocks, lines ~497-540) has no keyboard path. Rather than rebuilding drag-select for keyboard input, add a small `+` button rendered at the top of each visible day column (a new column-header affordance, not per-slot) that opens the same "create reservation" dialog the drag gesture opens today, pre-filled with that day's date and no time range (the existing create-dialog component already supports an open-with-partial-data mode if `quick-reservation-dialog.tsx` exposes one — check `quick-reservation-dialog.tsx`'s props first; if it requires a full time range, default to the day's first bookable slot instead of leaving time blank). Give this button `focus-ring` and an `aria-label` like `"Přidat rezervaci — {den}"`.

- [ ] **Step 3: Apply the same affordance to `week-schedule.tsx`**

Add the equivalent per-day-column `+` button (lines ~269-296 is where the day columns render) using the same dialog-opening logic as Step 2.

- [ ] **Step 4: Verify**

Manually test with mouse unplugged / keyboard-only navigation (Tab, Shift+Tab, Enter, Space) through `/reservations`: every reservation row in "Moje rezervace" is reachable and openable via keyboard, and every visible day column in both the day and week schedule views has a keyboard-reachable way to start a new reservation. Run `pnpm test && pnpm typecheck` to confirm nothing else regressed.

- [ ] **Step 5: Commit**

```bash
git add src/components/reservations/day-schedule.tsx src/components/reservations/week-schedule.tsx \
  src/components/reservations/my-reservations.tsx
git commit -m "feat: add keyboard-reachable reservation create/edit affordances"
```

---

## Self-review notes

- **Spec coverage:** every row of the review's 12-item prioritized list and every per-page finding table maps to a task above; Task 3 additionally covers the doc's "#10 in detail" bug list one-for-one.
- **Correction applied:** the schůzky pluralization "bug" is not a bug (see Global Constraints) — Task 2/8 extract it into a shared, tested helper without changing its behavior, rather than "fixing" something that was already linguistically correct.
- **Scope discipline:** `PageShell` is only applied to the routes the review actually flagged as inconsistent (Čtení, Komunita's profile page, Zpětná vazba) plus Komunita's two already-consistent sibling routes (low-risk, closes the drift-risk the review itself named) — it is not force-applied app-wide to sections the review didn't flag.
- **Type/name consistency check:** `pluralizeCz`, `PageHeader`, `PageShell`, `isSemesterMonth`, `availableWidgetIds`/`availableWidgets` are each defined once (Task 2/3) and referenced by the exact same name in every later task that uses them.
