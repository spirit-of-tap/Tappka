# Týmové dokumenty Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give every team a private, versioned PDF library with featured Team Contract and Financial Policy documents plus unlimited custom documents.

**Architecture:** Store logical documents separately from immutable PDF versions. Team-scoped RLS protects both tables, the existing private `documents` bucket stores files, and authenticated API routes coordinate presigned uploads, metadata changes, and signed downloads. A beta-gated `/tymove-dokumenty` page presents the two featured slots first and custom documents below them.

**Tech Stack:** Next.js 16, React 19, Supabase, Drizzle schema, Supabase Storage, shadcn/ui, Tailwind CSS 4, Vitest, Testcontainers, Playwright

**Design:** `docs/plans/2026-08-19-tymove-dokumenty-design.md`

---

### Task 1: Database behavior and schema

**Files:**
- Test: `tests/integration/team-documents.int.test.ts`
- Create: `db/schema/team-documents.ts`
- Create via `pnpm db:migrate`: `supabase/migrations/<timestamp>_*.sql`
- Modify via `pnpm db:migrate`: `src/lib/supabase/database.types.ts`

**Step 1: Write the failing integration tests**

Cover these independent behaviors:

- A member can insert and read a document belonging to their team.
- A member of another team cannot read, insert, or update that document.
- A team can have only one active `team_contract` and one active `financial_policy`.
- A team can create multiple `other` documents with non-empty titles.
- A member can insert and read immutable versions belonging to their team.
- Updates and deletes of `team_document_versions` are denied.
- Deleting a team cascades to documents and versions.

Use `withRollback`, `insertAuthUser`, and `asClaims`, following `tests/integration/team-activities.int.test.ts`.

**Step 2: Run the test to verify RED**

Run: `pnpm vitest run --project integration tests/integration/team-documents.int.test.ts`

Expected: FAIL because `team_documents` and `team_document_versions` do not exist.

**Step 3: Add the Drizzle schema**

Create `team_document_type` with `team_contract`, `financial_policy`, and `other`.

Create `team_documents` with:

- `id`, `team_id`, `doc_type`, optional `title`, `removed_at`
- `created_at`, `updated_at`, `created_by_profile_id`, `updated_by_profile_id`
- team and profile foreign keys
- title check for `other`
- partial unique index on `(team_id, doc_type)` for active featured documents
- team-member select/insert policies
- team-member update policy restricted to `other` documents
- no hard-delete policy
- RLS enabled

Create `team_document_versions` with:

- `id`, `document_id`, `version_no`
- `file_path`, `file_name`, `file_size`
- optional `effective_from`, optional `change_note`
- `created_at`, `created_by_profile_id`
- unique index on `(document_id, version_no)`
- team-member select/insert policies through the parent document
- no update/delete policies
- RLS enabled

Keep full `using` and `withCheck` expressions in every policy.

**Step 4: Ask the user to migrate**

Ask the user to run:

```bash
pnpm db:migrate
```

Ask them to inspect every generated migration for unexpected `DROP` statements. Do not continue typed application work until `src/lib/supabase/database.types.ts` contains both tables and the enum.

**Step 5: Add the updated_at trigger if needed**

If `db:migrate` does not create a trigger for `team_documents`, run `pnpm db:generate:custom`, add a trigger invoking `public.handle_updated_at()`, then follow the repository custom-migration workflow. Do not add an `updated_at` column to immutable versions.

**Step 6: Verify GREEN and commit**

Run: `pnpm vitest run --project integration tests/integration/team-documents.int.test.ts`

Expected: PASS.

Commit:

```bash
git add db/schema/team-documents.ts supabase/migrations src/lib/supabase/database.types.ts tests/integration/team-documents.int.test.ts
git commit -m "feat(db): add versioned team documents"
```

---

### Task 2: Storage validation and authorization

**Files:**
- Test: `src/lib/storage/validation.test.ts`
- Modify: `src/lib/storage/types.ts`
- Modify: `src/lib/storage/buckets.ts`
- Modify: `src/lib/storage/authorization.ts`
- Modify: `src/lib/storage/validation.ts`
- Modify: `src/app/api/storage/presign-upload/route.ts`

**Step 1: Write failing unit tests**

Add tests proving team-document uploads accept `application/pdf`, reject image and Office MIME types, reject empty/invalid sizes, and enforce `MAX_DOCUMENT_SIZE`.

**Step 2: Run the tests to verify RED**

Run: `pnpm vitest run --project unit src/lib/storage/validation.test.ts`

Expected: FAIL because `validateTeamDocumentUpload` does not exist.

**Step 3: Implement minimal storage support**

- Add `team-document` to `StorageContext`.
- Map it to the private `documents` bucket.
- Add `validateTeamDocumentUpload` for PDF files up to 20 MB.
- In the presign route, load the target document and allow the upload only when its active `team_id` equals the current profile's `team_id`.
- Generate keys under `team-document/{documentId}/`.
- Keep the API key and service-role behavior server-only.

**Step 4: Verify and commit**

Run: `pnpm vitest run --project unit src/lib/storage/validation.test.ts`

Expected: PASS.

Commit:

```bash
git add src/lib/storage src/app/api/storage/presign-upload/route.ts
git commit -m "feat: support team document uploads"
```

---

### Task 3: Types, queries, and formatting

**Files:**
- Create: `src/lib/team-documents/types.ts`
- Create: `src/lib/team-documents/queries.ts`
- Test: `src/lib/team-documents/format.test.ts`
- Create: `src/lib/team-documents/format.ts`

**Step 1: Write failing format tests**

Test Czech date formatting, file-size formatting, built-in document labels, and version labels.

**Step 2: Verify RED**

Run: `pnpm vitest run --project unit src/lib/team-documents/format.test.ts`

