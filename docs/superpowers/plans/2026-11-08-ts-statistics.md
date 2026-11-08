# TS statistiky Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `/ts/statistiky` tab showing, for one team and a period, who facilitated how often, how early příprava was published, and attendance — Čas-reporting style with PNG/CSV export.

**Architecture:** Server Component page loads sessions (+ facilitators, preparation, attendance) through `supabase-js` under RLS, maps them to plain `StatsSession` objects, and hands them to pure functions in `src/lib/training-sessions/stats.ts`. A client view renders three sections with recharts cards reusing Čas's export helpers. The Čas period picker gains an optional default range so this page can default to the semester.

**Tech Stack:** Next.js App Router (read `node_modules/next/dist/docs/` before touching routing), supabase-js, recharts, vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-08-ts-statistics-design.md`

## Global Constraints

- Own team only for students; coaches/admins pick a team via `resolveCasTeam` + `TeamSelect` (`?team=`); Docházka hidden for coaches/admins (`TEAM_WIDE_ROLES`) with the note "Docházku vidí jen členové:ky týmu."
- Count only TS with `starts_at <= now`, `removed_at IS NULL`, `cancelled_at IS NULL`, `starts_at` inside the period.
- Absence rule: in a recorded TS (≥1 attendee row for a current member), every current member without a row is **absent**. Attendance rate = (present + late) / recorded TS. Guests (non-members) ignored.
- Příprava buckets (named constants): `≥ 72 h` → "3+ dny předem", `≥ 24 h` → "1–3 dny předem", `> 0 h` → "Méně než den předem", `≤ 0 h` → "Až po začátku", no published příprava → "Bez přípravy".
- Default period = current semester: Sep 1 – Jan 31 (winter), Feb 1 – Aug 31 (summer), matching `src/lib/metrics/periods.ts`.
- No DB schema/policy changes. Data access only via `supabase-js`.
- TS conventions: `interface` over `type` (except DB-derived), `??` over `||`, no magic numbers, semantic color tokens / `--chart-*`, both themes, gender-neutral Czech.
- `pnpm test` and `pnpm typecheck` must pass after every task.

## Review Focus

1. A period with zero started TS → each section shows an `Empty*` state, no NaN/Infinity, no crash. (Task 4 test)
2. A recorded TS where a member has no row → counted absent, not skipped. (Task 2 test)
3. Former member who facilitated in the period → still listed (after current members), not dropped. (Task 2 test)
4. Picking "Tento týden" on the stats page → stays on this week, does not jump back to the semester. (Task 1 test)
5. Coach viewing another team → Facilitace/Příprava render, Docházka shows the note, no attendance query is made. (Task 5 E2E + Task 3 signature)

---

### Task 1: Page-aware default range for the period picker

**Files:**
- Modify: `src/lib/time-tracking/date-range.ts` (add `semesterRange`, `parseRangeParams` fallback param)
- Modify: `src/components/time-tracking/cas-query.ts` (`resolveRangeParams`, `withRangeParams`)
- Modify: `src/components/time-tracking/date-range-nav.tsx` (optional `defaultRange` prop)
- Test: `src/lib/time-tracking/date-range.test.ts`, `src/components/time-tracking/cas-query.test.ts` (create if missing)

**Interfaces:**
- Produces:
  - `semesterRange(todayKey: string): DateKeyRange`
  - `parseRangeParams(from, to, todayKey, fallback?: DateKeyRange): DateKeyRange` — fallback defaults to this week (unchanged behaviour for Čas).
  - `resolveRangeParams(params, now, defaultRangeOf?: (todayKey: string) => DateKeyRange): ResolvedRange`
  - `withRangeParams(current, range, todayKey, defaultRange?: DateKeyRange): URLSearchParams` — drops `from`/`to` only when `range` equals `defaultRange` (default: this week).
  - `DateRangeNavProps.defaultRange?: DateKeyRange`, passed through to `withRangeParams`.

- [ ] **Step 1: Write failing tests**

```ts
it("semesterRange covers the winter semester into January", () => {
  expect(semesterRange("2026-11-08")).toEqual({ from: "2026-09-01", to: "2027-01-31" })
  expect(semesterRange("2027-01-15")).toEqual({ from: "2026-09-01", to: "2027-01-31" })
})
it("semesterRange covers the summer semester", () => {
  expect(semesterRange("2027-03-10")).toEqual({ from: "2027-02-01", to: "2027-08-31" })
})
it("resolveRangeParams uses the page default when params are missing", () => {
  const { range } = resolveRangeParams({}, new Date("2026-11-08T10:00:00Z"), semesterRange)
  expect(range).toEqual({ from: "2026-09-01", to: "2027-01-31" })
})
it("withRangeParams keeps this week explicit when the page default is the semester", () => {
  const week = presetRange("this-week", "2026-11-08")
  const params = withRangeParams(new URLSearchParams(), week, "2026-11-08", semesterRange("2026-11-08"))
  expect(params.get("from")).toBe(week.from)
})
it("withRangeParams drops params for the page default", () => {
  const semester = semesterRange("2026-11-08")
  expect(withRangeParams(new URLSearchParams(), semester, "2026-11-08", semester).toString()).toBe("")
})
```

- [ ] **Step 2: Run** `npx vitest run --project unit src/lib/time-tracking src/components/time-tracking/cas-query.test.ts` — Expected: FAIL (`semesterRange` not exported).
- [ ] **Step 3: Implement** the signatures above; month constants named (`WINTER_START_MONTH = 9`, `SUMMER_START_MONTH = 2`), pure key arithmetic (no `Date` local time).
- [ ] **Step 4: Run** the same command plus `pnpm test` — Expected: PASS, existing Čas tests unchanged.
- [ ] **Step 5: Commit** `feat(cas): allow a page-specific default period`

---

### Task 2: Pure statistics (`stats.ts`)

**Files:**
- Create: `src/lib/training-sessions/stats.ts`
- Test: `src/lib/training-sessions/stats.test.ts`

**Interfaces:**
- Produces (all exported):

```ts
export type RecordedAttendanceStatus = "present" | "late" | "excused"
export type AttendanceStatsStatus = RecordedAttendanceStatus | "absent"
export interface StatsPerson { id: string; name: string | null }
export interface StatsSession {
  id: string
  topic: string
  startsAt: string
  facilitators: StatsPerson[]
  preparationPublishedAt: string | null
  attendance: { profileId: string; status: RecordedAttendanceStatus }[]
}
export const PREP_LEAD_BUCKETS = ["3plus", "1to3", "under1", "late", "missing"] as const
export type PrepLeadBucket = (typeof PREP_LEAD_BUCKETS)[number]
export const PREP_LEAD_BUCKET_LABELS: Record<PrepLeadBucket, string>
export interface FacilitationRow { person: StatsPerson; count: number; isFormerMember: boolean }
export interface PreparationRow { session: StatsSession; leadHours: number | null; bucket: PrepLeadBucket }
export interface PreparationSummary { rows: PreparationRow[]; buckets: Record<PrepLeadBucket, number>; averageLeadHours: number | null }
export interface MemberAttendanceRow { person: StatsPerson; counts: Record<AttendanceStatsStatus, number>; recorded: number; rate: number | null }
export interface SessionAttendancePoint { session: StatsSession; rate: number }
export interface AttendanceSummary { perMember: MemberAttendanceRow[]; overTime: SessionAttendancePoint[]; unrecordedCount: number }

