# Middleware Auth Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut per-request auth overhead from 9–11 sequential Supabase round trips to a local JWT verify + one DB query, without changing auth behavior (spec: `docs/superpowers/specs/2026-06-12-middleware-auth-performance-design.md`).

**Architecture:** Middleware (`lib/supabase/proxy.ts`) becomes claims-only — `getClaims()` for session refresh + routing, email-identity gate read from `claims.app_metadata.providers`, profile gate removed. The profile gate moves to `app/(main)/layout.tsx` backed by a request-cached `getSessionProfile()` helper. `getCurrentUserProfile()` is refactored internally (signature unchanged) to use claims instead of `getUser()` and one joined query instead of two — all 29 API routes benefit without call-site changes.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), @supabase/ssr 0.8, supabase-js 2.91, React `cache()`.

**Verification stack:** No unit-test framework exists in this repo. Each task gates on `npx tsc --noEmit` + `pnpm lint`; Task 6 is full manual verification with the running app. **Never reset the local DB — its data is precious.**

**Branch:** `perf/middleware-auth` (already created, spec committed).

---

### Task 0: Production prerequisites (user action — not code)

These are dashboard actions only Ondřej can do; the code works either way, but the headline win needs them:

- [ ] Supabase Dashboard → Project Settings → JWT Keys: confirm asymmetric signing keys (ES256/RS256) are active. If still on the legacy HS256 secret, run the documented zero-downtime migration. Without this, `getClaims()` falls back to a network call.
- [ ] Vercel Dashboard → Project → Settings → Functions: confirm the function region matches the Supabase project region.

---

### Task 1: Refactor `getCurrentUserProfile` — claims-based uid, single joined query

**Files:**
- Modify: `lib/auth-helpers.ts:99-179` (function body only; signature and `Profile` return type unchanged)

- [ ] **Step 1: Replace the implementation**

Replace the body of `getCurrentUserProfile` (lines 99–179) with:

```ts
export async function getCurrentUserProfile(
  supabaseClient: SupabaseClient,
  options: { includeTeam?: boolean; user?: { id: string } } = {},
): Promise<Profile | null> {
  const { includeTeam = false } = options;

  // Use pre-fetched user if provided, otherwise derive the auth user id from
  // the JWT claims. getClaims() verifies locally (no network round trip) when
  // the project uses asymmetric signing keys, unlike getUser().
  let authUserId: string;
  if (options.user) {
    authUserId = options.user.id;
  } else {
    const { data, error: claimsError } = await supabaseClient.auth.getClaims();
    const sub = data?.claims?.sub;
    if (claimsError || !sub) {
      return null;
    }
    authUserId = sub;
  }

  // Single query replacing the previous users -> profiles two-step lookup.
  // The users!inner embed (via profiles_user_id_fkey) enforces the same
  // "linked users record must exist" semantics, and the explicit filter on
  // users.auth_user_id is required because profiles RLS has a permissive
  // policy that allows viewing all profiles.
  const selectQuery = includeTeam
    ? `*, team:teams(*), users!inner(auth_user_id)`
    : `*, users!inner(auth_user_id)`;

  const { data: profile, error: queryError } = await supabaseClient
    .from("profiles")
    .select(selectQuery)
    .eq("users.auth_user_id", authUserId)
    .limit(1)
    .maybeSingle();

  if (queryError) {
    console.error("Error fetching user profile:", queryError);
    return null;
  }

  if (!profile) {
    return null;
  }

  // Supabase returns foreign key relationships as objects (not arrays) for
  // many-to-one relationships
  let team: Team | null = null;
  if (includeTeam) {
    const teamData = (profile as any).team;
    if (Array.isArray(teamData)) {
      team = teamData.length > 0 ? (teamData[0] as Team) : null;
    } else if (teamData && typeof teamData === "object") {
      team = teamData as Team;
    }
  }

  // Strip the embedded users record and team before returning
  const { team: _, users: __, ...profileFields } = profile as any;

  return {
    ...profileFields,
    team,
  } as Profile;
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no new errors (pre-existing warnings unrelated to `lib/auth-helpers.ts` are acceptable).

- [ ] **Step 3: Runtime smoke check of the joined query**

The PostgREST embed can't be checked by tsc. Start the dev stack if not running (`pnpm dev` — do NOT reset the DB), log in as the existing dev user in the browser, and confirm the dashboard still shows the user's name/team in the sidebar (sidebar data comes through this function via the layout). If the sidebar shows "Uživatel" (the null fallback), the embed/filter is wrong — check the PostgREST error in the terminal (`Error fetching user profile:`).

- [ ] **Step 4: Commit**

```bash
git add lib/auth-helpers.ts
git commit -m "perf(auth): getCurrentUserProfile uses local claims and one joined query

