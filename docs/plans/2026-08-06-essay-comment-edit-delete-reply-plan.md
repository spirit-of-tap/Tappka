# Essay Comments: Edit, Delete & Reply — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Users can edit/delete their own essay comments, reply to existing comments, and the author of a replied-to comment gets a notification email.

**Architecture:** Add a nullable self-referencing `parent_id` to `essay_comments` for reply tracking (display stays flat). The existing API route gains `PATCH`/`DELETE` handlers and `POST` accepts `parent_id`. RLS already permits owners to update/delete; a new `notifyEssayReplied` notifies the parent-comment author. The comment UI adds reply/edit/delete affordances gated on `currentProfileId`.

**Tech Stack:** Next.js app router, `supabase-js`, Drizzle schema source (`db/schema/essays.ts`), vitest (unit/component/integration), Playwright-co-located components.

---

## Task 1: Add `parent_id` to the essay_comments schema

**Files:**
- Modify: `db/schema/essays.ts:89-127`
- Generated: `supabase/migrations/*_<name>.sql` (via drizzle, after user runs migrate)

**Step 1: Edit the schema**

In `db/schema/essays.ts`, add `parentId` to the `essayComments` table definition (after `body`):

```ts
	parentId: uuid("parent_id"),
```

Add a self-referencing FK inside the table's `(table) => [...]` array (after the `updated_by` FK at line ~121):

```ts
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [essayComments.id],
			name: "essay_comments_parent_id_fkey"
		}).onDelete("set null"),
```

No RLS/policy change needed — the existing select/insert/update/delete policies cover the new column transparently.

**Step 2: Run `pnpm db:migrate`**

Run individual `git add db/schema/essays.ts` then ask the **user** to run `pnpm db:migrate`.
Remind them to check the generated migration for any unexpected drops before it's applied.
After success, `src/lib/supabase/database.types.ts` is regenerated with `parent_id` on the `essay_comments` Row/Insert/Update types. Do **not** hand-edit types.

**Step 3: Update app-facing types**

Modify `src/lib/essays/types.ts:34-46` `EssayComment` to add `parent_id`:

```ts
export interface EssayComment {
  id: string;
  essay_id: string;
  author_profile_id: string;
  parent_id: string | null;
  body: string;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
}
```

**Step 4: Commit (schema edits committed with migration)**

```bash
git add db/schema/essays.ts src/lib/essays/types.ts supabase/migrations src/lib/supabase/database.types.ts
git commit -m "feat: add parent_id to essay_comments for replies"
```

---

## Task 2: Reply + edit + delete API handlers

**Files:**
- Modify: `src/app/api/essays/[id]/comments/route.ts`
- Also: `notifyEssayReplied` is wired in a later task; for now call a stable local no-op so the route compiles — rewire in Task 4.

**Step 1: Update `POST` to accept `parent_id`**

In `src/app/api/essays/[id]/comments/route.ts`, change the `POST` handler body parsing (line 36) and insert:

```ts
const { body, parent_id } = await request.json();
if (!body?.trim()) {
  return NextResponse.json({ error: 'Text komentáře je povinný' }, { status: 400 });
}

// Validate parent belongs to this essay (reply support).
if (parent_id != null) {
  const { data: parent } = await supabase
    .from('essay_comments')
    .select('id')
    .eq('id', parent_id)
    .eq('essay_id', id)
    .is('removed_at', null)
    .maybeSingle();
  if (!parent) {
    return NextResponse.json({ error: 'Komentář, na který odpovídáte, neexistuje' }, { status: 400 });
  }
}
```

Add `parent_id: parent_id ?? null` to the insert object (lines 43-49).

**Step 2: Add `PATCH` handler**

```ts
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const { comment_id, body } = await request.json();
    if (!body?.trim()) {
      return NextResponse.json({ error: 'Text komentáře je povinný' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { data, error } = await supabase
      .from('essay_comments')
      .update({ body: body.trim(), updated_by_profile_id: profile.id })
      .eq('id', comment_id)
      .eq('essay_id', id)
      .is('removed_at', null)
      .select(`*, author:profiles!author_profile_id(id, name, picture, role)`)
      .single();

    if (error) {
      // RLS makes the update a no-op (0 rows) for non-owners.
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Komentář nebyl nalezen nebo nemáte oprávnění' }, { status: 404 });
      }
      throw error;
    }
    return NextResponse.json({ data });
  } catch (error) {
    console.error('PATCH /api/essays/[id]/comments error:', error);
    return NextResponse.json({ error: 'Nepodařilo se upravit komentář' }, { status: 500 });
  }
}
```