export function startedSessions(sessions: StatsSession[], now: Date): StatsSession[]
export function countFacilitations(sessions: StatsSession[], members: StatsPerson[]): FacilitationRow[]
export function summarizePreparation(sessions: StatsSession[]): PreparationSummary
export function summarizeAttendance(sessions: StatsSession[], members: StatsPerson[]): AttendanceSummary
export function formatLeadTime(hours: number): string
```

- [ ] **Step 1: Write failing tests** (fixtures: members A, B, C; helper `session({ startsAt, facilitators, publishedAt, attendance })`)

```ts
it("counts facilitations including members with zero, highest first", () => {
  const rows = countFacilitations([s1 /* A,B */, s2 /* A */], [A, B, C])
  expect(rows.map((r) => [r.person.id, r.count])).toEqual([["a", 2], ["b", 1], ["c", 0]])
})
it("keeps a former member who facilitated, after current members", () => {
  const rows = countFacilitations([session({ facilitators: [X] })], [A])
  expect(rows.map((r) => [r.person.id, r.isFormerMember])).toEqual([["a", false], ["x", true]])
})
it("buckets příprava lead time and averages published ones", () => {
  // starts 2026-11-10T10:00Z; published 4d, 2d, 5h before, 1h after, never
  const { buckets, averageLeadHours } = summarizePreparation([...])
  expect(buckets).toEqual({ "3plus": 1, "1to3": 1, under1: 1, late: 1, missing: 1 })
  expect(averageLeadHours).toBeCloseTo((96 + 48 + 5 - 1) / 4)
})
it("returns a null average when nothing was published", () => {
  expect(summarizePreparation([session({ publishedAt: null })]).averageLeadHours).toBeNull()
})
it("counts a current member without a row in a recorded TS as absent", () => {
  const { perMember } = summarizeAttendance([session({ attendance: [{ profileId: "a", status: "present" }] })], [A, B])
  const b = perMember.find((r) => r.person.id === "b")!
  expect(b.counts.absent).toBe(1)
  expect(b.rate).toBe(0)
})
it("ignores unrecorded TS and guests, and reports the gap", () => {
  const summary = summarizeAttendance(
    [session({ attendance: [] }), session({ attendance: [{ profileId: "a", status: "late" }, { profileId: "guest", status: "present" }] })],
    [A, B],
  )
  expect(summary.unrecordedCount).toBe(1)
  expect(summary.overTime.map((p) => p.rate)).toEqual([0.5])
  expect(summary.perMember[0].person.id).toBe("b") // lowest rate first
})
it("handles no sessions without NaN", () => {
  const s = summarizeAttendance([], [A])
  expect(s.perMember[0].rate).toBeNull()
  expect(s.overTime).toEqual([])
})
it("formats lead time in Czech", () => {
  expect(formatLeadTime(5)).toBe("5 h")
  expect(formatLeadTime(24)).toBe("1 den")
  expect(formatLeadTime(57.6)).toBe("2,4 dne")
  expect(formatLeadTime(120)).toBe("5 dní")
})
```

- [ ] **Step 2: Run** `npx vitest run --project unit src/lib/training-sessions/stats.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement.** Thresholds as `PREP_LEAD_HOURS = { threePlus: 72, oneToThree: 24 } as const`. Sort names with `localeCompare(…, "cs")`; `null` names sort last. In `perMember`, rows with `rate === null` sort last. `overTime` chronological. Labels exactly as in Global Constraints. `formatLeadTime`: `< 24` → whole hours "N h"; else days with one decimal (comma), plural: 1 → "den", 2–4 or any fraction → "dne"/"dny" (fraction → "dne", integer 2–4 → "dny"), ≥ 5 integer → "dní".
- [ ] **Step 4: Run** the test file — Expected: PASS.
- [ ] **Step 5: Commit** `feat(ts): pure statistics for facilitation, příprava and attendance`

