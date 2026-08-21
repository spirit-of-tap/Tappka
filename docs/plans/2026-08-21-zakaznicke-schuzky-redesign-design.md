# Redesign: Zákaznické schůzky (customer meetings)

**Date:** 2026-08-21 · **Status:** validated with user
**Scope:** `/schuzky` page first; shared primitives extracted for later koučování/týmová-reflexe adoption.

## Why students visit

1. Right after a meeting → record how it went (**capture**, time-sensitive)
2. Before a meeting → see who they met before / what was planned (**prep**)
3. Follow-up sweep → which meetings still lack post-mortem (**open loops**)
4. Semester review → how active they were; show mentor (**progress**)

Current design serves only #4 well; #2 is buried in identical cards; #3 is invisible.

## Decisions

1. **Open loops drive hierarchy.** Status chips on cards (`Naplánováno` future · `Chybí follow-up` past-without-post-mortem · *no chip* when done). Status derived from `post_mortem IS NULL AND meeting_at < now()` — one shared helper so list + detail can't drift.
2. **Person-first card anatomy.** Row 1 = contact person (initials disc) + status chip right. Row 2 = company + date. Whole card links to detail; no buttons on list cards.
3. **No walls of text on list.** Objective/post-mortem previews removed from cards; full text lives on detail page.
4. **CTA into header.** "+ Nová" moves into `PageHeader.action`; InfoCard stays below.
5. **Search above timeline.** Client-side filter over person/company/objective/post-mortem; months without hits hide while searching; result count shown.
6. **Empty months auto-collapsed** everywhere via shared MonthSection.

## Architecture

### New files

| File | Contents |
|---|---|
| `src/lib/metrics/config.ts` | `MetricDefinition { id, label, period: "semester"\|"year" }` registry |
| `src/lib/metrics/periods.ts` | promoted `getCurrentSemesterRange` (from koučování) |
| `src/lib/customer-meetings/status.ts` | `getMeetingStatus(meeting)` — promoted from `[meetingId]/page.tsx` |
| `src/lib/timeline/group-by-month.ts` | month keys/labels/addMonths/groupByMonth({ collapseEmpty }) |
| `src/components/ui/month-section.tsx` | collapsible month header (chevron + count badge + aria-expanded/controls) |
| `src/components/metrics/metric-progress.tsx` | compact progress strip ({ current, target, periodLabel }) |

### Rebuilt (schůzky)
- `customer-meeting-list.tsx` → timeline + search wiring
- `customer-meeting-card.tsx` → person-first anatomy, chips
- `schuzky/page.tsx` → CTA into header; server-side counts feed `<MetricProgress>`

No schema changes; no new queries.

## Card anatomy

```
┌──────────────────────────────────────┐
│ ⓚ Kateřina Gonderová   [Chybí]       │  ← person + open-loop chip
│ 🏢 GrowJOB, s.r.o. · 28. 5.          │  ← company · date
└──────────────────────────────────────┘
```

Whole card = link. Chips only mark open loops (Zeigarnik).

## Rollout & tests

Primitives → schůzky rebuild → verify light/dark + mobile → koučování/reflexe adopt primitives later.
Tests per runbook: unit (grouping, status incl. edge cases, config), component (card, MonthSection). No DB changes.