Replaces a getUser() network round trip plus two sequential queries with a
local JWT verify and a single profiles+users!inner query. Signature is
unchanged, so all pages and API routes pick this up with no call-site edits.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Add request-cached `getSessionProfile()`

**Files:**
- Create: `lib/auth/session.ts`

- [ ] **Step 1: Create the file**

```ts
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, type Profile } from "@/lib/auth-helpers";

/**
 * Request-scoped profile fetch for server components.
 * React cache() dedupes calls within a single request, so the (main) layout
 * and any page/component can call this freely — only one query runs.
 * Always includes the team relation (the join is part of the same query).
 *
 * Server-only: lives in its own module (not auth-helpers) so client bundles
 * never import next/headers via createClient.
 */
export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  return getCurrentUserProfile(supabase, { includeTeam: true });
});
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: clean. If `Profile` is not exported as a type-only import target, adjust to `import type { Profile } from "@/lib/auth-helpers"` plus a value import for the function.

- [ ] **Step 3: Commit**

```bash
git add lib/auth/session.ts
git commit -m "feat(auth): request-cached getSessionProfile helper

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Claims-only middleware

**Files:**
- Modify: `lib/supabase/proxy.ts` (full rewrite of `updateSession`; `safeCheck` and the `hasEmailIdentity`/`hasLinkedProfile` imports are removed)

