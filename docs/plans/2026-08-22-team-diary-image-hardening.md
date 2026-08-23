# Team Diary Image Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make team-diary image upload, persistence, cleanup, preview, and delivery reliable without consuming Vercel Image Optimization.

**Architecture:** Keep public-by-URL images in the existing Supabase `images` bucket under the team-owned `team-activities/` namespace. Send a client-optimized WebP below a strict Vercel-safe limit to canonical server routes that own row mutations and compensating Storage cleanup. Render responsive Supabase transformations directly with native `srcset`; do not proxy them through Vercel or retry against the original object.

**Tech Stack:** Next.js 16 route handlers, React 19, Supabase Storage/Image Transformations, Supabase PostgREST, Vitest, Playwright.

---

### Task 1: Responsive Storage Images

**Files:**
- Modify: `src/lib/storage/public-url.ts`
- Test: `src/lib/storage/public-url.test.ts`
- Create: `src/components/tymovy-denik/team-activity-image.tsx`
- Modify: `src/components/tymovy-denik/team-activity-list.tsx`
- Modify: `src/components/tymovy-denik/team-activity-detail.tsx`
- Modify: `src/components/tymovy-denik/team-activity-thumb.tsx`
- Delete: `src/components/tymovy-denik/smart-image.tsx`

1. Add failing URL-helper tests for transformed `srcset` output.
2. Run the focused unit test and confirm it fails.
3. Add a server-compatible image primitive that supplies dimensions, `srcset`, `sizes`, lazy/eager loading, and decorative alt text.
4. Replace every team-diary stored-image rendering path and remove `SmartImage`.
5. Run focused unit/component tests.

### Task 2: Canonical Server Mutation API

**Files:**
- Create: `src/app/api/tymovy-denik/activities/_shared.ts`
- Create: `src/app/api/tymovy-denik/activities/route.ts`
- Create: `src/app/api/tymovy-denik/activities/[id]/route.ts`
- Delete: `src/app/api/tymovy-denik/upload-image/route.ts`
- Test: `tests/unit/team-activity-routes.test.ts`

1. Add failing route tests for authorization, image validation, create rollback, replacement ordering, removal, and soft-delete cleanup.
2. Run the route tests and confirm they fail.
3. Implement authenticated, team-derived create/update/delete routes with server-side actor fields.
4. Accept only valid optimized WebP files below the named Vercel-safe limit.
5. Upload the new object before the row mutation, compensate on mutation failure, and delete old objects only after success.
6. Run focused route tests.

### Task 3: Clean Form Lifecycle

**Files:**
- Modify: `src/components/tymovy-denik/team-activity-form.tsx`
- Modify: `src/components/tymovy-denik/team-activity-form.test.tsx`
- Modify: `src/components/tymovy-denik/team-activity-list.tsx`
- Modify: `src/components/tymovy-denik/team-activity-detail.tsx`

1. Add failing component tests for optimize-on-selection, preview URL cleanup, canonical API submission, and upload errors.
2. Run focused component tests and confirm they fail.
3. Store the optimized file in state, derive/revoke its preview URL in an effect, and submit one multipart request.
4. Remove browser Supabase row/storage mutations and identity props that the server can derive.
5. Run focused component tests.

### Task 4: End-to-End Verification

**Files:**
- Modify: `tests/e2e/tymovy-denik.spec.ts`

1. Update image assertions to verify successful decoding and Supabase render URLs.
2. Update stale detail-delete selectors while touching the flow.
3. Run focused E2E tests against local Supabase.
4. Run `pnpm test`, `pnpm typecheck`, and `pnpm lint` for final verification.

### Task 5: Minimal Ambiguity And Decode Hardening

**Files:**
- Modify: `tests/unit/team-activity-routes.test.ts`
- Modify: `src/app/api/tymovy-denik/activities/route.ts`
- Modify: `src/app/api/tymovy-denik/activities/[id]/route.ts`
- Modify: `src/lib/tymovy-denik/webp.test.ts`
- Modify: `src/lib/tymovy-denik/webp.ts`
- Modify: `src/app/api/tymovy-denik/activities/_shared.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

1. Add failing route regressions for transport-ambiguous mutations and replacements still referenced after a later edit.
2. Run the focused route tests and confirm they fail because cleanup deletes a possibly live image.
3. Distinguish Supabase transport ambiguity (`status === 0`) from definitive database errors. Reconcile once, preserve a possibly live image when still uncertain, and never delete the replacement path currently referenced by the row.
4. Add malformed VP8 and VP8L fixtures that pass the header parser but cannot be decoded, then confirm the focused WebP tests fail.
5. Replace header-only validation with a bounded Sharp pixel decode and return decoded dimensions.
6. Run focused route and WebP tests, then run the full verification commands from Task 4.
