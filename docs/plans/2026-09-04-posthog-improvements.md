# PostHog Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn PostHog from pageview-only into GDPR-compliant product + error analytics for the two generally-available features: rezervace and čtení.

**Architecture:** Reverse-proxy ingest (`/ingest`) + opt-in consent banner + typed client/server `track()` wrapper + enriched identify/groups + curated rezervace/čtení events + hardened error tracking. No authorization ever depends on PostHog. Other modules stay untracked until they leave beta.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, `posthog-js@1.418.1`, `posthog-node@5.26.1` (or `@posthog/next` wrapper), shadcn/ui + sonner, Vitest unit/component, Playwright E2E.

**Branch:** `feat/posthog-improvements` (already cut from `preview`).

---

## 0. Legal groundwork (do first, blocks enabling replay/surveys in prod)

No code. Owner: maintainer + Spirit of TAP, z.s. (IČO 23152036, L 80354 u Městského soudu v Praze, sídlo Blatenská 4018, 430 03 Chomutov).

Controller for GDPR is Spirit of TAP, z.s. (not ČZU). PostHog = processor.

- [ ] Decide host: use **EU Cloud** `https://eu.i.posthog.com` + `https://eu-assets.i.posthog.com`. If `NEXT_PUBLIC_POSTHOG_HOST` currently points to `us.*`, migrate project to EU before prod rollout.
- [ ] Sign PostHog DPA in org settings (PostHog = processor, Spirit of TAP, z.s. = controller). Record date + signer (statutory: Tuuli Co. Družstvo, zastoupena Julie Holá).
- [ ] Update privacy notice (Czech, gender-neutral per `DESIGN.md`): what is collected (pageview, clicks, errors, replay if enabled), purpose (improve app), retention (e.g. 90d events / 30d replay), how to withdraw (banner + `Nastavení → Soukromí`), contact for erasure.
- [x] Privacy page created: `src/app/ochrana-soukromi/page.tsx` (controller Spirit of TAP, purposes, 90d/30d retention, cookie inventory, rights via in-app feedback or spolek seat). Banner links to it; footer link on `/about`.
- [ ] Data minimization rule: never send `name`, `email`, essay/reflection text, document contents as event props. Only `user_id`, `role`, `beta_cohort`, `team_id`, `feature`, `action`.
- [ ] Erasure runbook: Supabase row delete + PostHog person delete (`POST /api/projects/:id/persons/:distinct_id/delete` or dashboard) within 30d. Document in `docs/runbooks/privacy-erasure.md`.
- [ ] Cookie inventory: `ph_*_posthog` (consent + identity). Needed for banner text.

Gate: do not enable session replay/heatmaps in production until 0 is done. Analytics events with opt-in can proceed to preview.

---

### Task 1: Reverse-proxy ingest (stop adblock loss)

**Files:**
- Modify: `next.config.ts:1-42`
- Modify: `src/instrumentation-client.ts:1-10`
- Modify: `src/lib/posthog-server.ts:1-17`
- Test: manual `curl` + network tab (no unit test; verify no 404)

**Step 1: Add rewrites**

In `next.config.ts`, add:

```ts
async rewrites() {
  return [
    { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
    { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
  ];
},
skipTrailingSlashRedirect: true,
```

If US host is required, swap `eu` → `us` + `us-assets`. Keep EU default.

**Step 2: Point clients at proxy**

In `src/instrumentation-client.ts`:

```ts
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  defaults: "2026-01-30",
  capture_pageview: false,
  capture_pageleave: true,
  capture_heatmaps: true,
  enable_recording_console_log: false, // enable in Task 7 only after legal gate
  autocapture: {
    css_selector_ignorelist: ["[data-ph-no-capture]", ".ph-no-capture", "[data-sensitive]"],
  },
  mask_all_element_attributes: false,
  mask_all_text: false,
});
```

In `src/lib/posthog-server.ts` keep direct `https://eu.i.posthog.com` host (server-to-server, no proxy needed).

