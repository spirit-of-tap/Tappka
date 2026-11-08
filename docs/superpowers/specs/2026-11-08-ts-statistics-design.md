# TS statistiky — design

Date: 2026-11-08 · Status: approved in conversation, builder-checked

## Intent

Teams run training sessions (TS) and today nobody can see, over a period, how the
team is doing at them: who carries the facilitation, whether příprava comes out in
time for people to actually read it, and whether people show up. The Čas module
already has a "Reporting" page teams like; this brings the same kind of reporting to
TS for **your own team**.

Success: a team member opens the new tab, picks a period (default: current semester),
and within seconds sees who facilitated how often, how early příprava was published,
and who attends — and can export each chart.

## Goals

1. New tab **Statistiky** in the TS module tab bar (after Přehled, Objevovat), route
   `/ts/statistiky`.
2. Same reporting feel as `/cas/reporting`: period picker, chart cards, PNG + CSV
   export per chart.
3. Three sections:
   1. **Facilitace** — who facilitated how many times.
   2. **Příprava** — how long before the TS start the příprava was published.
   3. **Docházka** — attendance per person and over time.

## Non-goals

- Cross-team comparison or leaderboards. Students only ever see their own team.
- Stats about TS the viewer's team joined as guests (cross attendance).
- Editing anything from this page; it is read-only.
- New DB tables, columns, views or RPCs. Everything derives from existing tables.

## Anti-goals (would make it a failure even if it works)

- Showing missing attendance data as absence. A TS with no Docházka filled in must
  not lower anyone's attendance rate.
- Hiding people who facilitated 0 times — those gaps are the point.
- Exposing another team's data to a student (must hold under RLS, not just UI).

## Who sees what (decided)

- Students: their own team only. No team in profile → empty state (as in Čas).
- Coaches / admins: same team switcher as Čas (`resolveCasTeam` + `TeamSelect`,
  `?team=`), because they have no team of their own. They see **Facilitace and
  Příprava** for any team; **Docházka is hidden for them** with a short note that
  attendance is visible only to the team itself (decided). RLS keeps attendance
  team-only including from coaches, and this stays unchanged — no policy edit.
- Access gate: the `trainingSessions` feature flag, same as the rest of `/ts`.

## Scope of data (decided)

- Sessions: `training_sessions` of the selected team with `starts_at` inside the
  selected period, `removed_at IS NULL`. **Cancelled TS (`cancelled_at` set) are
  excluded from every statistic.**
- **Only TS that have already started (`starts_at <= now`) count, in every section**
  (Claude's call). Planned TS would turn Facilitace into "assigned" rather than
  "done". Exception: Příprava may mention future TS still without příprava as
  "ještě se píše", but never counts them as missing.
- Members: current team members (`listTeamMembers`). People who left the team but
  appear in historic data are still counted where they appear (builder: show them
  after current members, see "Left to the builder").
- Cross-team guests are excluded from attendance numbers.

## Sections

### 1. Facilitace (decided)

- Bar chart, one bar per team member, value = number of TS in the period they are a
  facilitator of (`training_session_facilitators`).
- Members with 0 are shown.
- Sorted by count descending, then name.

### 2. Příprava — lead time (decided, thresholds are Claude's call)

- Lead time per TS = `starts_at − training_session_preparations.published_at`.
  `published_at` is set on the first save with non-empty text (saving publishes;
  there is no draft), so it is the moment the příprava became visible.
- Summary: average lead time over TS that have a published příprava (shown as days,
  e.g. "v průměru 2,4 dne předem"; under 1 day show hours).
- Buckets (Claude's call):
  - **3+ dny předem**
  - **1–3 dny předem**
  - **Méně než den předem**
  - **Až po začátku** (published after `starts_at`)
  - **Bez přípravy** (no row, or `published_at` null) — only for TS that already
    started; future TS without příprava yet are "ještě se píše", not counted as
    missing.
- Presentation: bucket bar chart (count of TS per bucket) + the average as a stat.
- CSV export: one row per TS (datum, téma, facilitace, publikováno, předstih v hodinách,
  kategorie).

### 3. Docházka (decided)

Data: `training_session_attendees`. **The app never stores `absent`**: the
attendance PUT (`src/app/api/training-sessions/[id]/attendance/route.ts`) deletes
the rows of absent people, so rows are only `present` / `late` / `excused`.

**Absence rule (decided):** in a *recorded* TS, every **current team member** without
a row counts as **absent**. Accepted downside: someone who joined mid-period counts
as absent for earlier TS (teams rarely change mid-semester). No write-side change.

- **Per person**: stacked bar per current team member with counts of present / late /
  excused / absent over recorded TS. Attendance rate = (present + late) / recorded
  TS. Sorted so whoever misses most stands out (lowest rate first).
- **Over time**: line chart, one point per recorded TS (x = TS date), y = team
  attendance rate at that TS = (present + late) / attendees recorded at that TS
  (team members only).
- **Honest gaps**: a TS counts as "recorded" only if it has at least one attendee row
  for a team member. Others are listed as a note: "3 TS bez vyplněné docházky".
  Accepted edge: a TS where literally everyone was absent has no rows and therefore
  shows as unrecorded.
- Guests (attendees who are not team members) are ignored.

## Period (decided: default = current semester)

- Reuse the Čas period picker (`DateRangeNav`, `resolveRangeParams`, `?from=&to=`).
- Default when no params: current semester (`getCurrentSemesterRange`), not the
  current week — a week has too few TS to be meaningful.
- Careful: `withRangeParams` drops `from`/`to` when the range equals "this week"
  (Čas's default). With a semester default, picking "this week" would then fall back
  to the semester. The builder must make the default-range handling page-aware (e.g.
  pass the default range in, or always keep explicit params on this page).

## Implementation constraints (from the repo)

- Data access only via `supabase-js` on the server (Server Component page), RLS
  applies. Students can already read their team's sessions, facilitators,
  preparations (incl. drafts) and attendance. Coaches read sessions, facilitators
  and *published* preparations of any team (drafts have `published_at` null, so
  they correctly land in "Bez přípravy"); attendance is not queried for them.
- Pure computations (counts, buckets, rates) live in `src/lib/training-sessions/stats.ts`
  with unit tests; React rendering gets component tests; the page gets an E2E smoke.
- Charts: `recharts` via the existing chart setup; follow `DESIGN.md` (semantic
  tokens, `--chart-*` palette, both themes). Reuse `chart-export` helpers
  (`exportChartAsPng`, `downloadCsv`, `slugify`) from Čas.
- Czech copy gender-neutral (`:` forms only where needed).
- No magic numbers: bucket thresholds as named constants.

## Left to the builder

- Exact component split, whether to generalize Čas's `ReportChartCard` or write a
  small TS-specific chart card (prefer reusing export helpers either way).
- How former members are labelled.
- Empty states per section (use `Empty*` primitives).
- Mobile layout (charts scroll sideways like in Čas).

## Open questions

None. Builder check raised three; resolved above (absence rule and coach view by the
user, "started TS only" as Claude's call).
