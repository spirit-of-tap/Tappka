# Týmový deník redesign — Design

**Date:** 2026-08-22 · **Scope:** `/tymovy-denik` — photo-led timeline rows + new detail page.

## Why people visit

1. Compliance/archive — school expects a record of shared activities.
2. Reminiscing/showcase — photos make the log a team album.
3. Reflection completeness — entries without reflections are open loops.

## Content model

- Schema: add nullable `image_path text` to `team_activities` (storage key, avatars pattern).
- New Supabase Storage bucket `team-activities` mirroring avatar bucket policies.
- Form gains optional image picker: preview, replace, remove (delete object + null path).
- Upload via supabase-js from browser (no new routes); RLS gates to team members.

## Overview

Row = square rounded thumbnail (type-initials disc fallback) · event type bold lead · date pill `[12.10.]` · chip **Chybí reflexe** when reflection empty (warning tint) · whole row links to detail.
Timeline via shared `MonthSection`; empty months skipped; search over type/participants/reason/reflection. No progress strip (no metric exists — config honesty).

## Detail page `/tymovy-denik/[id]`

Hero photo (~16:9, muted placeholder when none) → h1 = event type → subtitle long date (+ participants inline if short) → three labeled blocks (Účast / Proč jsme tam byli / Co jsme si odnesli), full text → Upravit dialog + ⋮ overflow Smazat (AlertDialog) anchored near header → PageBack. Delete navigates back to overview.

## Status helper

`getTeamActivityLoop({ reflection })`: empty → "missing-reflection"; else null. No undated state (occurred_at NOT NULL).

## Files

| Action | File |
|---|---|
| Modify | `db/schema/team-activities.ts` (+image_path), migration |
| Create | `src/lib/tymovy-denik/status.ts` + test |
| Create | `team-activity-thumb.tsx`, `src/app/(main)/tymovy-denik/[id]/page.tsx`, `team-activity-detail.tsx` |
| Rewrite | `team-activity-list.tsx` → linked-row timeline; delete card |
| Modify | `team-activity-form.tsx` (upload), `page.tsx` (PageShell), `tests/e2e/tymovy-denik.spec.ts` |

## Tests

Unit: status derivation. Component: thumb fallback, chip matrix, menu-hidden delete, detail blocks. E2E: update selectors for row→detail flow incl. create with image skipped (storage not in jsdom/E2E scope beyond UI flow).

Migration note: user runs `pnpm db:migrate`; check migrations for drops.
