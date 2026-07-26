# Essay data transfer (local → preview → production)

How to copy the legacy SharePoint essay import from the local Supabase database to
another environment.

## Why this script exists

The legacy import was run against the **local** database with
`scripts/essayimport/*.ts`, and getting it right required manual, unrecorded fixes
applied directly to the local database and storage. Re-running those import scripts
against another environment would reproduce the *raw* import, not the corrected
state. The local database is therefore the source of truth, and this script copies
it forward.

Design detail and the reasoning behind each invariant:
`docs/superpowers/specs/2026-07-26-essay-data-transfer-design.md`.

## Required environment variables

All credentials live in `.env.transfer.local`, which is gitignored via `.env**` and
**must never be committed**. Delete it once the transfer is done.

```
LOCAL_SUPABASE_URL=http://127.0.0.1:54321
LOCAL_SERVICE_ROLE_KEY=<local service_role key>

PREVIEW_SUPABASE_URL=https://<preview-ref>.supabase.co
PREVIEW_SERVICE_ROLE_KEY=<preview service_role key>

PRODUCTION_SUPABASE_URL=https://<production-ref>.supabase.co
PRODUCTION_SERVICE_ROLE_KEY=<production service_role key>
```

Service-role keys come from Supabase Dashboard → Project Settings → API Keys →
`service_role` (secret).

## Commands

```bash
pnpm transfer:essays:dry                       # preview, read-only, prints the plan
pnpm transfer:essays --target=preview          # run against preview
pnpm transfer:essays --target=preview --resume # continue an interrupted run
pnpm transfer:essays --target=preview --rollback

# production requires the explicit confirmation flag
pnpm transfer:essays --target=production --i-know-this-is-production
```

Always run `pnpm transfer:essays:dry` first and read the plan.

## Preconditions

- Local Supabase must be running (`pnpm dev`, or `pnpm supabase start`).
- Teams are resolved automatically: matched on id, else on **normalized name**
  (case- and whitespace-insensitive), and any source team with no counterpart is
  **created** with its source id. Profile `team_id` is remapped through that map, so
  a dangling team FK is impossible. Two target teams sharing a normalized name abort
  the run as ambiguous.
- The target's essay tables should be empty. If they are not, the run aborts and
  tells you to pass `--resume` or `--rollback`.

## What it never touches

- Existing `teams` — matched, never modified. Only genuinely missing teams are
  created.
- `users` — environment-specific and bound to `auth.users`.
- **Existing target profiles, except an empty `team_id`.** `role`, `user_id`, `name`
  and everything else are never modified, and `team_id` is only ever *filled* when
  the target has none — never overwritten. This matters: production has 96 profiles
  already placed in its own teams, and 6 accounts (2 `admin`, 4 `coach`) that local
  calls `student`; a blind copy would both reshuffle teams and demote real admins.
- `reservations`, `rooms`, `essay_views`, `essay_votes`, `dashboard_layouts` — local
  development noise, not part of the import.
- Target storage on `--rollback`. Object paths are deterministic and orphaned
  objects are harmless, so rollback leaves them in place.

## Expected numbers for preview

Measured 2026-07-26. Use these to spot drift.

| Table | Source | Notes |
| --- | --- | --- |
| `profiles` | 193 | 190 inserted, 3 reused by `work_email` |
| `books` | 618 | |
| `tags` | 8 | |
| `book_tags` | 616 | |
| `essays` | 6595 | |
| `essay_revisions` | 6595 | |
| `essay_comments` | 220 | |
| storage | 1745 referenced objects | 1746 exist locally; one is unreferenced and is never uploaded |

The three reused profiles are `xkulo007@studenti.czu.cz`,
`xprot040@studenti.czu.cz` and `xscho008@studenti.czu.cz`. Two of them are `admin`
in preview and `student` locally.

## Production, as transferred 2026-07-26

| | Value |
| --- | --- |
| profiles | 94 inserted, 99 reused, 4 target-only untouched → 197 total |
| teams | 6 matched by name, 9 created, 0 matched by id |
| team_id filled (was NULL) | 4 |
| role / user_id / team_id changes on existing profiles | **0** |
| storage | 1745 referenced, 1210 uploaded (535 already present from an aborted first run) |

Production team ids do **not** match local. Six matched by name — including
`Timace`→`TIMACE` and `WEAM`→`Weam`, which differ only by case — and nine were
created: Aconditor, GimiTimi, InviTAP, JBS, KAAMOS, Luotapa, Teamly, Tiimeri,
koučové. Some carry `removed_at` from local and were created archived.

The profile count check expects **source + target-only**, not `source == target`:
production has 4 real staff accounts absent from the legacy import.

`urls rewritten` reports **1753**, not 1745: 1745 is the number of *distinct* image
srcs, while 1753 counts every occurrence across all revisions.

## Verification

The run ends with automatic checks, and any failure exits non-zero:

- row counts per table match the source
- `profiles` count matches the source (190 new + 3 pre-existing)
- `teams` count unchanged
- each reused profile still has its original `role` and `user_id`
- **zero** revisions still reference `127.0.0.1`
- earliest `essays.created_at` matches the source — the direct guard that the
  2019→2026 chronology survived
- a sample of rewritten image URLs returns HTTP 200 from target storage

## Troubleshooting

**Direct Postgres to preview is unreachable, by design of the environment.**
`db.<ref>.supabase.co` publishes only an AAAA record (the IPv4 add-on is not
enabled), and the shared pooler has no tenant for the preview branch ref
(`FATAL: (ENOTFOUND) tenant/user postgres.<ref> not found`). That is why the script
uses PostgREST plus the Storage API rather than a direct connection, and why there
is no single wrapping transaction. Safety comes from insert-or-skip idempotency,
fail-fast stages, and the verification pass.

**A missing storage object returns HTTP 400, not 404.** Any non-200 HEAD is treated
as "absent". Do not "fix" this to check for 404.

**Writes use `resolution=ignore-duplicates`, never `merge-duplicates`.**
`handle_updated_at` is a `BEFORE UPDATE` trigger on `profiles`, `books`, `essays`
and `essay_comments`. It does not fire on INSERT, so inserts preserve the original
timestamps — but an upsert resolving to an UPDATE would overwrite `updated_at`,
corrupting the data on exactly the resume runs idempotency exists to support.

**Transient upload failures are retried.** A first production run died with a bare
`fetch failed` after ~500 of 1745 uploads. Storage transport is now retried 4 times
with exponential backoff; HTTP error responses are deliberately *not* retried. If a
run still dies mid-upload, re-run with `--resume` — already-uploaded objects are
skipped by a size-matched HEAD.

**The run is safe to repeat.** Every row carries an explicit primary key from the
source, so re-running skips what is already there instead of duplicating it.

## Before running against production

Production is not interchangeable with preview:

- Re-inspect production's `profiles` first. The collision set **will differ** from
  preview's three, and the mapping is derived from `work_email` at runtime — no
  uuids are hardcoded anywhere.
- Confirm production's `teams` match local by id and name, or preflight will abort.
- The script refuses to run without `--i-know-this-is-production`.
- Do a `--dry-run`-equivalent read first by inspecting the printed plan, and stop if
  the reused-profile list contains anyone unexpected.
