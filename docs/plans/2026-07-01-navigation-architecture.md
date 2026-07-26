# Plan: Sidebar & navigation architecture for portfolio modules

## Context

The roadmap in `timeline/index.html` converts ~20 modules from two legacy Excel files (`individualni.xlsx`, `tymove.xlsx`, see `other/`) into Tappka features, rolling out across Fáze 1–4 through Oct 1 2026. Per-module specs live in `timeline/wiki/*.html`. This doc captures how the app's navigation should be structured to absorb all of them without turning into a bolted-on "Portfolio" subsystem — decided in conversation on 2026-07-01, before any of it was implemented.

## Current state (as of 2026-07-01, before this change)

- Sidebar: `components/app-sidebar.tsx`, wrapped by `app/(main)/layout.tsx`.
- Groups today: **Hlavní** (Dashboard `/`, Místnosti `/reservations`, Komunita `/komunita`), **Čtení** (Přehled `/prehled`, Hledat `/hledat`, Ke kontrole `/eseje/ke-kontrole` [coach/admin], Nastavení `/settings/kniha-knih` [coach/admin]), **Portfolio** (single `.xlsx`-upload page at `/portfolio` — no real structure), **Dev** (dev-only links).
- Role gating: `user?.role === "coach" || user?.role === "admin"` checked per nav item and again at page level (`lib/komunita/types.ts` defines `student | mentor | coach | admin`).
- `/komunita/profil/[id]` (individual profile) and `/komunita/tymy/[id]` (team profile) already exist and already show rolled-up stats — but nothing from the new modules yet.
- Precedent already in the codebase for scope-mixing within one nav group: the Eseje design (`docs/plans/2026-04-19-kniha-knih-eseje-design.md`) explicitly uses **Moje / Tým / Celá škola** tabs under one "Eseje" concept, plus a separate Komunita team-detail tab for team reading stats. Čtení today reproduces this shape live: Přehled (personal + team snapshot), Hledat (community-wide), Ke kontrole (coach reviewing others).

## Key decisions

| Question | Decision |
|---|---|
| Should nav be grouped by ownership scope (individual/team/community)? | **No.** The Excel split doesn't map cleanly onto app needs — `T02 Projekty` and `T05 Crossfertilizace` sit in `individual.xlsx` but function as team activities. Ownership scope is not a reliable organizing axis. |
| Should there be a "Portfolio" nav item / section / label? | **No, anywhere.** New modules are peers of Eseje and Rezervace, not children of a "Portfolio" wrapper — same as those two carry no "portfolio" framing today. Avoid the word in UI copy, and ideally in route/table/component names too, so it can't leak back in later via a breadcrumb or error message. |
| What's the grouping axis for the sidebar then? | **Activity/domain**, same register as the existing `Čtení` / `Komunita` / `Místnosti` groups (e.g. `Tým`, `Rozvoj`, `Klienti`) — descriptive of what's inside, not a taxonomy of who owns it. |
| Does every module need a sidebar destination? | **No — only repeated activities do.** Heuristic: *would a user ever click "add another one"?* If yes → sidebar item (it's a place you return to). If no (one-time or rarely-updated) → a card on the profile or team page, same register as a bio field. |
| How do users discover the one-time/rare items if they're not in the sidebar? | A **"Připravenost" (readiness) checklist/widget** on the Dashboard, not a sidebar slot per item. Search complements it for users who already know what they want; the checklist is for "what do I still owe." |
| Isn't the readiness checklist just the Portfolio concept under another name? | Functionally similar, but framed as progress/readiness, not a branded "Portfolio" section — and it reuses logic already committed to elsewhere (see next row), so it isn't a new invented concept. |
| How does the readiness checklist relate to the Oct 1 deadline plan? | It's the **same computation** as the export fallback already written into `timeline/index.html` Fáze 4 ("export as-is, with highlighted fields for anything not filled in"). Build the "what's missing" logic once, surface it twice: continuously as an in-app nudge, and as the highlight pass at export time if the deadline arrives first. |
| Does individual/team ownership matter anywhere then? | **Yes — specifically for the readiness checklist**, not for general nav structure. A student can unilaterally finish their own items but cannot unilaterally finish team items (those need the whole team). The checklist should show two groups, "Moje" and "Tým", so it's clear who's actually blocked on what. |
| Do pages need to only show one scope's data? | No — a module's page can mix scopes internally (tabs) exactly like Čtení already does, if the activity genuinely needs it (e.g. Training Session: team session log + your personal reflection on each one). |

## Proposed sidebar (activity-grouped, no ownership labels, no "Portfolio")

```
Hlavní
└─ Dashboard              (readiness/"Připravenost" widget lives here)

Čtení                     (unchanged)

Klienti
└─ Zákaznické schůzky      (T03 — repeated log)

Rozvoj
├─ Individuální koučování  (T09 — repeated log)
├─ Nástroje a techniky     (T04 — repeated log)
└─ Odborná praxe           (T23 — repeated log)

Tým
├─ Týmový deník            (I05 — repeated log)
├─ Týmová reflexe          (I06 — repeated log, confirm cadence)
├─ Training Session        (I02 — repeated, personal+team tabs)
├─ Týmová zpětná vazba     (I09 — repeated, confirm cadence)
└─ Projekty                (T02 — repeated log)

Komunita                  (unchanged)
Místnosti                 (unchanged)
```

**Not in the sidebar — profile-page cards (individual):**
Osobnostní test (T11), Learning Contract (T08), Skill Profile (T06, may also need a team-comparison tab), Birth Giving (T10), Rocket Model personal half (T07).

**Not in the sidebar — team-page cards:**
Team Contract & Leading Thoughts (I03), Finanční směrnice (I11), Týmové role (I04), Semestrální reflexe (I07, confirm cadence), Rocket Model team half (I09), Crossfertilizace (T05, confirm cadence — could be a repeated log instead if sessions are frequent).

**Postponed (per roadmap, out of scope for this pass):** financial reports — I12, I15, I16, I17, I14.

## Open questions (not resolved yet)

- Exact field-level split of Rocket Model and Training Session between personal/team halves — needs the actual form design, not derivable from the roadmap doc alone.
- Whether Zákaznické schůzky or Individuální koučování need coach sign-off, mirroring the "potvrzení přečtení koučem" pattern essays already have.
- Real-world cadence of Semestrální reflexe and Crossfertilizace — if either happens often enough, it moves from "profile/team card" into "repeated log → sidebar item."
- No grep done yet for existing "portfolio" naming in routes/tables/components (`/portfolio` route, any DB columns) — should be scrubbed before this ships so the word doesn't resurface.
- Copy/naming for the readiness widget itself ("Připravenost", "Co mi zbývá", or other) — not decided, just that it shouldn't say "Portfolio."

## Next steps

1. Build the readiness/"Připravenost" checklist widget first — it's the piece that makes everything else find-able, and its "what's missing" logic is reusable for the Oct 1 export fallback.
2. Restructure `components/app-sidebar.tsx` per the tree above as Fáze 1 items ship.
3. Add module cards to `/komunita/profil/[id]` and `/komunita/tymy/[id]` for the one-time/rare items.
4. Revisit the "confirm cadence" items once real usage data or coach input is available.
