# Zákaznické schůzky Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `/schuzky` around open loops (status chips), person-first cards, goal progress, and search — extracting shared timeline/metric primitives for later koučování/reflexe adoption.

**Architecture:** Pure functions for grouping/status/periods in `src/lib/*` (TDD), two new presentational primitives (`MonthSection`, `MetricProgress`), one client owner component (`CustomerMeetingsView`) that renders `PageHeader` + progress + info + search + timeline + create dialog so the header CTA shares state with the list (optimistic prepend preserved). Server page shrinks to auth + query + `<PageShell>`. No DB changes.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind v4 tokens, shadcn/ui, vitest (unit + component projects), testing-library.

**Design doc:** `docs/plans/2026-08-21-zakaznicke-schuzky-redesign-design.md`

---

## Task 1: Timeline month-grouping library

**Files:**
- Create: `src/lib/timeline/group-by-month.ts`
- Test: `src/lib/timeline/group-by-month.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/timeline/group-by-month.test.ts
import { describe, expect, it } from "vitest"
import { addMonths, getMonthKey, getMonthLabel, groupByMonth } from "./group-by-month"

const NOW = new Date(2026, 4, 15) // 15 May 2026

interface Row {
  id: string
  at: string | null
}

function row(id: string, at: string | null): Row {
  return { id, at }
}

describe("getMonthKey / getMonthLabel", () => {
  it("formats keys and czech labels", () => {
    expect(getMonthKey("2026-05-03T10:00:00Z")).toBe("2026-05")
    expect(getMonthLabel("2026-05")).toBe("Květen 2026")
    expect(getMonthLabel("2025-12")).toBe("Prosinec 2025")
  })

  it("returns empty key for null", () => {
    expect(getMonthKey(null)).toBe("")
  })
})

describe("addMonths", () => {
  it("crosses year boundaries both directions", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12")
    expect(addMonths("2025-12", 1)).toBe("2026-01")
  })
})

describe("groupByMonth", () => {
  it("groups newest-first from earliest item month through current month, including empty months", () => {
    const { groups } = groupByMonth(
      [row("a", "2026-05-10T09:00:00Z"), row("b", "2026-03-02T09:00:00Z")],
      { getDate: (r) => r.at, now: NOW },
    )
    expect(groups.map((g) => g.key)).toEqual(["2026-05", "2026-04", "2026-03"])
    expect(groups.map((g) => g.items.length)).toEqual([1, 0, 1])
  })

  it("includes future months beyond the current month (planned meetings)", () => {
    const { groups } = groupByMonth([row("a", "2026-07-01T09:00:00Z")], {
      getDate: (r) => r.at,
      now: NOW,
    })
    expect(groups.map((g) => g.key)).toEqual(["2026-07", "2026-06", "2026-05"])
    expect(groups[0].items).toHaveLength(1)
  })

  it("separates undated items", () => {
    const { groups, undated } = groupByMonth([row("a", null)], { getDate: (r) => r.at, now: NOW })
    expect(groups).toEqual([])
    expect(undated).toHaveLength(1)
  })

  it("returns no groups for an empty set", () => {
    const { groups, undated } = groupByMonth([], { getDate: (r) => r.at, now: NOW })
    expect(groups).toEqual([])
    expect(undated).toEqual([])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run --project unit src/lib/timeline/group-by-month.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

```ts
// src/lib/timeline/group-by-month.ts
export const MONTH_LABELS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
] as const

export function getMonthKey(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function getMonthLabel(key: string): string {
  const [year, month] = key.split("-")
  return `${MONTH_LABELS[Number(month) - 1]} ${year}`
}

export function monthKeyToDate(key: string): Date {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1)
}

