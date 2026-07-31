# Čtení IA Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the "Čtení" feature's 16 routes (currently spread across `/prehled`, `/hledat`, `/knihovna/*`, `/eseje/*`, `/settings/kniha-knih`) under a single `/cteni/*` hierarchy, fold two routes into existing tabs, delete one dead route, and shrink the sidebar from 6 items to 4.

**Architecture:** Pure route/navigation restructuring — no data model, RLS, or business-logic changes. Each task moves one route family (via `git mv`, which preserves history) and fixes every call site that links to it, so the app remains fully working and typecheck-clean after every task. The sidebar and E2E spec are updated last, once every route has landed at its final path.

**Tech Stack:** Next.js App Router (`src/app/(main)/...`), React Server/Client Components, Playwright E2E, Vitest (unit/component).

## Global Constraints

- No redirects for old paths — this is spec'd as free-to-change (internal app, sidebar/in-app navigation only, no bookmark compatibility needed).
- No DB/schema changes — do not touch `db/schema/*` or run any migration command for this work.
- Follow existing code style: `interface` over `type`, `??` over `||`, kebab-case files, one blank line between import groups (external → `@/` internal → styles).
- After every task: run `pnpm typecheck` and `pnpm test` (unit + component) — both must pass before committing that task.
- Do not run `pnpm test:e2e` until Task 9 (the E2E spec only gets rewritten there — running it earlier will show expected failures for the not-yet-migrated paths it references).

---

### Task 1: Move `/prehled` → `/cteni/prehled`

**Files:**
- Move: `src/app/(main)/prehled/page.tsx` → `src/app/(main)/cteni/prehled/page.tsx`
- Modify: `src/components/dashboard/reading-progress-card.tsx:34`
- Modify: `src/components/dashboard/reading-progress-card.test.tsx:29,32`
- Modify: `src/components/dashboard/team-snapshot-card.tsx:36`
- Modify: `src/components/dashboard/metrics-card.tsx:33`

**Interfaces:**
- Produces: the route `/cteni/prehled` (same `PrehledPage` component, same `searchParams: Promise<{ tab?: string }>` contract, unchanged). Later tasks (7, 8) will extend `defaultTab` and the sidebar to reference this path.

- [ ] **Step 1: Move the route folder**

```bash
mkdir -p src/app/\(main\)/cteni
git mv "src/app/(main)/prehled" "src/app/(main)/cteni/prehled"
```

- [ ] **Step 2: Update every consumer link**

`src/components/dashboard/reading-progress-card.tsx:34` — change:
```tsx
href="/prehled"
```
to:
```tsx
href="/cteni/prehled"
```

`src/components/dashboard/reading-progress-card.test.tsx:29,32` — change:
```tsx
it("renders a link to /prehled", () => {
```
to:
```tsx
it("renders a link to /cteni/prehled", () => {
```
and change:
```tsx
expect(link).toHaveAttribute("href", "/prehled");
```
to:
```tsx
expect(link).toHaveAttribute("href", "/cteni/prehled");
```

`src/components/dashboard/team-snapshot-card.tsx:36` — change:
```tsx
href="/prehled?tab=tym"
```
to:
```tsx
href="/cteni/prehled?tab=tym"
```

`src/components/dashboard/metrics-card.tsx:33` — change:
```tsx
<Link href="/prehled" className="space-y-1 rounded-lg p-2 -m-2 transition-colors hover:bg-muted/50">
```
to:
```tsx
<Link href="/cteni/prehled" className="space-y-1 rounded-lg p-2 -m-2 transition-colors hover:bg-muted/50">
```

- [ ] **Step 3: Verify no stale references remain in files touched this task**

Run: `grep -rn '"/prehled' src/components/dashboard/`
Expected: no output (all occurrences updated).

- [ ] **Step 4: Typecheck and test**

Run: `pnpm typecheck && pnpm test`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move /prehled to /cteni/prehled"
```

---

### Task 2: Move `/hledat` → `/cteni/hledat`

**Files:**
- Move: `src/app/(main)/hledat/page.tsx` → `src/app/(main)/cteni/hledat/page.tsx`
- Modify: `src/components/dashboard/quick-actions.tsx:40`

**Interfaces:**
- Produces: the route `/cteni/hledat`. Tasks 3–7 fix the many "back to search" links across book/essay/admin pages that point here — those are edited within their own tasks since the linking files themselves are also moving or being edited for other reasons.

- [ ] **Step 1: Move the route folder**

```bash
git mv "src/app/(main)/hledat" "src/app/(main)/cteni/hledat"
```

- [ ] **Step 2: Update the one external consumer not covered by a later task**

`src/components/dashboard/quick-actions.tsx:40` — change:
```tsx
<Link href="/hledat">
```
to:
```tsx
<Link href="/cteni/hledat">
```

(This file also contains `/eseje/ke-kontrole` and `/eseje/nova` links at lines 15 and 27 — those are updated in Task 4, which handles all essay-route consumers together.)

- [ ] **Step 3: Typecheck and test**

Run: `pnpm typecheck && pnpm test`
Expected: both PASS. (Typecheck will still pass even though other files still reference the now-moved `/hledat` string as a plain string literal — Next.js `Link href` isn't statically checked against real routes in this project, so those stale links become runtime 404s until fixed in their respective tasks below. This is expected and resolved by the end of Task 6.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move /hledat to /cteni/hledat"
```

---

### Task 3: Move book routes to `/cteni/knihy/*`, delete dead `/knihovna` redirect

