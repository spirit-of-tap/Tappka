# Transferring the legacy essay import from local to preview and production

## Problem

The legacy SharePoint essay import was run against the **local** Supabase instance
via `scripts/essayimport/*.ts`. Getting it correct required manual, unrecorded
fixes applied directly to the local database and storage. The import scripts are
therefore **not** a reproducible path to the same result — re-running them against
another environment would reproduce the raw import, not the corrected state.

The local database is now the source of truth. That corrected state must reach the
**preview** branch (`wykcqwmrxvgoomltrrlo`, `preview.tiimi.cz`) and later
**production**, without disturbing data those environments already own.

## Source and target state

Measured 2026-07-26.

| Table | Local | Preview | Action |
| --- | --- | --- | --- |
| `teams` | 15 | 15, **identical UUIDs and names** | skip entirely |
| `users` | 1 | 2 | never transfer |
| `profiles` | 193 | 3 | remap 3, insert 190 |
| `books` | 618 | 0 | insert |
| `tags` | 8 | 0 | insert |
| `book_tags` | 616 | 0 | insert |
| `essays` | 6595 | 0 | insert |
| `essay_revisions` | 6595 | 0 | insert |
| `essay_comments` | 220 | 0 | insert |
| storage `images` | 1746 objects, 1145 MB | 666 of 667 top-level folders present | verify, fill gaps |

Excluded as local development noise, confirmed by the user: `reservations` (10),
`rooms` (6), `essay_views` (7), `essay_votes` (1), `dashboard_layouts` (1).

Preview storage is already almost fully populated by earlier partial runs of the
untracked `scripts/transfer-to-preview.ts`, so the storage step is predominantly a
resume, not a fresh 1.1 GB upload.

## Transport: PostgREST, not Postgres

Direct Postgres access to preview is **unavailable from the development machine**:

- `db.wykcqwmrxvgoomltrrlo.supabase.co` publishes only an `AAAA` record
  (`2a05:d019:…`); the IPv4 add-on is not enabled.
- The machine has no IPv6 route (`route -n get -inet6 default` → not in table) and
  cannot even resolve IPv6-only names.
- The Supabase shared pooler has no tenant for this ref in any EU region — all ten
  probed hosts answer `FATAL: (ENOTFOUND) tenant/user postgres.wykcqwmrxvgoomltrrlo
  not found`. No dedicated pooler exists either
  (`wykcqwmrxvgoomltrrlo.pooler.supabase.com` does not resolve).

So the transfer runs over **PostgREST plus the Storage API** using the service-role
key. This forfeits a single wrapping transaction; idempotency and verification
compensate (see below). Storage bytes could never have moved over Postgres anyway —
`storage.objects` holds only metadata.

## Correctness requirements

These are the constraints that make a naive copy wrong. Each is a hard requirement
on the implementation.

### R1 — Preserve `created_at` and `updated_at`

Essays span **2019-10-23 to 2026-07-23 across 1400 distinct days**. The essay feed
orders on `essays_created_desc_idx` (`created_at DESC`). The existing untracked
scripts discard both columns on every insert
(`const { created_at, updated_at, ...insert } = row`), which would collapse all 6595
essays to the moment of transfer and destroy seven years of chronology.
Both columns must be written explicitly from the source rows.

### R2 — Remap colliding profiles by `work_email`

The colliding unique constraint is `profiles_work_email_key`, not the primary key.
Exactly three local profiles collide with existing preview profiles:

| `work_email` | local id | target id | roles |
| --- | --- | --- | --- |
| `xkulo007@studenti.czu.cz` | `d2be22a5-28b3-416b-b39a-156bf7bf1aeb` | `cef56f02-90a4-4f46-8ff4-595975c76791` | preview `admin`, local `student` |
| `xprot040@studenti.czu.cz` | `457d2243-8215-4f33-8510-c2b7829fdc3b` | `ef3f6001-f1f7-4464-8d0f-01b3ffc89bd6` | preview `admin`, local `student` |
| `xscho008@studenti.czu.cz` | `c67686e6-d0e9-45a0-8967-c27d3095919f` | `02ac1206-17e3-489c-8802-515eb7bbcb7f` | both `student` |

The mapping must be **derived at runtime from `work_email`**, never hardcoded as a
UUID list. The target ids above are documentation of the current preview state, not
input to the script — production will differ.