**Step 3: Verify**

Run: `pnpm dev`, open network tab, confirm requests to `/ingest/array/*` return 200, no direct `*.i.posthog.com` from browser.

**Step 4: Commit**

```bash
git add next.config.ts src/instrumentation-client.ts
git commit -m "feat: proxy PostHog ingest to avoid adblockers"
```

---

### Task 2: Consent banner (GDPR opt-in, Czech inclusive copy)

**Files:**
- Create: `src/components/posthog/consent-banner.tsx`
- Create: `src/components/posthog/consent-banner.test.tsx`
- Modify: `src/app/layout.tsx:106-132`
- Modify: `src/instrumentation-client.ts:1-10`

**Step 1: Write failing component test**

Create `src/components/posthog/consent-banner.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConsentBanner } from "./consent-banner";

it("calls opt_in on accept", async () => {
  render(<ConsentBanner />);
  await userEvent.click(screen.getByRole("button", { name: /přijmout/i }));
  // assert posthog.opt_in_capturing called (mock posthog-js)
});
```

Run: `pnpm test:component -- consent-banner`
Expected: FAIL (file missing)

**Step 2: Harden init to opt-out by default**

```ts
opt_out_capturing_by_default: true,
opt_out_capturing_persistence_type: "localStorage",
```

**Step 3: Implement banner**

Create `src/components/posthog/consent-banner.tsx` (client):

```tsx
"use client";
import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (posthog.get_explicit_consent_status() === "pending") setVisible(true);
  }, []);
  if (!visible) return null;
  return (
    <div role="dialog" aria-label="Souhlas s analytikou" className="fixed bottom-4 ...">
      <p>Pomozte nám zlepšit Tappku. Měříme anonymizované používání a chyby.</p>
      <Button onClick={() => { posthog.opt_in_capturing(); setVisible(false); }}>Přijmout</Button>
      <Button variant="outline" onClick={() => { posthog.opt_out_capturing(); setVisible(false); }}>Odmítnout</Button>
    </div>
  );
}
```

Copy must be gender-neutral, present tense. Link to privacy notice.

Mount in `src/app/layout.tsx` inside `<PostHogProvider>` after `<Toaster />`.

**Step 4: Run tests**

Run: `pnpm test:component -- consent-banner` + `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/posthog/consent-banner.tsx src/components/posthog/consent-banner.test.tsx src/app/layout.tsx src/instrumentation-client.ts
git commit -m "feat: add GDPR consent banner with opt-out default"
```

---

### Task 3: Typed analytics wrapper (single entry point)

**Files:**
- Create: `src/lib/analytics.ts`
- Create: `src/lib/analytics.test.ts`

**Step 1: Write failing unit test**

Create `src/lib/analytics.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import posthog from "posthog-js";
import { trackFeature } from "./analytics";

describe("trackFeature", () => {
  it("captures feature_interaction with allowlisted props", () => {
    const spy = vi.spyOn(posthog, "capture").mockImplementation(() => {});
    trackFeature("reservations", "created");
    expect(spy).toHaveBeenCalledWith("feature_interaction", expect.objectContaining({ feature: "reservations", action: "created" }));
  });
});
```

Run: `pnpm test:unit -- analytics`
Expected: FAIL

**Step 2: Implement minimal wrapper**

Create `src/lib/analytics.ts`:

```ts
import posthog from "posthog-js";

// Pilot scope: only GA features. Add others when they leave beta.
export const FEATURES = ["reservations", "cteni"] as const;
export type FeatureKey = (typeof FEATURES)[number];

export function trackFeature(feature: FeatureKey, action: string, props: Record<string, string | number | boolean> = {}) {
  try {
    posthog.capture("feature_interaction", { feature, action, ...props });
  } catch { /* ignore */ }
}

export function trackView(feature: FeatureKey, props: Record<string, string | number | boolean> = {}) {
  try {
    posthog.capture("feature_view", { feature, ...props });
  } catch { /* ignore */ }
}
```