**Files:**
- Move: `src/app/(main)/knihovna/[bookId]/page.tsx` → `src/app/(main)/cteni/knihy/[bookId]/page.tsx`
- Move: `src/app/(main)/knihovna/[bookId]/admin-actions.tsx` → `src/app/(main)/cteni/knihy/[bookId]/admin-actions.tsx`
- Move: `src/app/(main)/knihovna/[bookId]/pujcit/page.tsx` → `src/app/(main)/cteni/knihy/[bookId]/pujcit/page.tsx`
- Move: `src/app/(main)/knihovna/[bookId]/upravit/page.tsx` → `src/app/(main)/cteni/knihy/[bookId]/upravit/page.tsx`
- Move: `src/app/(main)/knihovna/nova/page.tsx` → `src/app/(main)/cteni/knihy/nova/page.tsx`
- Move: `src/app/(main)/knihovna/rocket-model/page.tsx` → `src/app/(main)/cteni/knihy/rocket-model/page.tsx`
- Move: `src/app/(main)/knihovna/top-bob/page.tsx` → `src/app/(main)/cteni/knihy/top-bob/page.tsx`
- Delete: `src/app/(main)/knihovna/page.tsx` (dead redirect to `/hledat`)
- Modify: `src/components/books/coach-book-row.tsx:69`
- Modify: `src/components/books/add-book-wizard.tsx:72,76,107,170`
- Modify: `src/components/books/top-bob-browser.tsx:48,64`
- Modify: `src/components/books/book-row-header.tsx:55`
- Modify: `src/components/books/book-edit-form.tsx:47`
- Modify: `src/components/books/book-delete-button.tsx:37`
- Modify: `src/components/books/book-card.tsx:20,35`
- Modify: `src/components/search/search-page-client.tsx:278,302,480,490,602`
- Modify: `src/app/(main)/eseje/[essayId]/page.tsx:133`

**Interfaces:**
- Produces: routes `/cteni/knihy/[bookId]`, `/cteni/knihy/[bookId]/pujcit`, `/cteni/knihy/[bookId]/upravit`, `/cteni/knihy/nova`, `/cteni/knihy/rocket-model`, `/cteni/knihy/top-bob`.
- Consumes: `/cteni/hledat` (Task 2) as the "back to search" target for every one of these pages.

- [ ] **Step 1: Move the route folders**

```bash
mkdir -p "src/app/(main)/cteni/knihy"
git mv "src/app/(main)/knihovna/[bookId]" "src/app/(main)/cteni/knihy/[bookId]"
git mv "src/app/(main)/knihovna/nova" "src/app/(main)/cteni/knihy/nova"
git mv "src/app/(main)/knihovna/rocket-model" "src/app/(main)/cteni/knihy/rocket-model"
git mv "src/app/(main)/knihovna/top-bob" "src/app/(main)/cteni/knihy/top-bob"
git rm "src/app/(main)/knihovna/page.tsx"
```

- [ ] **Step 2: Fix internal links inside the moved book-detail page**

`src/app/(main)/cteni/knihy/[bookId]/page.tsx:66` — change:
```tsx
<Link href="/hledat">
```
to:
```tsx
<Link href="/cteni/hledat">
```

- [ ] **Step 3: Fix internal links inside the moved admin-actions component**

`src/app/(main)/cteni/knihy/[bookId]/admin-actions.tsx:55` — change:
```tsx
router.push("/knihovna");
```
to:
```tsx
router.push("/cteni/hledat");
```
(The book was just deleted, so this goes straight to the search hub — matching what `/knihovna` used to redirect to, now that the dead redirect page is gone.)

`src/app/(main)/cteni/knihy/[bookId]/admin-actions.tsx:94` — change:
```tsx
<Link href={`/knihovna/${bookId}/upravit`} className="flex items-center gap-2">
```
to:
```tsx
<Link href={`/cteni/knihy/${bookId}/upravit`} className="flex items-center gap-2">
```

- [ ] **Step 4: Fix internal links inside the moved pujcit (borrow) page**

`src/app/(main)/cteni/knihy/[bookId]/pujcit/page.tsx:46` — change:
```tsx
href={`/knihovna/${book.id}`}
```
to:
```tsx
href={`/cteni/knihy/${book.id}`}
```

- [ ] **Step 5: Fix internal links inside the moved upravit (edit) page**

`src/app/(main)/cteni/knihy/[bookId]/upravit/page.tsx:26` — change:
```tsx
if (profile?.role !== 'coach' && profile?.role !== 'admin') redirect(`/knihovna/${bookId}`);
```
to:
```tsx
if (profile?.role !== 'coach' && profile?.role !== 'admin') redirect(`/cteni/knihy/${bookId}`);
```

`src/app/(main)/cteni/knihy/[bookId]/upravit/page.tsx:31` — change:
```tsx
<Link href={`/knihovna/${bookId}`}>
```
to:
```tsx
<Link href={`/cteni/knihy/${bookId}`}>
```

- [ ] **Step 6: Fix internal links inside the moved nova (add book) page**

`src/app/(main)/cteni/knihy/nova/page.tsx:11` — change:
```tsx
<Link href="/hledat">
```
to:
```tsx
<Link href="/cteni/hledat">
```

- [ ] **Step 7: Fix internal links inside the moved rocket-model page**

`src/app/(main)/cteni/knihy/rocket-model/page.tsx:18` — change:
```tsx
<Link href="/hledat">
```
to:
```tsx
<Link href="/cteni/hledat">
```

`src/app/(main)/cteni/knihy/rocket-model/page.tsx:48` — change:
```tsx
href={`/knihovna/${book.id}`}
```
to:
```tsx
href={`/cteni/knihy/${book.id}`}
```

