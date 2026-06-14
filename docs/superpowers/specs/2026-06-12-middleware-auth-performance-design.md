# Middleware Auth Performance — Design

*2026-06-12. Approved by Ondřej. Goal: eliminate the per-request auth waterfall (9–11 sequential Supabase round trips per page view) without breaking session refresh, onboarding, or route protection.*

## Problem

Every request through `proxy.ts` → `lib/supabase/proxy.ts:updateSession` pays, sequentially:

1. `getClaims()` — JWT check (network round trip if the project uses the legacy HS256 secret).
2. `getUser()` — always a network call to Supabase Auth (used only for the email-identity check).
3. `hasLinkedProfile()` → `getCurrentUserProfile()` — two sequential DB queries (`users` by `auth_user_id`, then `profiles` by `user_id`).

Then `app/(main)/layout.tsx` repeats `getUser()` + both queries via `getCurrentUserProfile()`, plus `getCoachUnreadCount`. Most pages (e.g. `app/(main)/page.tsx:51`) call `getCurrentUserProfile()` a third time. API routes pay the middleware cost *and* run their own `getUser()` + profile queries — the search page fires two such API calls per debounced keystroke.

## Verified facts the design relies on

Checked against current Supabase docs (2026-06-12), not training data:

- The official Next.js 16 proxy pattern uses **only `getClaims()`** — it refreshes expired sessions by itself. `getUser()` is not required in middleware.
- `getClaims()` verifies **locally (no network)** only when the project uses asymmetric JWT signing keys (ES256/RS256). On legacy HS256 it falls back to a network `getUser()` call.
- `app_metadata.providers` (e.g. `["google", "email"]`) **is present in JWT claims**, so the email-identity check needs no `getUser()`.
- Claim staleness at the two moments the gates flip is already handled by existing code: `components/verify-email-form.tsx:288` calls `refreshSession()` after the email identity is added; `lib/hooks/use-profile-link-realtime.ts:72` calls it when an admin links the profile (same in `use-email-verification-realtime.ts`).
- All 29 `app/api/**/route.ts` handlers authenticate themselves (`getUser()` → 401). Middleware gating is not load-bearing for API security.
- `profiles_user_id_fkey` (profiles.user_id → users.id) exists and is indexed (`profiles_user_id_idx`), so the two-step users→profiles lookup can be a single PostgREST embedded query.
- Cookie handling rules in the official sample must be preserved verbatim (return `supabaseResponse` as-is; never run code between `createServerClient` and `getClaims()`).

## Behavior contract (must not change)

1. Session cookies are refreshed on every matched request.
2. Unauthenticated user on a protected route → `/auth/login?next=<full path>`.
3. Authenticated user without an email identity → `/auth/onboarding?next=<full path>` (wizard).
4. Authenticated user without a linked profile → `/auth/onboarding?next=<full path>` (waiting screen).
5. Authenticated user on `/auth/login` → redirected to `next`/default, with `getUser()` validation to avoid the deleted-user infinite redirect loop (existing comment at `lib/supabase/proxy.ts:70`).
6. Public routes (`/auth/*` per `PUBLIC_ROUTE_PREFIXES`) pass through.

## Design

### Part 0 — Prerequisite (manual, dashboard)

Confirm the **production** Supabase project uses asymmetric JWT signing keys (Dashboard → Project Settings → JWT Keys); migrate from the legacy secret if needed (documented zero-downtime flow). Without this, `getClaims()` still makes a network call and Part 1's win shrinks to "removed duplicate calls". Also verify the Vercel function region matches the Supabase project region. The local stack may stay on HS256 — dev is not the optimization target.

### Part 1 — Claims-only middleware

In `lib/supabase/proxy.ts`:

- Keep `createServerClient` setup, cookie rules, and `getClaims()` exactly as the official pattern requires.
- Auth gate (contract 2): from claims, unchanged.
- Email-identity gate (contract 3): replace the `getUser()` + `hasEmailIdentity()` call with `claims.app_metadata?.providers?.includes("email")`. Zero network.
- Profile gate (contract 4): **removed from middleware** — moves to the `(main)` layout (Part 2).
- Login bounce (contract 5): unchanged, keeps its `getUser()` — it only runs for `/auth/login` requests, off the hot path, and it is the loop protection.
- Stamp the full request path (`pathname + search`) into a request header (`x-pathname`) so the layout can build `?next=` for its onboarding redirect.
- While in the file: adopt the @supabase/ssr 0.8 `setAll(cookies, headers)` second argument (cache headers preventing CDN caching of authed responses), per the current official sample.

### Part 2 — One cached profile fetch; gate in the layout

- Refactor `getCurrentUserProfile()` (`lib/auth-helpers.ts`) internals, signature unchanged:
  - Derive the auth user id from `getClaims()` (local) instead of `getUser()` (network) when no preloaded user is given.
  - Collapse the two queries into one: `profiles.select("*, team:teams(*), users!inner(auth_user_id)").eq("users.auth_user_id", uid)`. The `users!inner` embed enforces the same "linked users record must exist" semantics as the current two-step lookup. Strip the embedded `users` object before returning; keep the existing `includeTeam` handling.
- Add a request-scoped wrapper in `lib/auth-helpers.ts` (or new `lib/auth/session.ts`): `getSessionProfile = React.cache(async () => getCurrentUserProfile(await createClient(), { includeTeam: true }))`. Layout and pages call this; React `cache()` dedupes within a request.
- `app/(main)/layout.tsx` becomes the profile gate: `if (!profile) redirect("/auth/onboarding?next=" + <x-pathname>)`. Pages that already redirect on null profile keep working; their duplicate fetches become cache hits.
- API routes keep their current call sites — they benefit automatically from the refactored helper (one query, no `getUser()` network call).

### Net effect

| Request type | Before | After |
|---|---|---|
| Page view (auth overhead) | 9–11 sequential round trips | local JWT verify + 1 DB query |
| API call (middleware overhead) | 3–4 round trips | local JWT verify |

## Accepted behavior changes

1. **Revocation latency:** a deleted/banned user's existing access token works until expiry (`jwt_expiry = 3600`, ≤1 h) instead of being rejected on the next request. Standard Supabase tradeoff; lower `jwt_expiry` if tighter revocation is wanted. The `removed_access` application-level checks are unaffected.
2. **Claim freshness:** email-identity and profile gates now read JWT-claim/DB state that refreshes via the existing `refreshSession()` calls; cross-device transitions are covered by the realtime hooks.
3. Out of scope, noted: unauthenticated `/api` requests still get a 302 to login (existing behavior); `/r/[code]`'s "public" `/rezervace/[code]` target is still blocked by the auth gate (pre-existing, unchanged).

## Test plan

Manual flows on local stack (data is precious — no resets):

1. Existing user: login → navigate dashboard/search/reservations → logout.
2. New OAuth-only user: Google sign-in → onboarding wizard appears; protected deep link redirects to onboarding with `next` preserved.
3. Email verification: OTP flow → waiting-for-approval screen; admin links profile → realtime hook refreshes → user enters app, lands on `next`.
4. Session refresh: temporarily set local `jwt_expiry = 60`; wait past expiry; navigate — user stays logged in (refresh-through-middleware works); revert.
5. API: logged-out `fetch('/api/essays')` behavior unchanged; logged-in search works.
6. Login bounce: visiting `/auth/login` while logged in redirects in; no redirect loop.

Measure TTFB (curl `time_starttransfer`) on `/` and `/hledat` before/after, locally and on the Vercel preview.