- [ ] **Step 1: Rewrite `lib/supabase/proxy.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicRoute, DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { redirectWithCookies } from "@/lib/auth-helpers";
import { validateRedirectUrl } from "@/lib/utils";

export async function updateSession(request: NextRequest) {
  // Expose the requested path to server components (the (main) layout uses it
  // to preserve ?next= on its onboarding redirect).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-pathname",
    request.nextUrl.pathname + request.nextUrl.search,
  );

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers?: Headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          // @supabase/ssr 0.8+ passes cache headers (Cache-Control: no-store
          // etc.) that must reach the response so CDNs never cache a page
          // that just set auth cookies.
          headers?.forEach((value, key) =>
            supabaseResponse.headers.set(key, value)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and supabase.auth.getClaims().
  // getClaims() refreshes an expired session and, with asymmetric signing
  // keys, verifies the JWT locally — no network round trip. Removing it
  // breaks session refresh ("users may be randomly logged out").
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const pathname = request.nextUrl.pathname;
  // Include full path with query parameters and hash for next parameter
  const fullPath = pathname + request.nextUrl.search + request.nextUrl.hash;

  // Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    // Handle authenticated users visiting login page - redirect them.
    // getUser() (a network call) is intentionally kept on this rare path:
    // getClaims() can be truthy for a deleted user until the token expires,
    // and redirecting such a user into the app and back here would loop.
    if (pathname === "/auth/login" && claims) {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (!error && user) {
        const next = request.nextUrl.searchParams.get("next");
        const origin = request.nextUrl.origin;
        const validatedNext = next ? validateRedirectUrl(next, origin) : null;
        const redirectTo = validatedNext ?? DEFAULT_LOGGED_IN_PAGE;

        const url = request.nextUrl.clone();
        url.pathname = redirectTo;
        url.search = "";
        url.hash = "";
        return redirectWithCookies(url, supabaseResponse);
      }
    }
    return supabaseResponse;
  }

  // Redirect to login if not authenticated
  if (!claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    url.hash = "";
    url.searchParams.set("next", fullPath);
    return redirectWithCookies(url, supabaseResponse);
  }

  // Users who signed in via OAuth only (no verified CZU email identity) go to
  // the onboarding wizard. app_metadata.providers is baked into the JWT, so
  // this needs no getUser() round trip. The claim is refreshed the moment it
  // matters: verify-email-form calls refreshSession() right after the email
  // identity is added.
  const providers: string[] =
    (claims.app_metadata as { providers?: string[] } | undefined)?.providers ??
    [];
  if (!providers.includes("email")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/onboarding";
    url.search = "";
    url.hash = "";
    url.searchParams.set("next", fullPath);
    return redirectWithCookies(url, supabaseResponse);
  }

  // The linked-profile gate lives in app/(main)/layout.tsx, which already
  // fetches the profile for the sidebar — no extra queries here.

  return supabaseResponse;
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: clean. **Known fallback:** if tsc rejects the two-parameter `setAll` callback (installed @supabase/ssr types may declare it single-parameter), drop the `headers?: Headers` parameter and the `headers?.forEach(...)` block — it's an optional hardening, not part of the perf fix.

- [ ] **Step 3: Verify `safeCheck`, `hasEmailIdentity`, `hasLinkedProfile` have no dangling references**

Run: `grep -rn "safeCheck" lib/ app/ components/`
Expected: no matches.
Run: `grep -rn "hasLinkedProfile\|hasEmailIdentity" lib/ app/ components/`
Expected: matches only in `lib/auth-helpers.ts` (definitions), `app/auth/onboarding/page.tsx`, and `app/auth/callback/route.ts` — those callers stay.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/proxy.ts
git commit -m "perf(middleware): claims-only session gate, no per-request network calls

getClaims() alone handles session refresh (current official pattern). The
email-identity gate reads app_metadata.providers from the JWT instead of
calling getUser(); the linked-profile gate (two DB queries per request)
moves to the (main) layout. getUser() survives only on the /auth/login
bounce as deleted-user loop protection. Also stamps x-pathname for the
layout's onboarding redirect and forwards @supabase/ssr cache headers.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Profile gate in the `(main)` layout

**Files:**
- Modify: `app/(main)/layout.tsx`

- [ ] **Step 1: Rewrite the data-fetching part of the layout**

Replace the imports and the top of `DashboardLayout` (everything before the `return`) with:

```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { getCoachUnreadCount } from "@/lib/essays/queries";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();

  // Linked-profile gate (moved here from the middleware): an authenticated,
  // email-verified user without an admin-linked profile sees the onboarding
  // waiting screen. x-pathname is stamped by the proxy so the deep link
  // survives onboarding.
  if (!profile) {
    const headersList = await headers();
    const fullPath = headersList.get("x-pathname");
    redirect(
      fullPath
        ? `/auth/onboarding?next=${encodeURIComponent(fullPath)}`
        : "/auth/onboarding",
    );
  }

  const sidebarUser = {
    id: profile.id,
    name: profile.name,
    email: profile.work_email,
    role: profile.role,
  };

  const isCoachOrAdmin = profile.role === "coach" || profile.role === "admin";
  let reviewCount = 0;
  if (isCoachOrAdmin && profile.team_id) {
    const supabase = await createClient();
    reviewCount = await getCoachUnreadCount(supabase, profile.id, profile.team_id);
  }
