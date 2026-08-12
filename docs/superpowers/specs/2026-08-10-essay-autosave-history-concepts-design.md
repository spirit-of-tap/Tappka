# Eseje: autosave, historie verzí, koncepty

**Date:** 2026-08-10
**Status:** Approved design
**Touches:** `src/app/(main)/cteni/eseje/**`, `src/components/essays/**`, `src/lib/essays/**`, `src/app/api/essays/**`, `db/schema/essays.ts`

## Problem

The essay editor (`src/components/essays/essay-editor-form.tsx`) has a stub autosave: a
5-second debounce that fires only on body changes, with no status feedback, no error
handling, and no retry. Title and book selection are never autosaved. Every fire inserts a
new `essay_revisions` row, so leaving it running would turn the revision table into noise.

Three gaps follow from that:

1. **Autosave** — authors can lose work, and have no signal about whether their work is safe.
2. **Historie** — `essay_revisions` has recorded every version since day one, and nothing in
   the UI ever shows it.
3. **Koncepty** — there is no way to start an essay and finish it later. `POST /api/essays`
   publishes immediately, so an unfinished thought is either public or lost.

## Decisions

| Question | Decision |
| --- | --- |
| What is a koncept? | An unpublished essay: `essays.published_at IS NULL`. Editing an already-published essay keeps today's behaviour — saves go live immediately. |
| What does historie do? | View only, author only. No restore, no diff. |
| Which autosaves become history entries? | Session checkpoints: an autosave updates the newest revision while it is fresh, otherwise cuts a new one. |
| Where do koncepty appear? | A "Koncepty" group above published essays in the existing *Moje eseje* view. No new route. |
| When is a koncept row created? | On the first non-empty title or body on `/cteni/eseje/nova`. |

## Data model

**No new tables and no new columns.** A koncept is `essays.published_at IS NULL`.

### RLS changes (`db/schema/essays.ts`)

Three policy edits. All are no-ops against existing data, because `POST /api/essays` sets
`published_at = now()` today and therefore no draft rows exist in production.

**1. `essays` SELECT** — currently `using (true)`.

```sql
using (
  published_at is not null
  or author_profile_id = current_profile_id()
  or is_admin()
)
```

**2. `essay_revisions` SELECT** — currently `using (true)`. Without this, draft *content*
leaks even when the parent essay row is hidden.

```sql
using (exists (
  select 1 from essays e
  where e.id = essay_revisions.essay_id
    and (e.published_at is not null
         or e.author_profile_id = current_profile_id()
         or is_admin())
))
```

The app's `.not('published_at','is',null)` filters are a convenience, not a boundary. These
two policies are the boundary, and drafts are unsafe to ship without them.

**3. `essay_revisions` UPDATE** — currently `using (false)`, replaced by a bounded window:

```sql
using (
  created_by_profile_id = current_profile_id()
  and created_at > now() - interval '30 minutes'
)
with check (created_by_profile_id = current_profile_id())
```

The window is on `created_at`, not `updated_at`, so it is a hard cap: one revision absorbs at
most 30 minutes of edits before a new one is cut. A three-hour writing session produces about
six history entries — not one, and not four hundred. The route additionally requires the
target to be the highest `revision_no` for that essay; RLS is the security boundary, the route
is the precision.

### Empty titles

`essay_revisions.title` is `NOT NULL`, but `''` is legal. Drafts store `''` and render as
"Bez názvu". Title validation moves from *always required* to *required at publish*.

### Verified as needing no change

- `books_with_essay_count` (`db/schema/views.ts`) already filters `published_at IS NOT NULL`.
- Essay email notifications are purely reactive (vote, comment, coach read). A draft has none
  of those, so it cannot trigger mail.
- `getUserBookPointsStats` and `getTeamBookPointsStats` already filter on published, so drafts
  award no points.

## API surface

### `POST /api/essays` — always creates a koncept

`published_at: null`, revision 1, title may be `''`. Content validation relaxed to match. The
editor form is the only caller (verified by grep), so no other consumer changes.

### `PATCH /api/essays/[id]` — autosave target

Accepts any subset of `title`, `content_json`, `content_text`, `book_id`.

Revision handling: load the highest `revision_no` for the essay; if
`shouldCoalesceRevision()` says yes, `UPDATE` that row, otherwise `INSERT` at `revision_no + 1`.

Title is required only when the essay is already published.

**Response shape changes** to `{ data: { revision_no, updated_at } }`. Today the route ends
with a `getEssayById()` carrying six embedded selects — votes, views, comments, author, book,
highlight category — and the autosave path discards all of it. At a 2-second debounce that
waste is the dominant cost of the feature.

### `POST /api/essays/[id]/publish` — new

Author only. Requires a non-empty title and non-empty content text. Sets
`published_at = now()` when it is null; a no-op returning the essay when it is not. Returns the
full `EssayWithDetails`, since the client navigates to the detail page right after.

### `GET /api/essays/[id]/revisions` — new, author only

Returns the 50 most recent revisions as
`{ revision_no, title, created_at, updated_at, word_count, snippet }`. `word_count` and
`snippet` are derived server-side from `content_json` via the existing
`contentTextFromJson()`, so the list payload stays small.