Rules: never pass PII/content bodies. Only ids + enums.

**Step 3: Run tests**

Run: `pnpm test:unit -- analytics`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/analytics.ts src/lib/analytics.test.ts
git commit -m "feat: add typed PostHog analytics wrapper"
```

---

### Task 4: Enriched identify + groups

**Files:**
- Modify: `src/components/posthog/posthog-identify.tsx:1-21`
- Modify: `src/app/(main)/layout.tsx:35-51`
- Test: `src/components/posthog/posthog-identify.test.tsx` (new)

**Step 1: Write failing test**

Assert `identify` called with `{ role, beta_access, beta_cohort }` and `group("team", teamId)` when `teamId` present, and `setPersonProperties` used for updates without re-identify churn.

Run: `pnpm test:component -- posthog-identify`
Expected: FAIL

**Step 2: Implement**

```tsx
"use client";
import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

export function PostHogIdentify({ distinctId, role, betaAccess, betaCohort, teamId }: {
  distinctId: string; role: string; betaAccess: boolean; betaCohort: "A"|"B"; teamId?: string | null;
}) {
  const posthog = usePostHog();
  useEffect(() => {
    if (!posthog) return;
    posthog.identify(distinctId, { role, beta_access: betaAccess, beta_cohort: betaCohort });
    if (teamId) posthog.group("team", teamId);
  }, [posthog, distinctId, role, betaAccess, betaCohort, teamId]);
  return null;
}
```

Pass `role` + `team_id` from `getSessionProfile()` in `(main)/layout.tsx`. Keep `posthog.reset()` on logout as-is.

**Step 3: Verify**

Run: `pnpm test:component -- posthog-identify` + `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/posthog/posthog-identify.tsx src/app/\(main\)/layout.tsx
git commit -m "feat: enrich PostHog identify with role and team group"
```

---

### Task 5: Server-side capture helper

**Files:**
- Create: `src/lib/analytics-server.ts`
- Create: `src/lib/analytics-server.test.ts`

**Step 1: Write failing test**

Mock `getPostHogServer` to return `{ capture: vi.fn() }`, assert `trackServer({distinctId, event: "feature_interaction", properties})` forwards allowlisted props only.

Run: `pnpm test:unit -- analytics-server`
Expected: FAIL

**Step 2: Implement**

```ts
import { getPostHogServer } from "./posthog-server";