export function addMonths(key: string, n: number): string {
  const d = monthKeyToDate(key)
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export interface MonthGroup<T> {
  key: string
  label: string
  items: T[]
}

export interface GroupedByMonth<T> {
  groups: MonthGroup<T>[]
  undated: T[]
}

/**
 * Groups items into calendar months, newest first. The span always covers
 * current month → earliest item month, and extends forward to the latest
 * item month so planned/future entries stay visible.
 */
export function groupByMonth<T>(
  items: T[],
  { getDate, now = new Date() }: { getDate: (item: T) => string | null; now?: Date },
): GroupedByMonth<T> {
  const byKey = new Map<string, T[]>()
  const undated: T[] = []
  const currentKey = getMonthKey(now.toISOString())

  let minKey = currentKey
  let maxKey = currentKey
  let hasDated = false

  for (const item of items) {
    const key = getMonthKey(getDate(item))
    if (!key) {
      undated.push(item)
      continue
    }
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(item)
    if (!hasDated) {
      minKey = key
      maxKey = key
      hasDated = true
    }
    if (key < minKey) minKey = key
    if (key > maxKey) maxKey = key
  }

  if (!hasDated) return { groups: [], undated }

  const groups: MonthGroup<T>[] = []
  let cursor = maxKey
  while (cursor >= minKey) {
    groups.push({ key: cursor, label: getMonthLabel(cursor), items: byKey.get(cursor) ?? [] })
    cursor = addMonths(cursor, -1)
  }
  return { groups, undated }
}
```

Note: descending walk avoids the reverse() pass and naturally spans future months.

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run --project unit src/lib/timeline/group-by-month.test.ts`
Expected: PASS (all)

**Step 5: Commit**

```bash
git add src/lib/timeline/group-by-month.ts src/lib/timeline/group-by-month.test.ts
git commit -m "feat: shared month-timeline grouping library"
```

---

## Task 2: Metrics goal registry

**Files:**
- Create: `src/lib/metrics/config.ts`
- Test: `src/lib/metrics/config.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/metrics/config.test.ts
import { describe, expect, it } from "vitest"
import { METRICS } from "./config"

describe("METRICS registry", () => {
  it("has unique, slug-shaped ids", () => {
    const ids = Object.keys(METRICS)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  it("defines the zákaznické schůzky goal (10 per semester, 60 for study)", () => {
    const m = METRICS["customer-meetings"]
    expect(m.target).toBe(10)
    expect(m.period).toBe("semester")
    expect(m.totalForStudy).toBe(60)
  })

  it("every metric declares a positive target or per-study-year targets", () => {
    for (const m of Object.values(METRICS)) {
      const hasTarget =
        (typeof m.target === "number" && m.target > 0) ||
        (m.targetPerStudyYear != null && Object.keys(m.targetPerStudyYear).length > 0)
      expect(hasTarget).toBe(true)
    }
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run --project unit src/lib/metrics/config.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

```ts
// src/lib/metrics/config.ts
/**
 * Single source of truth for study-goal metrics ("Nastavené metriky").
 * Pages read their goal from here — never hardcode targets in a page.
 */
export type MetricPeriod = "semester" | "year" | "study"

export interface MetricDefinition {
  label: string
  /** What one `target` amount spans. */
  period: MetricPeriod
  /** Flat target, e.g. 10 per semester. Absent when per-study-year. */
  target?: number
  /** Targets that vary by study year (ročník 1..3), e.g. revenue. */
  targetPerStudyYear?: Record<number, number>
  /** Cumulative expectation for the whole study. */
  totalForStudy?: number
  /** Individual-minimum column from the metrics sheet. */
  individualMinimum?: number
  /** "percent" metrics (Houston Calling, Training Session) vs plain counts. */
  unit?: "percent" | "count"
}

export const METRICS = {
  "houston-calling": {
    label: "Houston Calling",
    period: "year",
    target: 80,
    totalForStudy: 80,
    individualMinimum: 80,
    unit: "percent",
  },
  "training-session": {
    label: "Training Session",
    period: "semester",
    target: 80,
    totalForStudy: 80,
    individualMinimum: 80,
    unit: "percent",
  },
  "knizni-body": {
    label: "Knižní body",
    period: "semester",
    target: 20,
    totalForStudy: 120,
    individualMinimum: 120,
  },
  "customer-meetings": {
    label: "Zákaznické schůzky",
    period: "semester",
    target: 10,
    totalForStudy: 60,
    individualMinimum: 60,
  },
  "novy-projekt": {
    label: "Nový projekt",
    period: "year",
    target: 1,
    totalForStudy: 3,
    individualMinimum: 3,
  },
  // TODO(metrics): sheet says "9+1" / "7+1" — meaning of the "+1" unconfirmed;
  // modeled as plain totals until clarified.
  "birth-giving": {
    label: "Birth Giving",
    period: "semester",
    target: 2,
    totalForStudy: 9,
    individualMinimum: 7,
  },
  vynos: {
    label: "Výnos",
    period: "year",
    targetPerStudyYear: { 1: 10_000, 2: 60_000, 3: 50_000 },
    totalForStudy: 120_000,
    individualMinimum: 100_000,
  },
  crossfertilizace: {
    label: "Crossfertilizace",
    period: "semester",
    target: 4,
    totalForStudy: 22,
    individualMinimum: 15,
  },
  "komunitni-role": {
    label: "Komunitní role",
    period: "study",
    target: 0.5,
    totalForStudy: 0.5,
    individualMinimum: 0,
  },
} as const satisfies Record<string, MetricDefinition>

export type MetricId = keyof typeof METRICS

export function getMetric(id: MetricId): MetricDefinition {
  return METRICS[id]
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run --project unit src/lib/metrics/config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/metrics/config.ts src/lib/metrics/config.test.ts
git commit -m "feat: centralized study-metrics registry"
```

---

## Task 3: Semester-period helper (promote out of koučování page)

**Files:**
- Create: `src/lib/metrics/periods.ts`
- Test: `src/lib/metrics/periods.test.ts`
- Modify: `src/app/(main)/koucovani/page.tsx` (delete local `getCurrentSemesterRange` + its constants, import from lib)

**Step 1: Write the failing test**

```ts
// src/lib/metrics/periods.test.ts
import { describe, expect, it } from "vitest"
import { getCurrentSemesterRange } from "./periods"

describe("getCurrentSemesterRange", () => {
  it("January belongs to the winter semester that started last September", () => {
    const { start, end } = getCurrentSemesterRange(new Date(2026, 0, 20))
    expect(start.getFullYear()).toBe(2025)
    expect(start.getMonth()).toBe(8) // September
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(1) // February
  })

  it("February–August is the summer semester", () => {
    const { start, end } = getCurrentSemesterRange(new Date(2026, 4, 15))
    expect(start.getMonth()).toBe(1)
    expect(end.getMonth()).toBe(8)
  })

  it("September starts a winter semester ending next February", () => {
    const { start, end } = getCurrentSemesterRange(new Date(2026, 8, 1))
    expect(start.getFullYear()).toBe(2026)
    expect(end.getFullYear()).toBe(2027)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run --project unit src/lib/metrics/periods.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement (move code from `koucovani/page.tsx:18-41` verbatim)**

```ts
// src/lib/metrics/periods.ts
/**
 * Czech academic year splits roughly into a winter semester (September–January)
 * and a summer semester (February–August, which absorbs the summer break).
 */
const WINTER_SEMESTER_START_MONTH = 9 // September (1-indexed month)
const SUMMER_SEMESTER_START_MONTH = 2 // February (1-indexed month)

export function getCurrentSemesterRange(now: Date): { start: Date; end: Date } {
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  if (month >= WINTER_SEMESTER_START_MONTH) {
    return { start: new Date(year, 8, 1), end: new Date(year + 1, 1, 1) }
  }
  if (month < SUMMER_SEMESTER_START_MONTH) {
    return { start: new Date(year - 1, 8, 1), end: new Date(year, 1, 1) }
  }
  return { start: new Date(year, 1, 1), end: new Date(year, 8, 1) }
}
```

Then in `src/app/(main)/koucovani/page.tsx`: delete lines 18-41 (comment block, both constants, `getCurrentSemesterRange`) and add `import { getCurrentSemesterRange } from "@/lib/metrics/periods"`. Nothing else in that file changes.

**Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run --project unit src/lib/metrics/periods.test.ts && pnpm exec tsc --noEmit`
Expected: PASS, no type errors

**Step 5: Commit**

```bash
git add src/lib/metrics/periods.ts src/lib/metrics/periods.test.ts "src/app/(main)/koucovani/page.tsx"
git commit -m "refactor: promote semester-range helper to shared metrics lib"
```

---

## Task 4: Meeting open-loop status

**Files:**
- Create: `src/lib/customer-meetings/status.ts`
- Test: `src/lib/customer-meetings/status.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/customer-meetings/status.test.ts
import { describe, expect, it } from "vitest"
import { getMeetingLoop, LOOP_LABELS } from "./status"

const NOW = new Date(2026, 4, 15, 12, 0)

function meeting(overrides: { meetingAt?: string | null; postMortem?: string | null }) {
  return { meeting_at: overrides.meetingAt ?? null, post_mortem: overrides.postMortem ?? null }
}

describe("getMeetingLoop", () => {
  it("flags a past meeting without post-mortem as missing follow-up", () => {
    expect(getMeetingLoop(meeting({ meetingAt: "2026-05-10T09:00:00Z" }), NOW)).toBe(
      "missing-follow-up",
    )
  })

  it("treats an empty-string post-mortem as missing", () => {
    expect(
      getMeetingLoop(meeting({ meetingAt: "2026-05-10T09:00:00Z", postMortem: "  " }), NOW),
    ).toBe("missing-follow-up")
  })

  it("returns null once the post-mortem is filled (calm archive)", () => {
    expect(
      getMeetingLoop(meeting({ meetingAt: "2026-05-10T09:00:00Z", postMortem: "Reflexe" }), NOW),
    ).toBeNull()
  })

  it("flags a future-dated meeting as planned even without post-mortem", () => {
    expect(getMeetingLoop(meeting({ meetingAt: "2026-06-01T09:00:00Z" }), NOW)).toBe("planned")
  })

  it("returns undated for meetings without a date", () => {
    expect(getMeetingLoop(meeting({}), NOW)).toBe("undated")
    expect(LOOP_LABELS.undated).toBe("Bez data")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run --project unit src/lib/customer-meetings/status.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

```ts
// src/lib/customer-meetings/status.ts
/** Open-loop state of a meeting — drives the card chip. Null = done, no chip. */
export type MeetingLoop = "planned" | "missing-follow-up" | "undated"

export const LOOP_LABELS: Record<MeetingLoop, string> = {
  planned: "Naplánováno",
  "missing-follow-up": "Chybí follow-up",
  undated: "Bez data",
}

export function getMeetingLoop(
  meeting: Pick<{ meeting_at: string | null; post_mortem: string | null }, "meeting_at" | "post_mortem">,
  now: Date = new Date(),
): MeetingLoop | null {
  if (!meeting.meeting_at) return "undated"
  if (new Date(meeting.meeting_at).getTime() > now.getTime()) return "planned"
  if (!meeting.post_mortem?.trim()) return "missing-follow-up"
  return null
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run --project unit src/lib/customer-meetings/status.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/customer-meetings/status.ts src/lib/customer-meetings/status.test.ts
git commit -m "feat: customer-meeting open-loop status helper"
```

---

## Task 5: `MonthSection` primitive

**Files:**
- Create: `src/components/ui/month-section.tsx`
- Test: `src/components/ui/month-section.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/ui/month-section.test.tsx
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MonthSection } from "./month-section"

describe("MonthSection", () => {
  it("shows label and count, content visible by default-open", () => {
    render(
      <MonthSection label="Květen 2026" count={2} defaultOpen>
        <p>obsah</p>
      </MonthSection>,
    )
    expect(screen.getByText("Květen 2026")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("obsah")).toBeInTheDocument()
  })

  it("starts collapsed when defaultOpen is false and toggles via header", async () => {
    const user = userEvent.setup()
    render(
      <MonthSection label="Duben 2026" count={0}>
        <p>obsah</p>
      </MonthSection>,
    )
    const toggle = screen.getByRole("button", { name: /Duben 2026/ })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("obsah")).not.toBeInTheDocument()
    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("obsah")).toBeInTheDocument()
  })

  it("forceOpen keeps content visible regardless of collapse", async () => {
    const user = userEvent.setup()
    render(
      <MonthSection label="Březen 2026" count={1} forceOpen>
        <p>obsah</p>
      </MonthSection>,
    )
    await user.click(screen.getByRole("button", { name: /Březen 2026/ }))
    expect(screen.getByText("obsah")).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run --project component src/components/ui/month-section.test.tsx`
Expected: FAIL (module not found)

**Step 3: Implement**

```tsx
// src/components/ui/month-section.tsx
"use client"

import { useState, type ReactNode } from "react"
import { Calendar, ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface MonthSectionProps {
  label: string
  count: number
  defaultOpen?: boolean
  /** While searching: ignore collapsed state so matches are always shown. */
  forceOpen?: boolean
  children: ReactNode
}

export function MonthSection({ label, count, defaultOpen = false, forceOpen = false, children }: MonthSectionProps) {
  const [collapsed, setCollapsed] = useState(!defaultOpen)
  const id = `month-${label.toLowerCase().replace(/\s+/g, "-")}`
  const open = forceOpen || !collapsed

  return (
    <section>
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="focus-ring group mb-2 flex w-full items-center gap-2 sm:mb-3"
        aria-expanded={open}
        aria-controls={id}
      >
        <Calendar className="size-4 shrink-0 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </h2>
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {count}
        </Badge>
        <ChevronDown
          aria-hidden
          className={`ml-auto size-4 text-muted-foreground transition-transform ${
            open ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>
      <div id={id} className="space-y-2" hidden={!open}>
        {children}
      </div>
    </section>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run --project component src/components/ui/month-section.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ui/month-section.tsx src/components/ui/month-section.test.tsx
git commit -m "feat: shared collapsible MonthSection primitive"
```

---

## Task 6: `MetricProgress` primitive

**Files:**
- Create: `src/components/metrics/metric-progress.tsx`
- Test: `src/components/metrics/metric-progress.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/metrics/metric-progress.test.tsx
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { MetricProgress } from "./metric-progress"

describe("MetricProgress", () => {
  it("renders one row per goal with current/target and period label", () => {
    render(
      <MetricProgress
        goals={[
          { current: 6, target: 10, label: "tento semestr" },
          { current: 23, target: 60, label: "za studium" },
        ]}
      />,
    )
    expect(screen.getByText("6/10")).toBeInTheDocument()
    expect(screen.getByText("tento semestr")).toBeInTheDocument()
    expect(screen.getByText("23/60")).toBeInTheDocument()
    expect(screen.getByText("za studium")).toBeInTheDocument()
  })

  it("clamps values above target to a full bar", () => {
    const { container } = render(
      <MetricProgress goals={[{ current: 12, target: 10, label: "tento semestr" }]} />,
    )
    const bar = container.querySelector('[data-slot="metric-bar"]')
    expect(bar).toHaveStyle({ width: "100%" })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run --project component src/components/metrics/metric-progress.test.tsx`
Expected: FAIL (module not found)

**Step 3: Implement**

```tsx
// src/components/metrics/metric-progress.tsx
export interface MetricGoal {
  current: number
  target: number
  label: string
}

/**
 * Compact goal-progress strip: thin bars + "current/target" figures.
 * Wrapped in a native <details> so the explainer costs zero JS.
 */
export function MetricProgress({ goals }: { goals: MetricGoal[] }) {
  return (
    <details className="group rounded-lg border border-border/50 bg-muted/30">
      <summary className="focus-ring cursor-pointer list-none space-y-1.5 p-3 [&::-webkit-details-marker]:hidden">
        {goals.map((goal) => (
          <div key={goal.label} className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                data-slot="metric-bar"
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, Math.max(0, (goal.current / goal.target) * 100))}%` }}
              />
            </div>
            <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">
                {goal.current}/{goal.target}
              </span>{" "}
              {goal.label}
            </p>
          </div>
        ))}
      </summary>
      <p className="border-t border-border/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Cíl vychází z nastavených metrik Tiimiakatemia. Semestr = zimní (září–leden) a letní
        (únor–srpen).
      </p>
    </details>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run --project component src/components/metrics/metric-progress.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/metrics/metric-progress.tsx src/components/metrics/metric-progress.test.tsx
git commit -m "feat: reusable MetricProgress goal strip"
```

---

## Task 7: Person-first `CustomerMeetingCard`

**Files:**
- Create: `src/components/customer-meetings/customer-meeting-card.tsx`
- Test: `src/components/customer-meetings/customer-meeting-card.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/customer-meetings/customer-meeting-card.test.tsx
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { CustomerMeetingCard } from "./customer-meeting-card"

const NOW = new Date(2026, 4, 15, 12, 0)

function build(overrides: Partial<Parameters<typeof CustomerMeetingCard>[0]["meeting"]> = {}) {
  return {
    company: "GrowJOB, s.r.o.",
    contact_person: "Kateřina Gonderová",
    meeting_at: "2026-05-13T09:00:00Z",
    post_mortem: "Reflexe vyplněna",
    ...overrides,
  }
}

describe("CustomerMeetingCard", () => {
  it("puts the person first, company and date second", () => {
    render(<CustomerMeetingCard meeting={build()} now={NOW} />)
    const person = screen.getByText("Kateřina Gonderová")
    expect(person).toHaveClass("font-medium")
    expect(screen.getByText("GrowJOB, s.r.o.")).toBeInTheDocument()
    expect(screen.getByText(/13\. 5\./)).toBeInTheDocument()
  })

  it("renders initials disc from the contact name", () => {
    render(<CustomerMeetingCard meeting={build()} now={NOW} />)
    expect(screen.getByText("KG")).toBeInTheDocument()
  })

  it("shows no chip when the loop is closed", () => {
    render(<CustomerMeetingCard meeting={build()} now={NOW} />)
    expect(screen.queryByText("Chybí follow-up")).not.toBeInTheDocument()
    expect(screen.queryByText("Naplánováno")).not.toBeInTheDocument()
  })

  it("chips past meetings without post-mortem as missing follow-up", () => {
    render(<CustomerMeetingCard meeting={build({ post_mortem: null })} now={NOW} />)
    expect(screen.getByText("Chybí follow-up")).toBeInTheDocument()
  })

  it("chips future meetings as planned", () => {
    render(<CustomerMeetingCard meeting={build({ meeting_at: "2026-06-01T09:00:00Z" })} now={NOW} />)
    expect(screen.getByText("Naplánováno")).toBeInTheDocument()
  })

  it("chips undated meetings as bez data and hides the date", () => {
    render(<CustomerMeetingCard meeting={build({ meeting_at: null })} now={NOW} />)
    expect(screen.getByText("Bez data")).toBeInTheDocument()
    expect(screen.queryByText(/13\. 5\./)).not.toBeInTheDocument()
  })

  it("does not leak objective/post-mortem text onto the card", () => {
    render(
      <CustomerMeetingCard meeting={build({ post_mortem: "Tajná dlouhá reflexe…" })} now={NOW} />,
    )
    expect(screen.queryByText(/Tajná dlouhá reflexe/)).not.toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run --project component src/components/customer-meetings/customer-meeting-card.test.tsx`
Expected: FAIL (module not found)

**Step 3: Implement**

```tsx
// src/components/customer-meetings/customer-meeting-card.tsx
import { Building2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getMeetingLoop, LOOP_LABELS } from "@/lib/customer-meetings/status"
import type { CustomerMeeting } from "@/lib/customer-meetings/types"
import type { MeetingLoop } from "@/lib/customer-meetings/status"

const CHIP_CLASS: Record<MeetingLoop, string> = {
  planned: "",
  "missing-follow-up": "border-transparent bg-warning/10 text-warning-strong",
  undated: "",
}

function formatDayMonth(dateStr: string): string {
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric" }).format(
    new Date(dateStr),
  )
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return parts
    .slice(0, 2)
    .map((part) => part[0]!)
    .join("")
    .toUpperCase()
}

interface CustomerMeetingCardProps {
  meeting: CustomerMeeting
  now?: Date
}

export function CustomerMeetingCard({ meeting, now }: CustomerMeetingCardProps) {
  const loop = getMeetingLoop(meeting, now)

  return (
    <Card className="space-y-1.5 p-3 transition-colors sm:p-4">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        >
          {initialsFromName(meeting.contact_person)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{meeting.contact_person}</span>
        {loop && (
          <Badge variant={loop === "missing-follow-up" ? "outline" : "default"} className={`shrink-0 ${CHIP_CLASS[loop]}`}>
            {LOOP_LABELS[loop]}
          </Badge>
        )}
      </div>
      <p className="flex items-center gap-1.5 pl-9.5 text-xs text-muted-foreground">
        <Building2 aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{meeting.company}</span>
        {meeting.meeting_at && (
          <span className="shrink-0 tabular-nums">· {formatDayMonth(meeting.meeting_at)}</span>
        )}
      </p>
    </Card>
  )
}
```

(`pl-9.5` aligns company under the person text, past the 28px disc + gap.)

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run --project component src/components/customer-meetings/customer-meeting-card.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/customer-meetings/customer-meeting-card.tsx src/components/customer-meetings/customer-meeting-card.test.tsx
git commit -m "feat: person-first customer meeting card with loop chips"
```

---

## Task 8: `CustomerMeetingsView` + page rewiring

One client component owns header CTA + progress + info + search + timeline so the create dialog can optimistically prepend from the header trigger. Old `customer-meeting-list.tsx` is deleted.

**Files:**
- Create: `src/components/customer-meetings/customer-meetings-view.tsx`
- Modify: `src/app/(main)/schuzky/page.tsx`
- Delete: `src/components/customer-meetings/customer-meeting-list.tsx`
- Test: `src/components/customer-meetings/customer-meetings-view.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/customer-meetings/customer-meetings-view.test.tsx
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CustomerMeetingsView } from "./customer-meetings-view"

// The create-dialog form imports the Supabase browser client; stub the module
// so rendering the view never initializes it.
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const NOW = new Date(2026, 4, 15, 12, 0)

const MEETINGS = [
  {
    id: "m1",
    company: "GrowJOB, s.r.o.",
    contact_person: "Kateřina Gonderová",
    position: "HR",
    objective: "Zjistit, jak funguje nábor",
    post_mortem: null,
    meeting_at: "2026-05-13T09:00:00Z",
  },
  {
    id: "m2",
    company: "Czech Hockey, s.r.o.",
    contact_person: "Jiří Šitina",
    position: "Manažer",
    objective: "Know-how o provozu ligy",
    post_mortem: "Splněno",
    meeting_at: "2026-03-02T09:00:00Z",
  },
]

function renderView() {
  return render(<CustomerMeetingsView meetings={MEETINGS as never[]} profileId="p1" now={NOW} />)
}

describe("CustomerMeetingsView", () => {
  it("renders header count and goal progress from the metrics registry", () => {
    renderView()
    expect(screen.getByText("Zákaznické schůzky")).toBeInTheDocument()
    expect(screen.getByText("2 schůzky")).toBeInTheDocument()
    expect(screen.getByText("1/10")).toBeInTheDocument()
    expect(screen.getByText("2/60")).toBeInTheDocument()
  })

  it("groups into month sections; empty months are collapsed, dated months open", () => {
    renderView()
    expect(screen.getByRole("button", { name: /Květen 2026/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
    // March sits between the earliest month and now → rendered collapsed
    expect(screen.getByRole("button", { name: /Březen 2026/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
    expect(screen.getByRole("button", { name: /Duben 2026/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    )
  })

  it("search filters by person and company, hiding months without hits", async () => {
    const user = userEvent.setup()
    renderView()
    await user.type(screen.getByPlaceholderText("Hledat osobu nebo firmu…"), "Šitina")
    expect(screen.getByText("Jiří Šitina")).toBeInTheDocument()
    expect(screen.queryByText("Kateřina Gonderová")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Květen 2026/ })).not.toBeInTheDocument()
  })

  it("shows an empty state when nothing matches the search", async () => {
    const user = userEvent.setup()
    renderView()
    await user.type(screen.getByPlaceholderText("Hledat osobu nebo firmu…"), "neexistuje")
    expect(screen.getByText(/Nic jsme nenašli/)).toBeInTheDocument()
  })

  it("shows the global empty state without meetings", () => {
    render(<CustomerMeetingsView meetings={[]} profileId="p1" now={NOW} />)
    expect(screen.getByText("Žádné schůzky")).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run --project component src/components/customer-meetings/customer-meetings-view.test.tsx`
Expected: FAIL (module not found)

**Step 3: Implement the view**

```tsx
// src/components/customer-meetings/customer-meetings-view.tsx
"use client"

import { useMemo, useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { PageHeader } from "@/components/ui/page-header"
import { MonthSection } from "@/components/ui/month-section"
import { MetricProgress } from "@/components/metrics/metric-progress"
import { InfoCard } from "./info-card"
import { CustomerMeetingCard } from "./customer-meeting-card"
import { CustomerMeetingForm } from "./customer-meeting-form"
import { groupByMonth } from "@/lib/timeline/group-by-month"
import { getCurrentSemesterRange } from "@/lib/metrics/periods"
import { getMetric } from "@/lib/metrics/config"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"
import type { CustomerMeeting } from "@/lib/customer-meetings/types"

const SEARCH_PLACEHOLDER = "Hledat osobu nebo firmu…"
const CUSTOMER_MEETINGS_METRIC = getMetric("customer-meetings")

interface CustomerMeetingsViewProps {
  meetings: CustomerMeeting[]
  profileId: string
  /** Injectable for tests. */
  now?: Date
}

function matchesSearch(meeting: CustomerMeeting, query: string): boolean {
  const haystack = [meeting.contact_person, meeting.company, meeting.objective, meeting.post_mortem]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return haystack.includes(query)
}

export function CustomerMeetingsView({ meetings, profileId, now = new Date() }: CustomerMeetingsViewProps) {
  const [items, setItems] = useState(meetings)
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState("")

  const searching = query.trim().length > 0
  const normalizedQuery = query.trim().toLowerCase()

  const visible = useMemo(
    () =>
      searching ? items.filter((m) => matchesSearch(m, normalizedQuery)) : items,
    [items, searching, normalizedQuery],
  )

  const { groups, undated } = useMemo(
    () => groupByMonth(visible, { getDate: (m) => m.meeting_at, now }),
    [visible, now],
  )

  const semesterCount = useMemo(() => {
    const { start, end } = getCurrentSemesterRange(now)
    return items.filter((m) => {
      if (!m.meeting_at) return false
      const at = new Date(m.meeting_at)
      return at >= start && at < end
    }).length
  }, [items, now])

  function handleCreated(meeting: CustomerMeeting) {
    setItems((prev) =>
      [meeting, ...prev].sort((a, b) => {
        if (!a.meeting_at) return 1
        if (!b.meeting_at) return -1
        return b.meeting_at.localeCompare(a.meeting_at)
      }),
    )
    setCreateOpen(false)
  }

  const hasAny = items.length > 0

  return (
    <>
      <PageHeader
        title="Zákaznické schůzky"
        description="Záznamník schůzek s lidmi z praxe"
        count={{
          value: items.length,
          label: pluralizeCz(items.length, ["schůzka", "schůzky", "schůzek"]),
        }}
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4" />
                Nová
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nová zákaznická schůzka</DialogTitle>
              </DialogHeader>
              <CustomerMeetingForm
                profileId={profileId}
                onSuccess={handleCreated}
                onCancel={() => setCreateOpen(false)}
              />
            </DialogContent>
          </Dialog>
        }
      />

      {!searching && hasAny && (
        <MetricProgress
          goals={[
            {
              current: semesterCount,
              target: CUSTOMER_MEETINGS_METRIC.target ?? 0,
              label: "tento semestr",
            },
            {
              current: items.length,
              target: CUSTOMER_MEETINGS_METRIC.totalForStudy ?? 0,
              label: "za studium",
            },
          ]}
        />
      )}

      <InfoCard />

      {hasAny && (
        <div className="relative">
          <Search
            aria-hidden
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={SEARCH_PLACEHOLDER}
            className="pl-9"
            aria-label={SEARCH_PLACEHOLDER}
          />
        </div>
      )}

      {!hasAny ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Plus className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Žádné schůzky</EmptyTitle>
            <EmptyDescription>Zatím nemáš žádné záznamy. Přidej svou první schůzku.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Přidat schůzku
            </Button>
          </EmptyContent>
        </Empty>
      ) : visible.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Search className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Nic jsme nenašli</EmptyTitle>
            <EmptyDescription>
              Pro „{query.trim()}“ nejsou žádné výsledky. Zkus hledat podle osoby nebo firmy.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {undated.length > 0 && (
            <MonthSection label="Bez data" count={undated.length} defaultOpen forceOpen={searching}>
              {undated.map((meeting) => (
                <MeetingLink key={meeting.id} meeting={meeting} />
              ))}
            </MonthSection>
          )}
          {groups.map((group) => {
            const isEmpty = group.items.length === 0
            if (searching && isEmpty) return null
            return (
              <MonthSection
                key={group.key}
                label={group.label}
                count={group.count ?? group.items.length}
                defaultOpen={!isEmpty || searching}
                forceOpen={searching}
              >
                {isEmpty ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground/70">
                    Tento měsíc bez schůzky
                  </p>
                ) : (
                  group.items.map((meeting) => (
                    <MeetingLink key={meeting.id} meeting={meeting} />
                  ))
                )}
              </MonthSection>
            )
          })}
        </div>
      )}
    </>
  )
}

function MeetingLink({ meeting }: { meeting: CustomerMeeting }) {
  // Link imported lazily to keep this file readable; see import below.
  return null as never // replaced in Step 3b
}
```

**Step 3b:** Add `import Link from "next/link"` to the imports and replace the placeholder with:

```tsx
function MeetingLink({ meeting }: { meeting: CustomerMeeting }) {
  return (
    <Link href={`/schuzky/${meeting.id}`} className="focus-ring block rounded-xl">
      <CustomerMeetingCard meeting={meeting} />
    </Link>
  )
}
```

Also fix the group count prop: `MonthSection` expects a number — use `group.items.length` everywhere (drop the nonexistent `group.count`):

```tsx
count={group.items.length}
```

**Step 4: Rewrite the page**

```tsx
// src/app/(main)/schuzky/page.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSessionProfile } from "@/lib/auth/session"
import { listCustomerMeetings } from "@/lib/customer-meetings/queries"
import { CustomerMeetingsView } from "@/components/customer-meetings/customer-meetings-view"
import { PageShell } from "@/components/ui/page-shell"

export const metadata = {
  title: "Zákaznické schůzky | Tappka",
  description: "Záznamník schůzek s lidmi z praxe",
}

export default async function SchuzkyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  if (!profile.beta_access_granted_at) redirect("/")

  const meetings = await listCustomerMeetings(supabase, profile.id)

  return (
    <PageShell className="max-w-5xl">
      <CustomerMeetingsView meetings={meetings} profileId={profile.id} />
    </PageShell>
  )
}
```

Then delete the old list: `git rm src/components/customer-meetings/customer-meeting-list.tsx` (verify nothing else imports it first: `grep -rn "customer-meeting-list" src/`).

**Step 5: Run tests + typecheck**

Run: `pnpm exec vitest run --project component src/components/customer-meetings/customer-meetings-view.test.tsx && pnpm exec tsc --noEmit`
Expected: PASS, no type errors. If `Input` lacks `type="search"` styling quirks, fall back to `type="text"` with `enterKeyHint="search"`.

**Step 6: Commit**

```bash
git add -A src/components/customer-meetings src/app/\(main\)/schuzky
git commit -m "feat: rebuild zákaznické schůzky around open loops, goals and search"
```

---

## Task 9: Full verification

**Step 1:** `pnpm test` — whole unit + component suite green.
**Step 2:** `pnpm typecheck && pnpm lint` — clean.
**Step 3:** Manual smoke (user or agent with dev server):
- `pnpm dev` → `/schuzky`: header CTA creates a meeting (optimistic prepend works), chips correct (create a meeting without post-mortem → "Chybí follow-up"), search hides non-matching months, progress bars reflect real numbers, empty months collapsed, detail navigation intact.
- Toggle dark mode; check 375px viewport width.
**Step 4:** Fix anything found; commit fixes.

```bash
git commit -m "fix: polish from verification pass"  # only if needed
```

---

## Out of scope (later passes)
- Koučování + týmová reflexe adopting `MonthSection`/card anatomy (their own tasks).
- Detail page switching to shared loop statuses.
- Metrics overview page aggregating all `METRICS`.