`src/app/(main)/cteni/knihy/rocket-model/page.tsx:64` — change:
```tsx
<Link href={`/knihovna/${book.id}`} className="flex items-center gap-1.5">
```
to:
```tsx
<Link href={`/cteni/knihy/${book.id}`} className="flex items-center gap-1.5">
```

- [ ] **Step 8: Fix internal links inside the moved top-bob page**

`src/app/(main)/cteni/knihy/top-bob/page.tsx:24` — change:
```tsx
<Link href="/hledat">
```
to:
```tsx
<Link href="/cteni/hledat">
```

- [ ] **Step 9: Fix external consumers that link to a book detail page**

`src/components/books/coach-book-row.tsx:69` — change:
```tsx
href={`/knihovna/${book.id}`}
```
to:
```tsx
href={`/cteni/knihy/${book.id}`}
```

`src/components/books/add-book-wizard.tsx:72` — change:
```tsx
router.push(`/knihovna/${json.existingId}`);
```
to:
```tsx
router.push(`/cteni/knihy/${json.existingId}`);
```

`src/components/books/add-book-wizard.tsx:76` — change:
```tsx
router.push(`/knihovna/${json.data.id}`);
```
to:
```tsx
router.push(`/cteni/knihy/${json.data.id}`);
```

`src/components/books/add-book-wizard.tsx:107` — change:
```tsx
<Card key={book.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(`/knihovna/${book.id}`)}>
```
to:
```tsx
<Card key={book.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(`/cteni/knihy/${book.id}`)}>
```

`src/components/books/add-book-wizard.tsx:170` — change:
```tsx
<Button size="sm" variant="outline" onClick={() => router.push(`/knihovna/${existing.id}`)}>
```
to:
```tsx
<Button size="sm" variant="outline" onClick={() => router.push(`/cteni/knihy/${existing.id}`)}>
```

`src/components/books/top-bob-browser.tsx:48` — change:
```tsx
href={`/knihovna/${book.id}`}
```
to:
```tsx
href={`/cteni/knihy/${book.id}`}
```

`src/components/books/top-bob-browser.tsx:64` — change:
```tsx
<Link href={`/knihovna/${book.id}`} className="flex items-center gap-1.5">
```
to:
```tsx
<Link href={`/cteni/knihy/${book.id}`} className="flex items-center gap-1.5">
```

`src/components/books/book-row-header.tsx:55` — change:
```tsx
href={`/knihovna/${book.id}`}
```
to:
```tsx
href={`/cteni/knihy/${book.id}`}
```

`src/components/books/book-edit-form.tsx:47` — change:
```tsx
router.push(`/knihovna/${book.id}`);
```
to:
```tsx
router.push(`/cteni/knihy/${book.id}`);
```

`src/components/books/book-delete-button.tsx:37` — change:
```tsx
router.push('/knihovna');
```
to:
```tsx
router.push('/cteni/hledat');
```
(Same reasoning as admin-actions.tsx Step 3 — the book is gone, so go to the search hub directly.)

`src/components/books/book-card.tsx:20` — change:
```tsx
<Link href={`/knihovna/${book.id}`} className="focus-ring shrink-0 w-10 h-14 rounded-md overflow-hidden bg-muted flex items-center justify-center">
```
to:
```tsx
<Link href={`/cteni/knihy/${book.id}`} className="focus-ring shrink-0 w-10 h-14 rounded-md overflow-hidden bg-muted flex items-center justify-center">
```

`src/components/books/book-card.tsx:35` — change:
```tsx
<Link href={`/knihovna/${book.id}`} className="flex items-center gap-1.5">
```
to:
```tsx
<Link href={`/cteni/knihy/${book.id}`} className="flex items-center gap-1.5">
```

`src/components/search/search-page-client.tsx:278` — change:
```tsx
href="/knihovna/top-bob"
```
to:
```tsx
href="/cteni/knihy/top-bob"
```

`src/components/search/search-page-client.tsx:302` — change:
```tsx
href="/knihovna/rocket-model"
```
to:
```tsx
href="/cteni/knihy/rocket-model"
```

`src/components/search/search-page-client.tsx:480` — change:
```tsx
href={`/knihovna/${book.id}`}
```
to:
```tsx
href={`/cteni/knihy/${book.id}`}
```

`src/components/search/search-page-client.tsx:490` — change:
```tsx
<Link href={`/knihovna/${book.id}`}>
```
to:
```tsx
<Link href={`/cteni/knihy/${book.id}`}>
```

`src/components/search/search-page-client.tsx:602` — change:
```tsx
href={`/knihovna/${book.id}`}
```
to:
```tsx
href={`/cteni/knihy/${book.id}`}
```

`src/app/(main)/eseje/[essayId]/page.tsx:133` — change:
```tsx
<Link href={`/knihovna/${essay.book.id}`} className="group block mb-8">
```
to:
```tsx
<Link href={`/cteni/knihy/${essay.book.id}`} className="group block mb-8">
```

- [ ] **Step 10: Verify no stale `/knihovna` references remain**

Run: `grep -rn '"/knihovna' src/ ; grep -rn '\`/knihovna' src/`
Expected: no output (all occurrences updated; the `/knihovna/moje` and `/knihovna/import` cases are handled separately in Tasks 6–7).

- [ ] **Step 11: Typecheck and test**