Together these three author 47 essays and 5 comments. Every FK referencing
`profiles.id` must be rewritten through the map: `essays.author_profile_id`,
`essays.pinned_by_profile_id`, `essays.created_by_profile_id`,
`essays.updated_by_profile_id`, `essay_revisions.created_by_profile_id`,
`essay_revisions.updated_by_profile_id`, `essay_comments.author_profile_id`,
`essay_comments.created_by_profile_id`, `essay_comments.updated_by_profile_id`,
`books.created_by_profile_id`, `books.updated_by_profile_id`,
`books.status_changed_by_profile_id`, `profiles.access_removed_by_profile_id`,
`profiles.created_by_profile_id`, `profiles.updated_by_profile_id`. For
non-colliding profiles the map is the identity function.

### R3 — Never overwrite existing target profiles, except `team_id`

Preview profiles are real accounts bound to real `auth.users`. Two of the three are
`admin` where local says `student`; copying local values would demote them. The
earlier script deleted every preview profile outside a hardcoded allowlist — that
must not recur, and would be destructive on production.

The single approved exception: the three colliding preview profiles have
`team_id = NULL`, while locally Kulhavý and Schlossar have teams (Protiva has none).
The script **sets `team_id` only**, from local, on those existing rows. `role`,
`name`, `user_id`, and every other column are left untouched — including the
accent difference in `name` (`Ondrej Kulhavy` in preview vs `Ondřej Kulhavý` locally).

### R4 — Audit columns need no remapping

All 6595 essays, 6595 revisions, and 220 comments carry
`created_by_profile_id = updated_by_profile_id = f06ccaea-2556-4a1d-badb-de879ac936dc`,
a synthetic `System` profile (`admin@studenti.czu.cz`, role `admin`). It does not
exist in preview and is not a collision, so it inserts as an ordinary new profile
and its id survives unchanged. It must be inserted **before** any row referencing
it, because those FKs are `ON DELETE RESTRICT` and `NOT NULL`.

### R5 — Rewrite only local storage URLs in `content_json`

Image references live in `essay_revisions.content_json` as TipTap `attrs.src`
values. Of the distinct srcs:

- **1745** begin with `http://127.0.0.1:54321/storage/v1/object/public/images` and
  must be prefix-replaced with the target's equivalent.
- **67** are external `https://` URLs (Google, Notion S3, Wikipedia, …) and must be
  left byte-identical.
- **11** are junk (`/forpsi-errors/images/*.gif`, `blob:https://tiimiakatemia.cz/…`)
  and must also be left byte-identical. They are already broken in the source; the
  transfer is not the place to fix them.

Replacement is an exact-prefix substitution, not a regex over the whole document,
so unrelated content cannot be corrupted.

### R6 — Sync storage from local storage, not from disk

The image bytes come from the **local Supabase storage bucket**, which reflects the
manual fixes. `scripts/essayimport/Downloaded_Images` holds 1794 files against 1746
storage objects, and object paths do not reconstruct reliably from filenames — for
example `essay-images/import/test/1002_Image_399.jpeg` has an extra path segment.
Reading from storage removes that guesswork.

Note the off-by-one: local storage holds **1746** objects but revisions reference
**1745** distinct local srcs, and local has 667 top-level import folders against
preview's 666. The sync is driven by *referenced* srcs, so an unreferenced object is
correctly never uploaded. The `HEAD`-then-upload check settles each referenced object
individually, so neither count needs to be reconciled up front — but verification
must compare *referenced* URLs, not raw object counts, or it will report a spurious
mismatch.

### R7 — `user_id` is always `NULL` for inserted profiles

`profiles.user_id` references `users.id`, which is environment-specific and bound to
`auth.users`. Inserted profiles get `NULL`. (Locally only Kulhavý's profile has a
`user_id`, and that profile is a collision, so it is never inserted.)

## Architecture

A single script, `scripts/transfer-essays.ts`, with the target selected by
`--target=preview|production`, so production reuses the same code path rather than a
copied file. Credentials come from the gitignored `.env.transfer.local`.

Units, each independently testable:

