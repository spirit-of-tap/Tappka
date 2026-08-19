# Birth Giving Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build canonical Birth Giving events with historical entry, mutually approved temporary teams, time-gated assignment files, per-team result files, profile history, and retry-safe assignment emails.

**Architecture:** Drizzle owns all BG tables, constraints, indexes, and RLS. PostgreSQL RPCs own concurrency-sensitive transitions; Next.js App Router pages and APIs use typed `supabase-js`; files live in the private `documents` bucket; a durable outbox plus authenticated cron route sends Resend emails.

**Tech Stack:** Next.js 16, React 19, TypeScript strict mode, Supabase JS/PostgreSQL/RLS/Storage, Drizzle Kit, Resend, Vitest, Testcontainers, Playwright, shadcn/ui.

---

### Task 1: Domain Helpers

**Files:**
- Create: `src/lib/birth-giving/constants.ts`
- Create: `src/lib/birth-giving/time.ts`
- Create: `src/lib/birth-giving/time.test.ts`
- Create: `src/lib/birth-giving/identity.ts`
- Create: `src/lib/birth-giving/identity.test.ts`
- Create: `src/lib/birth-giving/file-validation.ts`
- Create: `src/lib/birth-giving/file-validation.test.ts`

**Steps:**
1. Write failing tests for 8/24-hour end calculation, active/released/ended states, normalized event identity, duplicate candidate ranking, allowed PDF/PPTX/DOCX/XLSX/image files, extension consistency, unsafe MIME rejection, and size limits.
2. Run `pnpm test:unit -- src/lib/birth-giving` and verify failures are caused by missing modules.
3. Implement minimal pure helpers and named constants without handwritten database types.
4. Run the focused unit tests and verify they pass.
5. Commit `test/feat: add birth giving domain helpers`.

### Task 2: Relational Schema And RLS

**Files:**
- Create: `db/schema/birth-giving.ts`
- Modify: `tests/setup/factories.ts`
- Create: `tests/integration/birth-giving-schema.int.test.ts`
- Generate: `supabase/migrations/*`
- Generate: `supabase/migrations/meta/*`
- Generate: `src/lib/supabase/database.types.ts`

**Steps:**
1. Write integration tests describing enums, exact duplicate identity, event/team composite foreign keys, one membership per profile/event, one reflection per participant, draft/community RLS, organizer RLS, result/reflection permissions, and delivery deduplication.
2. Run the focused integration test and verify it fails because BG relations do not exist.
3. Add Drizzle enums and tables for events, organizers, assignments, temporary teams, memberships, proposals, team searches, result files, reflections, and email deliveries. Add all checks, composite keys/FKs, indexes, audit columns, soft-delete fields, and full RLS policies.
4. Run `pnpm db:migrate` locally. Inspect generated SQL for every `DROP TABLE`, `DROP COLUMN`, and `DROP TYPE`; no unrelated drop may remain.
5. Regenerate DB types and run the focused integration tests.
6. Commit schema, migration, metadata, generated types, factories, and tests together.

### Task 3: Transactional Lifecycle RPCs

**Files:**
- Generate: `supabase/migrations/*` custom migration
- Create: `tests/integration/birth-giving-lifecycle.int.test.ts`
- Modify: `src/lib/supabase/database.types.ts` through generation only

**Steps:**
1. Write failing integration tests for draft publication, team creation, public team search, requests/invitations, any-team-member approval, invitation acceptance by candidate, atomic membership moves, capacity races, clearing competing proposals, empty-team removal, start-time closure, undersized-team cancellation, frozen participation, and idempotent delivery insertion.
2. Verify failures against missing RPCs.
3. Generate a custom migration and add pinned-search-path, fully qualified RPCs with caller-derived identity and narrow grants. Add `updated_at` triggers for mutable BG tables.
4. Apply via `pnpm db:up`, export schema, run `pnpm db:generate` to record journal state, and regenerate types.
5. Run lifecycle and schema integration tests.
6. Commit custom migration, metadata, types, and tests.

### Task 4: Typed Queries And Feature DTOs

**Files:**
- Create: `src/lib/birth-giving/types.ts`
- Create: `src/lib/birth-giving/queries.ts`
- Create: `src/lib/birth-giving/grouping.ts`
- Create: `src/lib/birth-giving/grouping.test.ts`

**Steps:**
1. Write failing unit tests for upcoming/my/history grouping and valid profile participation counts.
2. Implement DB-derived row/enum aliases and composite interfaces.
3. Implement typed query functions for event index, canonical detail, duplicate candidates, organizer profiles, profile history, and valid participation count.
4. Run unit tests and typecheck.
5. Commit.

### Task 5: Event And Team APIs

**Files:**
- Create: `src/lib/birth-giving/api.ts`
- Create API routes under `src/app/api/birth-giving/` for events, publication, joining, teams, team search, proposals, memberships, and reflections.
- Create: `src/lib/birth-giving/api.test.ts`