Run: `pnpm typecheck && pnpm test`
Expected: both PASS.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor: move book routes to /cteni/knihy, delete dead /knihovna redirect"
```

---

### Task 4: Move essay routes to `/cteni/eseje/*`

**Files:**
- Move: `src/app/(main)/eseje/[essayId]/page.tsx` → `src/app/(main)/cteni/eseje/[essayId]/page.tsx`
- Move: `src/app/(main)/eseje/[essayId]/upravit/page.tsx` → `src/app/(main)/cteni/eseje/[essayId]/upravit/page.tsx`
- Move: `src/app/(main)/eseje/ke-kontrole/page.tsx` → `src/app/(main)/cteni/eseje/ke-kontrole/page.tsx`
- Move: `src/app/(main)/eseje/nova/page.tsx` → `src/app/(main)/cteni/eseje/nova/page.tsx`
- Modify: `src/app/api/portfolio/generate/route.ts:68`
- Modify: `src/app/(main)/komunita/profil/[id]/page.tsx:187,195,237,241`
- Modify: `src/components/essays/essay-editor-form.tsx:82`
- Modify: `src/components/essays/coach-review-list.tsx:100`
- Modify: `src/components/essays/prehled-tabs.tsx:36,48`
- Modify: `src/components/essays/my-essay-list.tsx:47`
- Modify: `src/components/essays/essay-card.tsx:22`
- Modify: `src/components/books/book-essays-list.tsx:32`
- Modify: `src/components/dashboard/coach-review-card.tsx:37,56`
- Modify: `src/components/search/search-page-client.tsx:316,639`
- Modify: `src/components/dashboard/quick-actions.tsx:15,27`
- Modify: `src/lib/notifications/essay-notifications.ts:44`
- Modify: `src/lib/notifications/essay-notifications.test.ts:107,174,241`
- Modify: `src/lib/notifications/email-templates.test.ts:7,16,25,40`

**Interfaces:**
- Produces: routes `/cteni/eseje/[essayId]`, `/cteni/eseje/[essayId]/upravit`, `/cteni/eseje/ke-kontrole`, `/cteni/eseje/nova`.

- [ ] **Step 1: Move the route folders**

```bash
mkdir -p "src/app/(main)/cteni/eseje"
git mv "src/app/(main)/eseje/[essayId]" "src/app/(main)/cteni/eseje/[essayId]"
git mv "src/app/(main)/eseje/ke-kontrole" "src/app/(main)/cteni/eseje/ke-kontrole"
git mv "src/app/(main)/eseje/nova" "src/app/(main)/cteni/eseje/nova"
```

- [ ] **Step 2: Fix internal links inside the moved essay detail page**

`src/app/(main)/cteni/eseje/[essayId]/page.tsx:77` — change:
```tsx
<Link href={`/eseje/${essayId}/upravit`}>
```
to:
```tsx
<Link href={`/cteni/eseje/${essayId}/upravit`}>
```

- [ ] **Step 3: Fix internal links inside the moved essay edit page**

`src/app/(main)/cteni/eseje/[essayId]/upravit/page.tsx:24` — change:
```tsx
if (essay.author_profile_id !== profile?.id) redirect(`/eseje/${essayId}`);
```
to:
```tsx
if (essay.author_profile_id !== profile?.id) redirect(`/cteni/eseje/${essayId}`);
```

`src/app/(main)/cteni/eseje/[essayId]/upravit/page.tsx:29` — change:
```tsx
<Link href={`/eseje/${essayId}`}>
```
to:
```tsx
<Link href={`/cteni/eseje/${essayId}`}>
```

- [ ] **Step 4: Fix the portfolio export essay URL builder**

`src/app/api/portfolio/generate/route.ts:68` — change:
```tsx
essayUrl: `${origin}/eseje/${essay.id}`,
```
to:
```tsx
essayUrl: `${origin}/cteni/eseje/${essay.id}`,
```

- [ ] **Step 5: Fix essay links on the community profile page**

`src/app/(main)/komunita/profil/[id]/page.tsx:187` — change:
```tsx
<Link href={`/eseje/${essay.id}`} className="focus-ring shrink-0 w-11 h-15 ...">
```
to (keep the rest of the attributes exactly as they are, only the `href` value changes):
```tsx
<Link href={`/cteni/eseje/${essay.id}`} className="focus-ring shrink-0 w-11 h-15 ...">
```

`src/app/(main)/komunita/profil/[id]/page.tsx:195` — change:
```tsx
<Link href={`/eseje/${essay.id}`} className="focus-ring flex min-w-0 items-center gap-1.5 rounded-sm">
```
to:
```tsx
<Link href={`/cteni/eseje/${essay.id}`} className="focus-ring flex min-w-0 items-center gap-1.5 rounded-sm">
```

`src/app/(main)/komunita/profil/[id]/page.tsx:237` — change:
```tsx
<Link href={`/eseje/${essay.id}`} className="focus-ring shrink-0 w-11 h-15 rounded-md overflow-hidden bg-warning/10 flex items-center justify-center mt-0.5">
```
to:
```tsx
<Link href={`/cteni/eseje/${essay.id}`} className="focus-ring shrink-0 w-11 h-15 rounded-md overflow-hidden bg-warning/10 flex items-center justify-center mt-0.5">
```

`src/app/(main)/komunita/profil/[id]/page.tsx:241` — change:
```tsx
<Link href={`/eseje/${essay.id}`} className="focus-ring flex min-w-0 items-center gap-1.5 rounded-sm">
```
to:
```tsx
<Link href={`/cteni/eseje/${essay.id}`} className="focus-ring flex min-w-0 items-center gap-1.5 rounded-sm">
```
(Note: lines 187 and 195 use identical `className` attributes to lines 237 and 241 respectively in this file — when editing, use surrounding line numbers/context to target the correct occurrence, or edit all four in one pass since all get the same `href` substitution.)

- [ ] **Step 6: Fix the essay editor's post-save redirect**

`src/components/essays/essay-editor-form.tsx:82` — change:
```tsx
router.push(`/eseje/${data.id}`);
```
to:
```tsx
router.push(`/cteni/eseje/${data.id}`);
```

- [ ] **Step 7: Fix the coach review list's essay links**

`src/components/essays/coach-review-list.tsx:100` — change:
```tsx
<Link href={`/eseje/${essay.id}`} className="group flex-1 min-w-0 space-y-2">
```
to:
```tsx
<Link href={`/cteni/eseje/${essay.id}`} className="group flex-1 min-w-0 space-y-2">
```

- [ ] **Step 8: Fix the "write new essay" links on the Přehled tabs**

`src/components/essays/prehled-tabs.tsx:36` — change:
```tsx
<Link href="/eseje/nova">
```
to:
```tsx
<Link href="/cteni/eseje/nova">
```

`src/components/essays/prehled-tabs.tsx:48` — change:
```tsx
<Link href="/eseje/nova">Napsat esej</Link>
```
to:
```tsx
<Link href="/cteni/eseje/nova">Napsat esej</Link>
```

- [ ] **Step 9: Fix remaining essay-list link components**

`src/components/essays/my-essay-list.tsx:47` — change:
```tsx
href={`/eseje/${essay.id}`}
```
to:
```tsx
href={`/cteni/eseje/${essay.id}`}
```

`src/components/essays/essay-card.tsx:22` — change:
```tsx
<Link href={`/eseje/${essay.id}`} className="group block h-full">
```
to:
```tsx
<Link href={`/cteni/eseje/${essay.id}`} className="group block h-full">
```

`src/components/books/book-essays-list.tsx:32` — change:
```tsx
href={`/eseje/${essay.id}`}
```
to:
```tsx
href={`/cteni/eseje/${essay.id}`}
```

- [ ] **Step 10: Fix the dashboard coach-review card**

`src/components/dashboard/coach-review-card.tsx:37` — change:
```tsx
href="/eseje/ke-kontrole"
```
to:
```tsx
href="/cteni/eseje/ke-kontrole"
```

`src/components/dashboard/coach-review-card.tsx:56` — change:
```tsx
<Link href={`/eseje/${essay.id}`} className="group block">
```
to:
```tsx
<Link href={`/cteni/eseje/${essay.id}`} className="group block">
```

- [ ] **Step 11: Fix search page essay links**

`src/components/search/search-page-client.tsx:316` — change:
```tsx
<Link href={`/eseje/${essay.id}`} className="flex gap-2.5">
```
to:
```tsx
<Link href={`/cteni/eseje/${essay.id}`} className="flex gap-2.5">
```

`src/components/search/search-page-client.tsx:639` — change:
```tsx
href={`/eseje/${essay.id}`}
```
to:
```tsx
href={`/cteni/eseje/${essay.id}`}
```

- [ ] **Step 12: Fix the dashboard quick actions**

`src/components/dashboard/quick-actions.tsx:15` — change:
```tsx
<Link href="/eseje/ke-kontrole">
```
to:
```tsx
<Link href="/cteni/eseje/ke-kontrole">
```

`src/components/dashboard/quick-actions.tsx:27` — change:
```tsx
<Link href="/eseje/nova">
```
to:
```tsx
<Link href="/cteni/eseje/nova">
```

- [ ] **Step 13: Fix the essay-notification email URL builder and its tests**

`src/lib/notifications/essay-notifications.ts:44` — change:
```tsx
essayUrl: `${params.origin}/eseje/${essay.id}`,
```
to:
```tsx
essayUrl: `${params.origin}/cteni/eseje/${essay.id}`,
```

`src/lib/notifications/essay-notifications.test.ts:107,174,241` — each of these three lines currently reads:
```tsx
expect(call.html).toContain('https://tappka.app/eseje/essay-1');
```
change every one of the three occurrences to:
```tsx
expect(call.html).toContain('https://tappka.app/cteni/eseje/essay-1');
```

`src/lib/notifications/email-templates.test.ts:7` — change:
```tsx
essayUrl: 'https://tappka.app/eseje/essay-1',
```
to:
```tsx
essayUrl: 'https://tappka.app/cteni/eseje/essay-1',
```

`src/lib/notifications/email-templates.test.ts:16,25,40` — each of these three lines currently reads:
```tsx
expect(html).toContain('https://tappka.app/eseje/essay-1');
```
change every one of the three occurrences to:
```tsx
expect(html).toContain('https://tappka.app/cteni/eseje/essay-1');
```

- [ ] **Step 14: Verify no stale `/eseje` references remain**

Run: `grep -rn '"/eseje' src/ ; grep -rn '\`/eseje' src/ ; grep -rn "'https://tappka.app/eseje" src/`
Expected: no output.

- [ ] **Step 15: Typecheck and test**

Run: `pnpm typecheck && pnpm test`
Expected: both PASS.

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "refactor: move essay routes to /cteni/eseje"
```

---

### Task 5: Move `/settings/kniha-knih` → `/cteni/sprava`

**Files:**
- Move: `src/app/(main)/settings/kniha-knih/page.tsx` → `src/app/(main)/cteni/sprava/page.tsx`

**Interfaces:**
- Produces: the route `/cteni/sprava`, still rendering `CoachDashboard` with the same props as before. Task 6 adds the Import tab and the "Přidat knihu" link to this same file.

- [ ] **Step 1: Move the route folder and rename the component for clarity**

```bash
git mv "src/app/(main)/settings/kniha-knih" "src/app/(main)/cteni/sprava"
```

In `src/app/(main)/cteni/sprava/page.tsx:8`, change:
```tsx
export default async function KnihaKnihSettingsPage() {
```
to:
```tsx
export default async function SpravaKnihovnyPage() {
```

- [ ] **Step 2: Typecheck and test**

Run: `pnpm typecheck && pnpm test`
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: move /settings/kniha-knih to /cteni/sprava"
```

---

### Task 6: Fold Import into Sprava as a tab; wire up "Přidat knihu"; delete `/knihovna/import`

**Files:**
- Modify: `src/components/books/coach-dashboard.tsx`
- Modify: `src/app/(main)/cteni/sprava/page.tsx`
- Delete: `src/app/(main)/knihovna/import/page.tsx`

**Interfaces:**
- Consumes: `LibraryImportScanner` from `@/components/library/library-import-scanner` (no props — confirmed by its signature `export function LibraryImportScanner()`).
- Consumes: `/cteni/knihy/nova` (Task 3) as the target of the new "Přidat knihu" link.
- Produces: an `import` tab inside `CoachDashboard`, and a "Přidat knihu" link on the Sprava page — nothing outside this task depends on these.

- [ ] **Step 1: Add the Import tab to CoachDashboard**

In `src/components/books/coach-dashboard.tsx`, add the import alongside the other component imports near the top (after line 13, `import { RocketModelManager } from './rocket-model-manager';`):
```tsx
import { LibraryImportScanner } from '@/components/library/library-import-scanner';
```

Add a new tab trigger to the `TabsList` (after the `rocket-model` trigger, i.e. after line 315's closing `</TabsTrigger>`, before the `</TabsList>` on line 316):
```tsx
        <TabsTrigger value="import" className="gap-2">
          Import
        </TabsTrigger>
```

Add a new tab content block (after the `rocket-model` `TabsContent` block, i.e. after line 422's closing `</TabsContent>`, before the closing `</Tabs>` on line 423):
```tsx

      <TabsContent value="import" className="mt-4">
        <LibraryImportScanner />
      </TabsContent>
```

- [ ] **Step 2: Add the "Přidat knihu" entry point to the Sprava page**

In `src/app/(main)/cteni/sprava/page.tsx`, add the `Link` and `Button` imports (after the existing `PageShell` import):
```tsx
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
```

Change the header block from:
```tsx
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Správa knihovny</h1>
        <p className="text-muted-foreground text-sm">Zařaď knihy do seznamů a spravuj výběr knih.</p>
      </div>
```
to:
```tsx
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Správa knihovny</h1>
          <p className="text-muted-foreground text-sm">Zařaď knihy do seznamů a spravuj výběr knih.</p>
        </div>
        <Button asChild size="sm" className="gap-2 shrink-0">
          <Link href="/cteni/knihy/nova">
            <Plus className="size-4" />
            Přidat knihu
          </Link>
        </Button>
      </div>
```

- [ ] **Step 3: Delete the standalone Import route**

```bash
git rm -r "src/app/(main)/knihovna/import"
```

- [ ] **Step 4: Typecheck and test**

Run: `pnpm typecheck && pnpm test`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: fold Import into Sprava as a tab, wire up Add Book entry point"
```

---

### Task 7: Fold Moje výpůjčky into Přehled as a tab; delete `/knihovna/moje`

**Files:**
- Modify: `src/components/essays/prehled-tabs.tsx`
- Modify: `src/app/(main)/cteni/prehled/page.tsx`
- Modify: `src/components/library/borrow-panel.tsx:95`
- Modify: `src/lib/notifications/library-notifications.ts:37`
- Modify: `src/lib/notifications/library-notifications.test.ts:45`
- Modify: `src/lib/notifications/email-templates.test.ts:48,59`
- Delete: `src/app/(main)/knihovna/moje/page.tsx`

**Interfaces:**
- Consumes: `MyLoansList` from `@/components/library/my-loans-list` (no props — confirmed by its usage as `<MyLoansList />` in the page being deleted).
- Produces: a `vypujcky` tab value on `PrehledTabs`, and `/cteni/prehled?tab=vypujcky` as the canonical deep link — Task 8's sidebar update and this task's own notification-link fix both target this value.

- [ ] **Step 1: Add the Výpůjčky tab to PrehledTabs**

In `src/components/essays/prehled-tabs.tsx`, add the import (after line 9, `import type { EssayWithDetails } from '@/lib/essays/types';`):
```tsx
import { MyLoansList } from '@/components/library/my-loans-list';
```

Add a new tab trigger to the `TabsList` (change lines 24–27 from):
```tsx
      <TabsList>
        <TabsTrigger value="moje">Moje</TabsTrigger>
        <TabsTrigger value="tym">Tým</TabsTrigger>
      </TabsList>
```
to:
```tsx
      <TabsList>
        <TabsTrigger value="moje">Moje</TabsTrigger>
        <TabsTrigger value="tym">Tým</TabsTrigger>
        <TabsTrigger value="vypujcky">Výpůjčky</TabsTrigger>
      </TabsList>
```

Add a new tab content block (after the `tym` `TabsContent` block closes on line 71, before the closing `</Tabs>` on line 72):
```tsx

      {/* Výpůjčky tab */}
      <TabsContent value="vypujcky" className="mt-6">
        <MyLoansList />
      </TabsContent>
