# Performance Findings — Why Production Pages Feel Slow

*2026-06-12 — analysis only, no changes applied. Symptom: all pages slow in production, first load worst. Hosting: Vercel.*

## TL;DR

Every authenticated page view pays **6–8 sequential round trips to Supabase before page-specific data even starts loading**, because the middleware and the main layout each independently re-verify the user and re-fetch the profile. Nothing is cached anywhere in the app. First loads additionally ship Tiptap (~3 MB), Recharts, and ExcelJS in the bundle without dynamic imports.

Estimated impact if fixed: with a 100–200 ms round trip to Supabase (typical for cross-region), the auth waterfall alone adds 600 ms–1.5 s of TTFB to *every* navigation.

## Finding 1 — Per-request auth waterfall (biggest win)

On every page view, **the middleware** (`proxy.ts` → `lib/supabase/proxy.ts:updateSession`) runs sequentially:

1. `getClaims()` — local JWT verification, cheap.
2. `getUser()` (`lib/supabase/proxy.ts:106`) — network round trip to Supabase Auth.
3. `hasLinkedProfile()` (`lib/supabase/proxy.ts:139`) → `getCurrentUserProfile()` — two more sequential DB queries (public.users record, then profile).

Then **the layout** (`app/(main)/layout.tsx`) repeats the work:

4. `getCurrentUserProfile(supabase)` — calls `getUser()` **again** (no preloaded user passed) plus the same two profile queries again.
5. `getCoachUnreadCount` for coaches/admins — sequential after the profile fetch.

Only after all of this does the page run its own queries.

**Fix direction:** middleware keeps only `getClaims()` for routing; the email-identity and linked-profile checks move out of the hot path (verify once at login/onboarding, or stamp `has_profile` into the JWT `app_metadata` so claims carry it). Layout passes the user through and runs its remaining queries in `Promise.all`. Use React `cache()` so `getCurrentUserProfile` is computed once per request no matter how many components call it.

## Finding 2 — Zero caching

No `revalidatePath`, `revalidateTag`, `unstable_cache`, or ISR anywhere. Leaderboards, categories, popular essays, and team stats (`get_best_books_per_category`, `get_teams_with_member_stats` RPCs) are recomputed on every request even though they change slowly.

**Fix direction:** wrap slow-changing reads in `unstable_cache` with 5–60 min revalidation, or tag-based invalidation on write.

## Finding 3 — First-load bundle weight

No dynamic imports detected. Shipped eagerly:

- Tiptap (8 packages, ~3 MB min) — only needed on essay editing.
- Recharts — only needed where charts render.
- ExcelJS + XLSX — only needed on portfolio export.
- 40+ Radix UI components.

**Fix direction:** `next/dynamic` for the editor, charts, and export code paths.

## Finding 4 — Region check (free, do first)

Hosted on Vercel. If the Vercel function region doesn't match the Supabase project region, every one of the round trips above gets 100–200 ms more expensive — a multiplier on Finding 1.

**Check:** Vercel dashboard → Project → Settings → Functions → region, vs. Supabase dashboard → Project Settings → General → region. They should be the same or adjacent (e.g. `fra1` ↔ `eu-central-1`). If mismatched, set the Vercel region — one-line fix, immediate win.

## Finding 5 — Page-level issues (smaller, per-page)

- **/komunita** loads *all* profiles and teams, filters client-side (`app/(main)/komunita/page.tsx`). Needs pagination or server-side filtering as the user base grows.
- **/hledat** (`components/search/search-page-client.tsx`, 520 lines) fires two separate client fetches per keystroke (essays + books) after a 350 ms debounce, no request dedup.
- Possibly missing FK indexes on `essays.author_profile_id` and `essays.book_id` (referenced in migration notes around `20260419`); reservation tables are well-indexed.

## What's already good

Server components by default, `Promise.all` for page queries, explicit column selection (no `select *`), trigram indexes for book search, indexed reservation queries.

## Suggested order of attack

| # | Action | Effort | Expected win |
|---|--------|--------|--------------|
| 1 | Verify/fix Vercel ↔ Supabase region | minutes | Large if mismatched |
| 2 | Finding 1 — remove auth waterfall | ~half day | 400 ms–1.5 s off every navigation |
| 3 | Finding 2 — cache slow-changing data | ~half day | Faster data-heavy pages, less DB load |
| 4 | Finding 3 — dynamic imports | hours | Faster first load |
| 5 | Finding 5 — per-page fixes | as needed | Targeted |

Measure before/after: Vercel Analytics (TTFB per route) or `curl -w "%{time_starttransfer}"` against production, plus `next build` output for bundle sizes.