**Steps:**
1. Write failing tests for payload parsing and stable conflict-code mapping.
2. Implement strict Zod validation, beta/auth gates, typed RPC calls, canonical refresh responses, and exact duplicate conflict recovery.
3. Ensure routes never perform multi-step membership transitions outside RPCs.
4. Run unit tests, typecheck, and lint touched files.
5. Commit.

### Task 6: Assignment And Result Storage

**Files:**
- Modify: `src/lib/storage/service.ts`
- Create routes under `src/app/api/birth-giving/` for assignment/result presign, confirm, missing-state, download, replacement, and delete.
- Create: `src/components/birth-giving/file-upload.tsx`
- Create: `src/components/birth-giving/file-upload.test.tsx`

**Steps:**
1. Write failing component/unit tests for safe-file validation, upload progress/error handling, and the external-link preservation warning.
2. Implement feature-specific authorized presign routes with fail-closed MIME/extension/size checks and private document keys.
3. Implement assignment confirmation/replacement ordering, active replacement outbox creation, missing state, result multi-file confirmation, total-size checks, and signed download authorization.
4. Enforce assignment time release server-side and lock replacement after event end.
5. Run focused tests and typecheck.
6. Commit.

### Task 7: Durable Email Processing

**Files:**
- Modify: `src/lib/notifications/send-email.ts`
- Modify: `src/lib/notifications/send-email.test.ts`
- Create: `src/lib/notifications/birth-giving-notifications.ts`
- Create: `src/lib/notifications/birth-giving-notifications.test.ts`
- Create: `src/lib/system/cron-auth.ts`
- Create: `src/lib/system/cron-auth.test.ts`
- Create: `src/app/api/system/birth-giving/process/route.ts`

**Steps:**
1. Write failing tests for fail-closed cron auth, escaped Czech email templates, canonical links, deterministic provider idempotency keys, returned provider IDs, and retry status transitions.
2. Extend `sendEmail` with optional idempotency key and provider result without breaking existing callers.
3. Implement assignment-release and replacement templates with inclusive Czech copy.
4. Implement a strict cron endpoint that processes due starts through RPC, claims bounded outbox jobs, sends through Resend, and marks success/retry without leaking recipient data.
5. Run unit tests and typecheck.
6. Commit.

### Task 8: Event Index, Detail, And Formation UI

**Files:**
- Create pages under `src/app/(main)/birth-giving/`
- Create components under `src/components/birth-giving/` for index tabs, cards, detail, teams, team search, proposals, assignment, results, and reflection.
- Create colocated component tests for event card, proposal actions, assignment state, and profile history.
- Modify: `src/components/app-sidebar.tsx`

**Steps:**
1. Write failing component tests for list states, open/closed badges, request/invite approval, move acknowledgement, capacity conflicts, assignment countdown/release, multiple result files, and reflection ownership.
2. Implement server-component data shells with interactive client islands, shared primitives, semantic tokens, responsive dialogs, sonner feedback, keyboard access, and gender-neutral Czech copy.
3. Add beta-gated `Birth Giving` sidebar navigation using data properties rather than title-specific branching.
4. Verify light/dark semantic classes and mobile layouts in component structure.
5. Run component tests, typecheck, and lint.
6. Commit.

### Task 9: Draft And Retrospective Wizard

**Files:**
- Create pages: `src/app/(main)/birth-giving/nova/page.tsx`, `src/app/(main)/birth-giving/historie/nova/page.tsx`
- Create wizard/event/profile-picker components under `src/components/birth-giving/`
- Create: `src/components/birth-giving/retrospective-wizard.test.tsx`

**Steps:**
1. Write failing tests for resumable draft steps, duplicate candidate gate, assignment present/missing, multiple teams and members, result present/missing, publication review, and affected-profile count.
2. Implement draft autosave against canonical server responses and existing-profile search only.
3. Implement publication validation feedback without duplicating event data per profile.
4. Run component tests and typecheck.
5. Commit.

### Task 10: Profile History And Counts

**Files:**
- Modify: `src/app/(main)/komunita/profil/[id]/page.tsx`
- Create: `src/components/birth-giving/profile-history.tsx`
- Create: `src/components/birth-giving/profile-history.test.tsx`

**Steps:**
1. Write failing tests for canonical links, team display, correct event count, cancelled-team exclusion, and empty state.
2. Add the BG profile tab and overview count from valid published participation.
3. Run focused tests and typecheck.
4. Commit.

### Task 11: End-To-End Coverage And Verification

**Files:**
- Create: `tests/e2e/birth-giving.spec.ts`
- Modify: `.env.example` and deployment/runbook docs only for variable names and scheduler requirements.

**Steps:**
1. Add E2E coverage for historical publication and canonical profile counts, upcoming formation with mutual approval, time-gated assignment, per-team result uploads, and reflection visibility.
2. Run focused E2E tests against local Supabase.
3. Run `pnpm test`, `pnpm test:integration`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`.
4. Run `pnpm db:check-integrity` and inspect the complete migration diff for unintended drops.
5. Request a code review subagent, address concrete findings with regression tests, and rerun affected/full verification.
6. Commit final E2E/docs fixes without amending earlier commits.