```

- [ ] **Step 2: Extend the Přehled page's defaultTab logic**

In `src/app/(main)/cteni/prehled/page.tsx:30`, change:
```tsx
const defaultTab = tab === 'moje' || tab === 'tym' ? tab : 'moje';
```
to:
```tsx
const defaultTab = tab === 'moje' || tab === 'tym' || tab === 'vypujcky' ? tab : 'moje';
```

- [ ] **Step 3: Point the borrow panel's "my loans" link at the new tab**

`src/components/library/borrow-panel.tsx:95` — change:
```tsx
<Link href="/knihovna/moje" className="text-sm font-medium text-primary hover:underline">
```
to:
```tsx
<Link href="/cteni/prehled?tab=vypujcky" className="text-sm font-medium text-primary hover:underline">
```

- [ ] **Step 4: Point the loan-notification email link at the new tab**

`src/lib/notifications/library-notifications.ts:37` — change:
```tsx
loansUrl: `${params.origin}/knihovna/moje`,
```
to:
```tsx
loansUrl: `${params.origin}/cteni/prehled?tab=vypujcky`,
```

- [ ] **Step 5: Update the notification tests to match**

`src/lib/notifications/library-notifications.test.ts:45` — change:
```tsx
expect(call.html).toContain('https://tappka.app/knihovna/moje');
```
to:
```tsx
expect(call.html).toContain('https://tappka.app/cteni/prehled?tab=vypujcky');
```

`src/lib/notifications/email-templates.test.ts:48` — change:
```tsx
loansUrl: 'https://tappka.app/knihovna/moje',
```
to:
```tsx
loansUrl: 'https://tappka.app/cteni/prehled?tab=vypujcky',
```

`src/lib/notifications/email-templates.test.ts:59` — change:
```tsx
expect(html).toContain('https://tappka.app/knihovna/moje');
```
to:
```tsx
expect(html).toContain('https://tappka.app/cteni/prehled?tab=vypujcky');
```

- [ ] **Step 6: Delete the standalone Moje výpůjčky route**

```bash
git rm -r "src/app/(main)/knihovna/moje"
```

- [ ] **Step 7: Verify no stale `/knihovna` references remain anywhere**

Run: `grep -rn '"/knihovna' src/ ; grep -rn '\`/knihovna' src/ ; grep -rn "'https://tappka.app/knihovna" src/`
Expected: no output — this confirms Tasks 3, 6, and 7 together eliminated every `/knihovna/*` reference in the codebase.

- [ ] **Step 8: Typecheck and test**

Run: `pnpm typecheck && pnpm test`
Expected: both PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: fold Moje výpůjčky into Přehled as a tab"
```

---

### Task 8: Update the sidebar for the new hierarchy and reduced item count

**Files:**
- Modify: `src/components/app-sidebar.tsx:100-101,150-160`

**Interfaces:**
- Consumes: `/cteni/prehled` (Task 1), `/cteni/hledat` (Task 2), `/cteni/eseje/ke-kontrole` (Task 4), `/cteni/sprava` (Task 5).

- [ ] **Step 1: Update the "Čtení" root nav item's URL**

`src/components/app-sidebar.tsx:100-102` — change:
```tsx
        {
          title: "Čtení",
          url: "/prehled",
          icon: BookOpen,
        },
```
to:
```tsx
        {
          title: "Čtení",
          url: "/cteni/prehled",
          icon: BookOpen,
        },
```

- [ ] **Step 2: Simplify the active-state matcher to a single prefix check**

`src/components/app-sidebar.tsx:150` — change:
```tsx
  const isCteniActive = pathname === "/prehled" || pathname === "/hledat" || pathname === "/knihovna/moje" || pathname.startsWith("/eseje") || pathname.startsWith("/knihovna") || pathname.startsWith("/settings/kniha-knih")
```
to:
```tsx
  const isCteniActive = pathname.startsWith("/cteni")
```

- [ ] **Step 3: Replace the 6-item sub-menu with the 4-item version**

`src/components/app-sidebar.tsx:151-161` — change:
```tsx
  const cteniSubItems = [
    { title: "Přehled", url: "/prehled" },
    { title: "Hledat", url: "/hledat" },
    { title: "Moje výpůjčky", url: "/knihovna/moje" },
    ...(isCoachOrAdmin
      ? [
        { title: "Ke kontrole", url: "/eseje/ke-kontrole", badge: reviewCount },
        { title: "Import", url: "/knihovna/import" },
        { title: "Nastavení", url: "/settings/kniha-knih" },
      ]
      : []),
  ]
```
to:
```tsx
  const cteniSubItems = [
    { title: "Přehled", url: "/cteni/prehled" },
    { title: "Hledat", url: "/cteni/hledat" },
    ...(isCoachOrAdmin
      ? [
        { title: "Ke kontrole", url: "/cteni/eseje/ke-kontrole", badge: reviewCount },
        { title: "Správa knihovny", url: "/cteni/sprava" },
      ]
      : []),
  ]
```

- [ ] **Step 4: Verify no stale sidebar references remain**

Run: `grep -n '"/prehled"\|"/hledat"\|"/knihovna\|"/eseje\|"/settings/kniha-knih"' src/components/app-sidebar.tsx`
Expected: no output.

- [ ] **Step 5: Typecheck and test**

Run: `pnpm typecheck && pnpm test`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: update sidebar for unified /cteni hierarchy, drop to 4 items"
```

---

### Task 9: Rewrite the E2E reading spec for the new hierarchy

**Files:**
- Modify: `tests/e2e/reading.spec.ts` (full rewrite)

**Interfaces:**
- Consumes: `/cteni/prehled`, `/cteni/hledat`, `/cteni/knihy/nova`, `/cteni/knihy/[bookId]`, `/cteni/eseje/nova`, `/cteni/eseje/[essayId]`, `/cteni/eseje/[essayId]/upravit` (all prior tasks). The dead `/knihovna` redirect no longer exists, so its two test cases are removed rather than repointed.

- [ ] **Step 1: Replace the full file contents**

Replace the entire contents of `tests/e2e/reading.spec.ts` with:

```tsx
import { expect, test } from "@playwright/test";
import {
  cleanupTestData,
  getSetupSessionCookie,
  seedBook,
  seedEssay,
  setAuthCookie,
} from "./fixtures/auth";

test.describe("reading feature - unauthenticated", () => {
  test("cteni/prehled redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/cteni/prehled");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("cteni/eseje/nova redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/cteni/eseje/nova");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("cteni/hledat redirects to login when not authenticated", async ({ page }) => {
    const response = await page.goto("/cteni/hledat");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe("reading feature - authenticated", () => {
  let cookieValue: string;

  test.beforeAll(async () => {
    const { cookie } = await getSetupSessionCookie();
    cookieValue = cookie;
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookieValue);
  });

  test("cteni/prehled page loads for authenticated user", async ({ page }) => {
    const response = await page.goto("/cteni/prehled");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });

  test("cteni/eseje/nova page loads for authenticated user", async ({ page }) => {
    const response = await page.goto("/cteni/eseje/nova");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });

  test("cteni/hledat page loads for authenticated user", async ({ page }) => {
    const response = await page.goto("/cteni/hledat");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("reading navigation - arrow back", () => {
  let cookieValue: string;
  let bookId: string;
  let essayId: string;

  test.beforeAll(async () => {
    const {
      cookie,
      profileId: pid,
    } = await getSetupSessionCookie();
    cookieValue = cookie;

    const { bookId: bid } = await seedBook(pid);
    bookId = bid;

    const { essayId: eid } = await seedEssay(pid, bid);
    essayId = eid;
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context, cookieValue);
  });

  test("cteni/knihy/nova - Zpět do hledání navigates to /cteni/hledat", async ({ page }) => {
    await page.goto("/cteni/knihy/nova");
    await expect(page.getByRole("link", { name: /zpět/i })).toBeVisible();
    await page.getByRole("link", { name: /zpět/i }).click();
    await expect(page).toHaveURL(/\/cteni\/hledat/);
  });

  test("cteni/knihy/[bookId] - Zpět do hledání navigates to /cteni/hledat", async ({ page }) => {
    await page.goto(`/cteni/knihy/${bookId}`);
    await expect(page.getByRole("link", { name: /zpět/i })).toBeVisible();
    await page.getByRole("link", { name: /zpět/i }).click();
    await expect(page).toHaveURL(/\/cteni\/hledat/);
  });

  test("cteni/eseje/nova - Zpět (router.back) navigates back", async ({ page }) => {
    await page.goto("/cteni/hledat");
    const response = await page.goto("/cteni/eseje/nova");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=Zpět").first()).toBeVisible({ timeout: 10000 });
    await page.locator("text=Zpět").first().click();
    await expect(page).toHaveURL(/\/cteni\/hledat/);
  });

  test("cteni/eseje/[essayId] - Zpět (router.back) navigates back", async ({ page }) => {
    await page.goto("/cteni/hledat");
    const response = await page.goto(`/cteni/eseje/${essayId}`);
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("text=Zpět").first()).toBeVisible({ timeout: 10000 });
    await page.locator("text=Zpět").first().click();
    await expect(page).toHaveURL(/\/cteni\/hledat/);
  });

  test("cteni/eseje/[essayId]/upravit - Zpět na esej navigates to essay", async ({ page }) => {
    await page.goto(`/cteni/eseje/${essayId}/upravit`);
    await expect(page.getByRole("link", { name: /zpět/i })).toBeVisible();
    await page.getByRole("link", { name: /zpět/i }).click();
    await expect(page).toHaveURL(new RegExp(`/cteni/eseje/${essayId}$`));
  });
});

test.afterAll(async () => {
  await cleanupTestData();
});
```

- [ ] **Step 2: Run the E2E reading spec**

Run: `pnpm test:e2e -- reading.spec.ts`
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: rewrite reading E2E spec for /cteni hierarchy"
```

---

### Task 10: Full-repo verification pass

**Files:** none (verification only).

- [ ] **Step 1: Confirm zero remaining references to any old path across the whole repo**

Run:
```bash
grep -rn '"/prehled\|`/prehled\|"/hledat\|`/hledat\|"/knihovna\|`/knihovna\|"/eseje\|`/eseje\|"/settings/kniha-knih\|https://tappka.app/eseje\|https://tappka.app/knihovna' src/ tests/
```
Expected: no output. If anything appears, it is a missed call site — fix it using the same old→new substitution pattern as the task covering that route family, then re-run this grep.

- [ ] **Step 2: Full verification suite**

Run: `pnpm typecheck && pnpm test && pnpm test:e2e`
Expected: all PASS.

- [ ] **Step 3: Manual smoke check**

Start the dev server (`pnpm dev`) and click through, as both a regular member and a coach/admin test account:
- Sidebar shows exactly 2 items under "Čtení" for a regular member (Přehled, Hledat), 4 for coach/admin (adds Ke kontrole, Správa knihovny).
- `/cteni/prehled` shows three tabs: Moje, Tým, Výpůjčky — the Výpůjčky tab renders the loan list.
- `/cteni/hledat` loads and its "Rocket Model" / "TOP BOB" teaser cards link to `/cteni/knihy/rocket-model` and `/cteni/knihy/top-bob`, and its book/essay result cards link to `/cteni/knihy/[bookId]` and `/cteni/eseje/[essayId]`.
- `/cteni/sprava` (coach/admin) shows a "Přidat knihu" button linking to `/cteni/knihy/nova`, and an "Import" tab rendering the ISBN scanner.
- No step in the flow above 404s.

- [ ] **Step 4: No commit needed for this task** — it is verification-only; if Step 1 or 2 surfaces a fix, commit that fix using the same message convention as the task it belongs to.