export async function trackServer(event: string, distinctId: string, properties: Record<string, string | number | boolean> = {}) {
  const client = getPostHogServer();
  if (!client) return;
  try {
    await client.captureImmediate({ distinctId, event, properties });
  } catch { /* ignore */ }
}
```

Use in route handlers / server actions for completed actions (e.g. reservation created) where client may have navigated away.

**Step 3: Run + commit**

Run: `pnpm test:unit -- analytics-server`
```bash
git add src/lib/analytics-server.ts src/lib/analytics-server.test.ts
git commit -m "feat: add server-side PostHog capture helper"
```

---

### Task 6: Pilot feature events (rezervace + čtení only)

**Files (pilot, nothing else):**
- Modify: reservation flows (`src/app/(main)/reservations/*` + `src/app/rezervace/*`)
- Modify: reading flows (`src/app/(main)/cteni/*`)

Out of scope: `tymovy-denik`, `zpetna-vazba`, and all other beta modules — not available to most people, do not instrument yet.

**Step 1: Add `trackView` on pilot pages**

In each pilot `page.tsx`, add client tracker or call `trackView("reservations" | "cteni")` on mount. Keep server render pure; put tracking in existing client component.

**Step 2: Add `trackFeature(feature, "created"|"submitted"|"completed")` on success paths**

Example (reservation):

```ts
import { trackFeature } from "@/lib/analytics";
trackFeature("reservations", "created", { has_team: !!teamId });
```

Example (čtení):

```ts
trackFeature("cteni", "completed", { source: "prehled" });
```

Never send free text (no book notes, titles, or feedback bodies).

**Step 3: Verify in PostHog**

Preview env: trigger both flows, confirm `feature_view` + `feature_interaction` appear with `feature in ["reservations","cteni"]`. Build Insight: `feature_interaction` count grouped by `feature` + `action`.

**Step 4: Commit per feature**

```bash
git add src/app/\(main\)/reservations src/lib/analytics.ts
git commit -m "feat: track reservation usage events"
```

```bash
git add src/app/\(main\)/cteni src/lib/analytics.ts
git commit -m "feat: track cteni usage events"
```

YAGNI: do not instrument other modules in this plan.

---

### Task 7: Error tracking hardening

**Files:**
- Modify: `src/instrumentation.ts:1-40`
- Modify: `src/app/global-error.tsx:1-31`, `src/app/(main)/error.tsx:1-28`
- Modify: `src/instrumentation-client.ts:1-10`

**Step 1: Prefer official server hook**

If `@posthog/next` is available for Next 16, replace hand-rolled cookie regex in `src/instrumentation.ts` with:

```ts
export { onRequestError } from "@posthog/next";
```

If not compatible, keep current `captureExceptionImmediate` but add `$session_id` forwarding and a comment citing docs. Add `before_send` fingerprint skip for `ChunkLoadError`.

**Step 2: Add context to client boundaries**

```ts
posthog.captureException(error, { feature: "global", digest: error.digest });
```

**Step 3: Enable console-log replay only after Task 0 gate**

```ts
enable_recording_console_log: true,
session_recording: { maskAllInputs: true },
```

Default stays OFF until DPA + notice live.

**Step 4: Verify**

Run: `pnpm test` + `pnpm build`. Trigger test error in preview, confirm `$exception` with session link + replay (if enabled).

**Step 5: Commit**

```bash
git add src/instrumentation.ts src/app/global-error.tsx src/app/\(main\)/error.tsx src/instrumentation-client.ts
git commit -m "feat: harden PostHog error tracking"
```

---

### Task 8: Flags + micro-surveys (defer until rezervace/cteni events flow)

- Migrate one beta gate (e.g. `portfolio`) to PostHog flag to get `$feature_flag_called` analytics only if needed. Never use flag for authz — keep `canAccessFeature` as source of truth, flag is analytics-only.
- Add one PostHog survey tied to GA scope only (e.g. post-reservation 1-question) instead of building custom UI. No surveys for beta modules in this plan.

Separate commit. Skip if pilot shows no need.

---

### Task 9: Verification + rollout

**Step 1: Fast suite**

Run: `pnpm test`
Expected: PASS (unit + component)

**Step 2: Static + build**

Run:
```bash
pnpm typecheck
pnpm lint
pnpm build
```
Expected: exit 0

**Step 3: Preview checklist**

- [ ] `/ingest/*` 200, no direct browser calls to `*.i.posthog.com`
- [ ] Banner shows on first visit, accept/decline persists
- [ ] `$pageview`, `feature_view`, `feature_interaction`, `$exception` visible in PostHog EU project
- [ ] Persons show `role`, `beta_cohort`, `team` group
- [ ] Light + dark themes for banner (per `DESIGN.md`)

**Step 4: Prod gate**

Do not merge to `production` until Task 0 legal items are signed. Merge to `preview` freely.

---

## References

- Context7 `/posthog/posthog-js` (defaults, autocapture, `capture_pageview: 'history_change'` vs manual)
- Context7 `/posthog/posthog.com` (Next.js `onRequestError`, proxy `rewrites`, GDPR consent `opt_out_capturing_by_default` + `opt_in/opt_out`, EU Cloud + DPA as processor)
- Repo: `src/instrumentation-client.ts`, `src/instrumentation.ts`, `src/lib/posthog-server.ts`, `src/app/posthog-provider.tsx`, `src/app/posthog-pageview.tsx`, `src/components/posthog/posthog-identify.tsx`, `next.config.ts`