**Step 3: Add `DELETE` handler**

```ts
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const { comment_id } = await request.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { data, error } = await supabase
      .from('essay_comments')
      .update({
        removed_at: new Date().toISOString(),
        updated_by_profile_id: profile.id,
      })
      .eq('id', comment_id)
      .eq('essay_id', id)
      .is('removed_at', null)
      .select(`*, author:profiles!author_profile_id(id, name, picture, role)`)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Komentář nebyl nalezen nebo nemáš oprávnění' }, { status: 404 });
      }
      throw error;
    }
    return NextResponse.json({ data });
  } catch (error) {
    console.error('DELETE /api/essays/[id]/comments error:', error);
    return NextResponse.json({ error: 'Nepodařilo se smazat komentář' }, { status: 500 });
  }
}
```

**Step 4: Run typecheck & lint**

Run: `pnpm typecheck && pnpm lint`
Expected: passes (types regenerated in Task 1).

**Step 5: Commit**

```bash
git add src/app/api/essays/[id]/comments/route.ts
git commit -m "feat(api): edit, delete and reply to essay comments"
```

---

## Task 3: Reply notification — `notifyEssayReplied`

**Files:**
- Modify: `src/lib/notifications/essay-notifications.ts`
- Modify: `src/lib/notifications/email-templates.ts`

**Step 1: Add reply email template**

In `email-templates.ts`, add a `replyEmail` builder (reuses `commentQuote`, style similar to `commentEmail`, but subject references a reply and CTA says "Zobrazit odpověď"):

```ts
export function replyEmail(ctx: EssayEmailContext): EmailContent {
  const quote = ctx.commentBody
    ? `<div style="margin:24px 0;padding:16px 20px;background-color:#f9f5f0;border-left:3px solid #b31b1b;border-radius:4px;font-size:15px;line-height:1.5;color:#2c1a1d;">${escapeHtml(ctx.commentBody)}</div>`
    : '';
  return {
    subject: `${ctx.actorName} odpověděl/a na tvůj komentář u eseje „${ctx.essayTitle}“`,
    html: brandWrapper(`
      <h2 style="margin:0 0 16px;font-family:'Poppins',Arial,sans-serif;font-size:24px;font-weight:600;color:#2c1a1d;line-height:1.3;">Nová odpověď na komentář</h2>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#2c1a1d;opacity:0.8;"><strong>${ctx.actorName}</strong> odpověděl/a na tvůj komentář u eseje <strong>„${ctx.essayTitle}“</strong>:</p>
      ${quote}
      <div style="margin:32px 0;">${ctaButton(ctx.essayUrl, 'Zobrazit odpověď')}</div>
    `),
  };
}
```

**Step 2: Add the notification function**

Add to `essay-notifications.ts` (after `notifyEssayCommented`):

```ts
export async function notifyEssayReplied(
  supabase: SupabaseClient<Database>,
  params: NotifyReplyParams,
): Promise<void> {
  const { essayId, parentId, actorProfileId, origin, replyBody } = params;
  const essay = await getEssayAuthorInfo(supabase, essayId);
  if (!essay) return;

  const { data: parent } = await supabase
    .from('essay_comments')
    .select('author_profile_id')
    .eq('id', parentId)
    .is('removed_at', null)
    .maybeSingle();
  if (!parent) return;
  if (parent.author_profile_id === actorProfileId) return;

  const [recipient, actor, { data: pres, error: preferencesError }] = await Promise.all([
    getProfileById(supabase, parent.author_profile_id),
    getProfileById(supabase, actorProfileId),
    supabase.rpc('get_notification_preferences', { p_profile_id: parent.author_profile_id }),
  ]);
  if (!recipient?.work_email || !profile) return;
  if (!recipient.beta_access_granted_at) return;
  if (preferencesError) throw preferencesError;
  if (pres?.[0]?.['essay_comment_email'] === false) return;

  const { subject, html } = replyEmail({
    essayTitle: essay.title,
    essayUrl: `${origin}/cteni/eseje/${essay.id}`,
    actorName: profile.name ?? 'Někdo',
    commentBody: replyBody,
  });
  await sendEmail({ to: recipient.work_email, subject, html });
}
```

> Note: `NotifyReplyParams` interface and the `profile` name lookup mimic the existing `dispatchEssayNotification` shape; reuse `getProfileById` from `@/lib/komunita/queries`. There is a typo in the template line `komentarz u eseje` — fix to `komentář k eseji`.