| Unit | Responsibility | Depends on |
| --- | --- | --- |
| `config` | Resolve target URL + service key + storage prefixes from env and `--target` | env |
| `source` | Read local rows and storage objects | local Postgres / Storage API |
| `target` | Read/upsert target rows via PostgREST | service key |
| `profile-map` | Build `work_email → target id`; expose `remap(id)` | `source`, `target` |
| `content-rewrite` | Prefix-replace srcs in one `content_json`; pure | none |
| `storage-sync` | Ensure one object exists in target, uploading if absent | `source`, `target` |
| `verify` | Post-run assertions | `source`, `target` |

`content-rewrite` and `profile-map` are pure given their inputs, which is where the
correctness risk concentrates — so those get unit tests.

## Execution order

FK dependencies dictate the order. `created_by_profile_id` FKs are `ON DELETE
RESTRICT` and `NOT NULL`, so referenced profiles must exist first.

1. **Preflight (read-only).** Build the profile map. Assert every local `team_id`
   exists in the target with an identical id, and abort otherwise — teams are never
   inserted. Assert the essay tables are empty unless `--resume`. Print the plan.
   `--dry-run` stops here.
2. **Profiles.** Insert the 190 non-colliding (including `System`), `user_id` NULL,
   timestamps preserved, profile FKs remapped. Then `PATCH` `team_id` on the 3
   colliding target rows.
3. **Books**, then **tags**, then **book_tags**.
4. **Storage sync.** For each of the 1745 distinct local srcs, derive the object
   path, `HEAD` the target, and upload from local storage only when missing or
   size-mismatched. Concurrency 8, `x-upsert: true`.
5. **Essays**, then **essay_revisions** (with `content_json` rewritten), then
   **essay_comments**.
6. **Verification.**

## Failure handling

Without a wrapping transaction, safety comes from three properties:

- **Idempotency.** Every row carries an explicit primary key from the source, so all
  writes are upserts (`Prefer: resolution=merge-duplicates`, with
  `on_conflict=essay_id,revision_no` for `essay_revisions`, whose PK is composite).
  An interrupted run is resumed by re-running, never duplicating.
- **Ordered, fail-fast stages.** A stage that reports any error stops the run before
  the next stage, so a failure cannot cascade into rows referencing missing FKs. The
  earlier scripts silently swallowed per-row errors (`if (text.includes("23505"))
  return false` and a bare `catch {}`) and reported success regardless; error counts
  must be fatal, not cosmetic.
- **Scoped rollback.** `--rollback` deletes only what the transfer inserted — rows
  whose ids came from the source set, plus objects under `essay-images/import/` —
  and never touches pre-existing target profiles or teams.

## Verification

Run automatically at the end, and each assertion fails the run:

1. Row count per table equals the local count (accounting for the 3 skipped
   profiles: target `profiles` = local 193, since the 3 collisions already exist).
2. **Zero** occurrences of `127.0.0.1` anywhere in target `essay_revisions.content_json`.
3. The 3 colliding target profiles still hold their original `role` and `user_id`,
   and now have the expected `team_id`.
4. Target `teams` still has exactly 15 rows with unchanged ids.
5. A sample of rewritten image URLs returns HTTP 200 from target storage.
6. Spot-check chronology: min/max `essays.created_at` in target equals local
   (`2019-10-23` / `2026-07-23`) — the direct guard on R1.

## Testing

Per `CLAUDE.md`, pure logic is unit-tested next to the source:

- `scripts/transfer-essays.test.ts` (or colocated per final module layout) covering
  `content-rewrite` — local prefix replaced, external `https://` untouched, junk
  (`/forpsi-errors/…`, `blob:…`) untouched, multiple srcs in one document, no src at
  all — and `profile-map` — collision maps to target id, non-collision is identity,
  unknown id is an error rather than a silent pass-through.

Integration and E2E layers are not applicable: this is a one-off operational script
against live remote environments, not application code paths.

## Production

Production runs the same script with `--target=production` once preview is verified
and reviewed. Its profile and team state must be re-inspected first — the collision
set will differ, and the preflight team assertion is what stops a mismatched run.
Nothing about production is hardcoded.

## Out of scope

- Fixing the 11 pre-existing broken image srcs.
- Migrating the 67 externally hosted images into Supabase storage.
- Transferring `users`, `reservations`, `rooms`, `essay_views`, `essay_votes`,
  `dashboard_layouts`.
- Any schema change. This is a data transfer; `supabase/migrations/` is untouched.