Expected: FAIL because the module does not exist.

**Step 3: Implement derived types and queries**

- Derive rows with `Tables<'team_documents'>` and `Tables<'team_document_versions'>`.
- Define the joined creator shape without hand-writing database row types.
- Query active team documents and their versions ordered by `version_no DESC`.
- Compose documents with versions in TypeScript; the first version is current.
- Implement only the format helpers exercised by tests.

**Step 4: Verify and commit**

Run: `pnpm vitest run --project unit src/lib/team-documents/format.test.ts`

Expected: PASS.

Commit:

```bash
git add src/lib/team-documents
git commit -m "feat: add team document queries and formatting"
```

---

### Task 4: Document and version API routes

**Files:**
- Create: `src/app/api/team-documents/route.ts`
- Create: `src/app/api/team-documents/[id]/route.ts`
- Create: `src/app/api/team-documents/[id]/versions/route.ts`
- Create: `src/app/api/team-documents/versions/[versionId]/open/route.ts`

**Step 1: Extend the component/API behavior tests before each route**

Add one failing test per visible behavior in Task 6 before implementing its route contract. Keep route validation small and explicit:

- document type must be known
- custom title must be trimmed and non-empty
- featured title must remain null
- file key must begin with `team-document/{documentId}/`
- PDF file name and size must be valid
- `effectiveFrom` must be empty or `YYYY-MM-DD`
- `changeNote` must be trimmed and length-limited

**Step 2: Implement authenticated routes**

- Use `createClient`, `getCurrentUserProfile`, and typed `Insertable`/`Updatable` payloads.
- Rely on RLS and also verify profile team membership for clear errors.
- Return `409` for duplicate featured documents.
- Compute `version_no` from the current maximum; retry once on unique-conflict races.
- Archive custom documents by setting `removed_at`; never delete version files.
- Open versions through `getSignedStorageUrl('documents', file_path)`.

**Step 3: Verify and commit**

Run: `pnpm typecheck`

Expected: PASS.

Commit:

```bash
git add src/app/api/team-documents
git commit -m "feat: add team document API routes"
```

---

### Task 5: Team documents UI with TDD

**Files:**
- Test: `src/components/team-documents/team-documents.test.tsx`
- Create: `src/components/team-documents/team-documents.tsx`
- Create: `src/components/team-documents/team-document-card.tsx`
- Create: `src/components/team-documents/document-upload-form.tsx`
- Create: `src/components/team-documents/document-create-form.tsx`

**Step 1: Write failing component tests**

Cover:

- Both featured cards render even when no rows exist.
- Featured cards show first-version CTAs and cannot be renamed or archived.
- Custom documents render below the featured cards.
- Version history is newest-first and each version links to its open route.
- The upload form rejects non-PDF files before requesting a presigned URL.
- Successful upload executes presign, PUT, and version metadata calls in order.
- A custom document can be renamed and archived after confirmation.
- Failed requests keep dialogs open and show a toast.

Use responsive dialogs, shared `AlertDialog`, shared `Empty*`, `Button`, and sonner. Keep Czech copy neutral, preferably present tense or passive forms such as `Nahráno`.

**Step 2: Verify RED**

Run: `pnpm vitest run --project component src/components/team-documents/team-documents.test.tsx`

Expected: FAIL because the components do not exist.

**Step 3: Implement minimal UI**

- Render two visually prominent featured cards.
- Render custom documents as a separate collection.
- Use one reusable upload form for first and later versions.
- Keep versions immutable and show all historical downloads.
- Update local component state only after successful API responses.
- Ensure desktop/mobile layouts and light/dark token usage follow `DESIGN.md`.

**Step 4: Verify and commit**

Run: `pnpm vitest run --project component src/components/team-documents/team-documents.test.tsx`

Expected: PASS.

Commit:

```bash
git add src/components/team-documents
git commit -m "feat: add team documents interface"
```

---

### Task 6: Page and navigation

**Files:**
- Create: `src/app/(main)/tymove-dokumenty/page.tsx`
- Modify: `src/components/app-sidebar.tsx`

**Step 1: Add the page**

- Authenticate and load the session profile.
- Redirect without beta access or a team, matching other team pages.
- Fetch documents with versions.
- Render `PageShell`, `PageHeader`, an explanatory introduction, and `TeamDocuments`.

**Step 2: Add beta navigation**

Add `Týmové dokumenty` at `/tymove-dokumenty` with a document icon, active-state handling, mobile close behavior, and the existing Beta badge pattern.

**Step 3: Verify and commit**

Run: `pnpm typecheck && pnpm lint`

Expected: PASS.

Commit:

```bash
git add 'src/app/(main)/tymove-dokumenty/page.tsx' src/components/app-sidebar.tsx
git commit -m "feat: expose team documents page"
```

---

### Task 7: End-to-end flow and final verification

**Files:**
- Test: `tests/e2e/team-documents.spec.ts`
- Add only if needed: `tests/e2e/fixtures/team-document.pdf`

**Step 1: Write the E2E test**

Cover authentication redirect, beta/team gating, empty featured slots, creating a custom document with a small PDF, and adding a second immutable version.

**Step 2: Verify RED, then GREEN**

Run: `pnpm test:e2e tests/e2e/team-documents.spec.ts`

Expected before final fixes: FAIL for the missing/incorrect flow. Expected after fixes: PASS.

**Step 3: Run full verification**

Run:

```bash
pnpm test
pnpm test:integration
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands PASS with no new warnings.

**Step 4: Review scope and commit**

Confirm there is no inline editor, e-signing integration, search, tagging, notification workflow, or hard deletion of historical files.

Commit:

```bash
git add tests/e2e/team-documents.spec.ts tests/e2e/fixtures/team-document.pdf
git commit -m "test: cover team document workflow"
```