---

### Task 3: Stats query

**Files:**
- Modify: `src/lib/training-sessions/queries.ts`

**Interfaces:**
- Consumes: `StatsSession` (Task 2), `TimeRange` from `@/lib/time-tracking/types` (`{ start: Date; end: Date }`-like — check exact shape).
- Produces: `listStatsSessions(supabase: SupabaseClient<Database>, teamId: string, range: TimeRange, opts: { includeAttendance: boolean }): Promise<StatsSession[]>`

- [ ] **Step 1: Implement.** One select on `training_sessions` filtered by `team_id`, `starts_at` in `[range.start, range.end)`, `cancelled_at is null`; embed `facilitators:training_session_facilitators(profile:profiles!training_session_facilitators_profile_id_fkey(id, name))`, `preparation:training_session_preparations(published_at)`, and — only when `includeAttendance` — `attendance:training_session_attendees(profile_id, status)`. Map to `StatsSession` (`attendance: []` when excluded). Order by `starts_at`. No unit test (PostgREST can't run against the test container); covered by the Task 5 E2E.
- [ ] **Step 2: Run** `pnpm typecheck` — Expected: no errors.
- [ ] **Step 3: Commit** `feat(ts): query sessions for statistics`

---

### Task 4: Statistics view components

**Files:**
- Create: `src/components/training-sessions/stats/stats-chart-card.tsx` — card with title, subtitle, PNG + CSV buttons, chart slot (uses `exportChartAsPng`, `downloadCsv`, `slugify` from `@/components/time-tracking/chart-export`).
- Create: `src/components/training-sessions/stats/facilitation-section.tsx`, `preparation-section.tsx`, `attendance-section.tsx`
- Create: `src/components/training-sessions/stats/ts-stats-view.tsx`
- Test: `src/components/training-sessions/stats/ts-stats-view.test.tsx`

**Interfaces:**
- Consumes: Task 2 functions/types.
- Produces:

```ts
export interface TsStatsViewProps {
  teamName: string
  rangeLabel: string           // formatRangeLabel(range)
  fileNamePrefix: string       // "ts-<team-slug>-<from>-<to>"
  members: StatsPerson[]
  sessions: StatsSession[]     // already started-only
  showAttendance: boolean
}
export function TsStatsView(props: TsStatsViewProps): JSX.Element
```

Sections: Facilitace (bar per person, `--chart-1`, former members' names suffixed " (bývalý člen:ka)"); Příprava (stat "V průměru X předem" via `formatLeadTime` + bar per bucket, "Až po začátku"/"Bez přípravy" in `--destructive`); Docházka (stacked bar present/late/excused/absent with `--chart-2/--chart-4/--chart-3/--destructive`, rate in tooltip and CSV; line chart of `overTime` rate in %; note "N TS bez vyplněné docházky" when > 0). When `!showAttendance`, Docházka renders only the note from Global Constraints. CSV columns: Facilitace `Jméno;Počet`; Příprava `Datum;Téma;Facilitace;Publikováno;Předstih (h);Kategorie`; Docházka `Jméno;Přítomno;Pozdě;Omluveno;Nepřítomno;Účast %`. Mobile: horizontal scroll like Čas (`MIN_COLUMN_WIDTH`).

- [ ] **Step 1: Write failing component tests** (mock `recharts` `ResponsiveContainer` to a fixed-size div as other chart tests do — check `reporting-view.test.tsx`)

```tsx
it("shows an empty state when there are no sessions", () => {
  render(<TsStatsView {...base} sessions={[]} />)
  expect(screen.getByText("V tomhle období zatím žádné TS neproběhlo")).toBeInTheDocument()
  expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
})
it("renders the three sections with the average lead time", () => {
  render(<TsStatsView {...base} sessions={twoSessions} />)
  expect(screen.getByRole("heading", { name: "Facilitace" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "Příprava" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "Docházka" })).toBeInTheDocument()
  expect(screen.getByText(/V průměru 2,4 dne předem/)).toBeInTheDocument()
})
it("reports TS without attendance", () => {
  render(<TsStatsView {...base} sessions={[unrecorded, recorded]} />)
  expect(screen.getByText("1 TS bez vyplněné docházky")).toBeInTheDocument()
})
it("hides attendance for coaches", () => {
  render(<TsStatsView {...base} sessions={twoSessions} showAttendance={false} />)
  expect(screen.getByText("Docházku vidí jen členové:ky týmu.")).toBeInTheDocument()
})
```

- [ ] **Step 2: Run** `npx vitest run --project component src/components/training-sessions/stats` — Expected: FAIL.
- [ ] **Step 3: Implement** the components per the Interfaces block; `"use client"` only on chart/export components.
- [ ] **Step 4: Run** the tests — Expected: PASS.
- [ ] **Step 5: Commit** `feat(ts): statistics view with facilitation, příprava and attendance charts`

---

### Task 5: Route, tab and E2E

**Files:**
- Modify: `src/lib/training-sessions/constants.ts` (`TS_ROUTES.stats = "/ts/statistiky"`)
- Modify: `src/components/training-sessions/ts-tab-bar.tsx` (third tab "Statistiky", `ChartColumn` icon; `getActiveTsTabUrl` returns it for `/ts/statistiky*` — must be checked **before** the generic `/ts/` → Objevovat fallback)
- Modify: `src/components/training-sessions/ts-tab-bar.test.tsx`
- Create: `src/app/(main)/ts/statistiky/page.tsx`
- Modify: `tests/e2e/fixtures/auth.ts` (export `seedPreparation(sessionId, profileId, publishedAt)` and `seedAttendance(sessionId, profileId, status, actorProfileId)`)
- Create: `tests/e2e/ts-statistics.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`resolveRangeParams(params, now, semesterRange)`, `DateRangeNav defaultRange`), Task 3 `listStatsSessions`, Task 4 `TsStatsView`, `resolveCasTeam`, `TeamSelect`, `TEAM_WIDE_ROLES`, `listTeamMembers`.

- [ ] **Step 1: Failing tab test**

```ts
it("marks Statistiky active on the stats route", () => {
  expect(getActiveTsTabUrl("/ts/statistiky")).toBe(TS_ROUTES.stats)
})
```

- [ ] **Step 2: Run** `npx vitest run --project component src/components/training-sessions/ts-tab-bar.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** route constant, tab, and page. Page mirrors `src/app/(main)/cas/reporting/page.tsx` (title "Statistiky", metadata description "Facilitace, příprava a docházka týmu na TS"), no-team empty state as there; `showAttendance = !TEAM_WIDE_ROLES.includes(profile.role)`; `listStatsSessions(..., { includeAttendance: showAttendance })`; then `startedSessions(sessions, now)`.
- [ ] **Step 4: Run** tab test + `pnpm test` + `pnpm typecheck` — Expected: PASS.
- [ ] **Step 5: E2E spec** — seed team, two members (one beta user), two past TS in the current semester (one facilitated by the user, příprava published 2 days before, attendance user=present; one unfacilitated, no příprava, no attendance). Assert on `/ts/statistiky`: tab active; "Facilitace" heading; "1 TS bez vyplněné docházky"; Příprava text contains "2 dny"; clicking the PNG button of Facilitace triggers a download ending `.png`. Dismiss the consent banner as in `tests/e2e/ts-preparation-attachments.spec.ts` (`openSession` pattern).
- [ ] **Step 6: Run** `npx playwright test tests/e2e/ts-statistics.spec.ts` — Expected: PASS. Screenshot light + dark and look at them.
- [ ] **Step 7: Commit** `feat(ts): Statistiky tab`