**Step 3: Rewire the route**

In `src/app/api/essays/[id]/comments/route.ts`, import `notifyEssayReplied` and call it in the existing `after()` hook when `parent_id` is present (in addition to `notifyEssayCommented`):

```ts
after(() => {
  notifyEssayCommented(supabase, {
    essayId: id,
    actorProfileId: profile.id,
    origin: new URL(request.url).origin,
    commentBody: body.trim(),
  }).catch((err) => console.error('notifyEssayCommented failed:', err));

  if (parent_id != null) {
    notifyEssayReplied(supabase, {
      essayId: id,
      parentId: parent_id,
      actorProfileId: profile.id,
      origin: new URL(request.url).origin,
      replyBody: body.trim(),
    }).catch((err) => console.error('notifyEssayReplied failed:', err));
  }
});
```

**Step 4: Run typecheck & lint, then commit**

Run: `pnpm typecheck && pnpm lint`

```bash
git add src/lib/notifications/email-templates.ts src/lib/notifications/essay-notifications.ts src/app/api/essays/[id]/comments/route.ts
git commit -m "feat(notifications): email the comment author when someone replies"
```

---

## Task 4: Component — reply/edit/delete UI

**Files:**
- Modify: `src/components/essays/essay-comment-thread.tsx`
- Modify: `src/app/(main)/cteni/eseje/[essayId]/page.tsx:178`
- Test: Create `src/components/essays/essay-comment-thread.test.tsx`

**Step 1: Add tests**

Create `src/components/essays/essay-comment-thread.test.tsx` covering: reply button sets composer target + placeholder, own comment shows Edit/Delete, Edit save fires `PATCH`, Delete confirm fires soft-delete and renders "Komentář byl smazán". Follow existing `essay-vote-button.test.tsx` patterns (mock `fetch`, `@testing-library`).

**Step 2: Implement**

TODO implement full component. Add:
- `currentProfileId` prop.
- Per-comment action row (Reply +, when own: Edit/Delete) hidden by default, shown on group-hover.
- Reply state (`replyTarget` + placeholder), inline edit state (`editingId`, `editBody`).
- `handleReply(text)`, `handleEditSave(commentId)`, `handleDelete(commentId)` functions calling `fetch` and updating local `comments` state.

**Step 3: Wire page prop**

At `page.tsx:178`, pass `currentProfileId={profile.id}` to `EssayCommentThread`.

**Step 4: Run component tests, typecheck, lint**

Run: `pnpm test:component && pnpm typecheck && pnpm lint`

**Step 5: Commit**

```bash
git add src/components/essays/essay-comment-thread.tsx src/components/essays/essay-comment-thread.test.tsx "src/app/(main)/cteni/eseje/[essayId]/page.tsx"
git commit -m "feat(essays): reply, edit and delete comment UI"
```

---

## Task 5: Integration tests for RLS + schema

**Files:**
- Create: `tests/integration/essay-comments.int.test.ts`

**Step 1: Write tests**

Follow `feedback.int.test.ts` patterns (`withRollback`, `asClaims`, `insertAuthUser`). Seed essay + profiles, then cover:
- Insert reply with `parent_id` belonging to the same essay succeeds; wrong-essay parent fails lookup in app layer (covered in component/e2e) but RLS insert policy permits any authenticated user.
- Owner can `update` own comment row (rowCount 1); unrelated user updates own others' (rowCount 0).
- Owner delete sets `removed_at` (soft) rowCount 1; non-owner rowCount 0; admin rowCount 1.
- Removed comments are excluded when `is removed_at is null` in app query (plain select count check).
- `parent_id` FK `on delete set null`: deleting a parent (via DB) sets children's `parent_id` to NULL.

**Step 2: Run integration tests**

Run: `pnpm test:integration`

**Step 3: Commit**

```bash
git add tests/integration/essay-comments.int.test.ts
git commit -m "test: essay comment reply edit/delete RLS"
```

---

## Task 6: Final verification

**Step 1:** Run the full fast suite + typecheck + lint.

Run: `pnpm test && pnpm typecheck && pnpm lint`

Note: `src/components/essays/topic-pills.test.tsx` has 4 pre-existing failures on `preview`; ignore those, confirm the comment tests you added pass and total failures stay at 4.

**Step 2:** Provide branch summary and ask about opening a PR (use `finishing-a-development-branch` skill).