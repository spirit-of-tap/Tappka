# Merge Komunita: combine Lidé + Týmy into one page

**Date:** 2026-06-10

## Problem

The sidebar's **Komunita** section splits into two subpages, **Lidé** (people grid
with search + filters) and **Týmy** (teams grid). In practice work happens in teams,
and people rarely browse the full people list. The team-list page is redundant as a
standalone view, but a team is rich enough (statistics, members) to keep its own
detail page.

## Goal

Collapse the People and Teams *list* views into a single Komunita page: the people
grid stays as the main content, and teams appear as a row of clickable badges that
link to each team's dedicated page. The team detail page (with stats) is unchanged.

## Behavior

The combined page lives at `/komunita` (currently a redirect to `/komunita/lide`).
It is a server component composed of:

1. **Header** — `Komunita` heading + subtitle.
2. **Team badges row** — a wrapped horizontal row of badges, one per team:
   team color dot + team name + member count. Each badge is a link to that team's
   page at `/komunita/tymy/[id]`. Built from `getTeamsWithCount`.
3. **SearchBar** — existing component, unchanged.
4. **FilterBar** — existing component, unchanged. Retains the team dropdown filter
   (plus role and year), so the people grid can still be narrowed by team in place.
5. **Results count + people grid** — existing `UserCard` grid, unchanged. Built from
   `getProfiles` with the same `search` / `teamId` / `role` / `year` search params.

Team badges are navigation (go to the team page), distinct from the FilterBar's team
dropdown which narrows the grid without leaving the page.

## Routes

| Route | Change |
| --- | --- |
| `app/(main)/komunita/page.tsx` | Replace redirect with the combined page (moved/adapted from the Lidé page). |
| `app/(main)/komunita/lide/page.tsx` | **Delete** — content moves to `/komunita`. |
| `app/(main)/komunita/tymy/page.tsx` | **Delete** — replaced by the badge row. |
| `app/(main)/komunita/tymy/[id]/page.tsx` | **Keep.** Update back link `"/komunita/tymy"` → `"/komunita"`. |
| `app/(main)/komunita/profil/[id]/page.tsx` | **Keep.** Update default back link `"/komunita/lide"` → `"/komunita"`. |
| `app/(main)/komunita/loading.tsx` | **Keep** — applies to the segment. |

## New component

`components/komunita/team-badges.tsx`
- **Purpose:** render the team badges row.
- **Props:** `teams` — the `getTeamsWithCount` result (`Team` + `member_count`).
  Badges show color dot + name + count only (no team picture).
- **Depends on:** `Badge` UI component and `next/link`.
- No client JS — plain `Link`-wrapped badges.

## Sidebar

`components/app-sidebar.tsx`
- Remove the `item.title === "Komunita"` collapsible/submenu special case.
- **Komunita** becomes a standard menu item linking to `/komunita`, active on the
  `/komunita` prefix (covers `/komunita/profil/...` and `/komunita/tymy/...`).
- Remove the now-unused `isKomunitaActive` variable.

## Out of scope

- No changes to team statistics or the team detail page layout (beyond the back link).
- No changes to `getProfiles` / `getTeamsWithCount` queries.
- No changes to the profile page beyond its default back link.