```

The JSX `return (...)` block stays exactly as it is today. Note the removed pieces: the unconditional `createClient()` call, the `getCurrentUserProfile` import, and the `|| ""` / `|| "Uživatel"` null fallbacks (profile is non-null past the gate).

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "app/(main)/layout.tsx"
git commit -m "perf(layout): gate on linked profile via request-cached fetch

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Dashboard page uses the cached fetch

**Files:**
- Modify: `app/(main)/page.tsx` (line ~51 and its imports)

- [ ] **Step 1: Switch the profile fetch**

Replace:

```ts
const profile = await getCurrentUserProfile(supabase, { includeTeam: true });
if (!profile) redirect("/auth/login");
```

with:

```ts
const profile = await getSessionProfile();
if (!profile) redirect("/auth/login");
```

Update imports: remove `getCurrentUserProfile` from the `@/lib/auth-helpers` import (keep the import line if other names are still used from it; check the file), add `import { getSessionProfile } from "@/lib/auth/session";`. Within one request this is now a cache hit — the layout already fetched it.

Other pages that call `getCurrentUserProfile` directly are left alone in this plan: the Task 1 refactor already cut their cost from 3 round trips to 1 query. Migrating them to `getSessionProfile()` is a mechanical follow-up, not required for the win.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "app/(main)/page.tsx"
git commit -m "perf(dashboard): reuse request-cached profile fetch

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Manual verification (full auth-flow regression)

No test framework exists; this task IS the regression suite. Dev stack must be running (`pnpm dev`). **Do not reset the local DB.**

- [ ] **Step 1: Existing-user flows** — log in with the existing dev user; visit `/`, `/hledat`, `/rezervace`, `/komunita`; confirm sidebar shows name/team, search returns results, no console/server errors; log out; confirm `/prehled` now redirects to `/auth/login?next=%2Fprehled`.
- [ ] **Step 2: Login bounce** — while logged in, visit `/auth/login` directly; expect redirect to `/`. No redirect loop.
- [ ] **Step 3: Onboarding (OAuth-only user)** — sign in with a Google-only test account (or a user whose email identity was never added); visiting `/prehled` must land on `/auth/onboarding?next=%2Fprehled` showing the wizard. If no such account exists locally, create a fresh test user via the wizard itself (additive — no data loss).
- [ ] **Step 4: Waiting screen + profile link** — with a verified-email user that has no profile row: expect the waiting screen; link a profile (admin UI or a single `UPDATE profiles SET user_id = ...` via MCP `execute_sql` on the local stack); the realtime hook should refresh and the user should land on `next`.
- [ ] **Step 5: Session refresh through middleware** — in `supabase/config.toml` set `jwt_expiry = 60` (line ~157), restart the local stack (`pnpm restart` — this preserves data; it is NOT a reset), log in, wait 90s, navigate; you must still be logged in (cookie silently refreshed by `getClaims()` in the proxy). Revert `jwt_expiry = 3600` and restart again.
- [ ] **Step 6: API behavior** — logged out, `curl -i http://localhost:3000/api/essays` → 30x redirect to login (unchanged); logged in via the browser, search on `/hledat` works.
- [ ] **Step 7: TTFB measurement** — logged in, grab the cookie header from devtools, then before/after comparison (the "before" numbers can come from `git stash` of the three code commits or from the esejbanka branch):
  `curl -s -o /dev/null -w "TTFB: %{time_starttransfer}s\n" -H "Cookie: <session cookies>" http://localhost:3000/`
  Run 5×, compare medians. Record both numbers in the PR description.
- [ ] **Step 8: Commit any fixes found, with the failing flow named in the commit message.**

---

### Task 7: Wrap up

- [ ] **Step 1:** Run final `npx tsc --noEmit && pnpm lint && pnpm build` (build catches App Router-specific issues like `headers()` misuse). Expected: build succeeds.
- [ ] **Step 2:** Invoke `superpowers:requesting-code-review` for the branch diff, fix findings.
- [ ] **Step 3:** Invoke `superpowers:finishing-a-development-branch` — present merge/PR options to Ondřej (note: branch is based on `esejbanka`, not `production`; PR target or rebase is his call).