### `GET /api/essays/[id]/revisions/[revisionNo]` — new, author only

Full `content_json` for one revision, fetched when the author opens a preview.

History is fetched over HTTP rather than server-rendered into the page: the list changes with
every autosave, so a value rendered at page load would be stale by the time anyone opens it.

## Library code

### `src/lib/essays/revisions.ts` — new

```ts
export const REVISION_COALESCE_WINDOW_MINUTES = 30;

export function shouldCoalesceRevision(
  latest: { revision_no: number; created_at: string; created_by_profile_id: string } | null,
  profileId: string,
  nowIso: string,
): boolean;
```

A pure function, so the boundary behaviour is unit-testable without a database.

### `src/lib/essays/queries.ts`

- `getEssayRevisions(supabase, essayId, limit)` — new.
- `EssayFilters` gains `status?: 'draft' | 'published'`, defaulting to `'published'`. Every
  existing caller keeps its current behaviour; the Koncepty group passes `'draft'`.

### `src/lib/essays/use-autosave.ts` — new

Holds the whole state machine so the form stays mostly presentational.

- States: `idle | saving | saved | error`.
- 2-second debounce after the last change, plus a forced flush every 20 seconds of continuous
  typing so a fast typist is never more than 20 seconds from durable.
- Single-flight: at most one request in flight; the latest payload is queued and sent when it
  lands. Prevents out-of-order writes.
- Flush on `visibilitychange → hidden` using `fetch(..., { keepalive: true })`, which survives
  the tab going away (unlike a bare `fetch`, and unlike `sendBeacon`, which cannot `PATCH`).
- `beforeunload` guard while dirty or errored.
- Three retries with backoff, then the `error` state with a manual "Zkusit znovu".
- Returns `{ status, lastSavedAt, save, flush, retry }`.

## UI

### `essay-editor-form.tsx`

- Title and book selection feed autosave alongside the body. Today only the body does, so
  renaming an essay and closing the tab silently loses the rename.
- **Draft creation on `/nova`:** the first change where title or body is non-empty fires a
  one-shot `POST`, guarded by a ref. On success the URL becomes `/cteni/eseje/<id>/upravit`
  via `window.history.replaceState`. Next.js supports the native History API in the App
  Router and keeps `usePathname`/`useSearchParams` synced, so the component never remounts —
  which matters, because `router.replace` would tear down Tiptap and drop the cursor
  mid-sentence.
- **Primary action** is "Zveřejnit" for a koncept (flush autosave, call publish, `router.push`
  to the detail page) and "Uložit změny" for a published essay (flush, navigate).
- **Status line** under the title: "Ukládám…" / "Uloženo 14:32" / "Neuloženo — zkusit znovu".

### `essay-history-sheet.tsx` — new

A `Sheet` (already in `src/components/ui/`) opened from the editor header. Fetches on open, so
it is always current. Each row shows relative time, word count, and a snippet; clicking opens a
`Dialog` with a read-only `TiptapRenderer`. View only — no restore, no diff.

### Koncepty in *Moje eseje*

`MyEssayList` gains a `drafts` group rendered above the published list, with a count, a
"Koncept" badge, and "upraveno před …". Draft rows link to `/upravit`, not the detail page.

### Draft detail page

`/cteni/eseje/[id]` redirects the author to `/upravit` when `published_at` is null.
Non-authors already get `notFound()` from the tightened SELECT policy.

### Incidental cleanup

`upravit/page.tsx` uses a raw `container mx-auto …` wrapper and an inline `<Link>` back
button, while `nova/page.tsx` uses `PageShell size="narrow"` and `<BackButton />`. The two
render the same form and should look the same; align `upravit` to the `nova` shell.

## Testing

| Layer | File | Covers |
| --- | --- | --- |
| Unit | `src/lib/essays/revisions.test.ts` | `shouldCoalesceRevision` at window boundaries, different author, no prior revision |
| Component | `src/components/essays/essay-editor-form.test.tsx` | Debounce, single-flight ordering, status transitions, error + retry, draft POST fires exactly once |
| Component | `src/components/essays/my-essay-list.test.tsx` | Draft grouping, "Bez názvu", link target |
| Integration | `tests/integration/essay-drafts.int.test.ts` | Non-author cannot select a draft essay or its revisions; author can; author can update own revision inside the window and not outside; cannot update another author's |
| E2E | `tests/e2e/essay-autosave.spec.ts` | Type on `/nova` → URL swaps → reload → text survives → publish → appears in *Moje eseje* |

The integration layer is where the RLS changes earn their keep: PostgREST is not reachable from
the bare test container, so route-level behaviour belongs to E2E, but policy behaviour is
exactly what `asClaims()` exists to exercise.

## Migration

The schema edits are `db/schema/essays.ts` only. After editing, prompt for `pnpm db:migrate`
and review the generated SQL for drops before applying — replacing policies generates
`DROP POLICY` statements, which is expected here, but the diff should contain nothing else.
Commit the schema edit and the migration together.

## Out of scope

- Multi-tab conflict resolution / optimistic concurrency. Single-author editing makes
  simultaneous tabs rare; last write wins.
- Restoring a version from history, and diffing two versions.
- Unpublishing a published essay back to koncept.
- Offline queueing beyond the in-memory retry.
