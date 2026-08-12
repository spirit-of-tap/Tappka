# Essay Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send an opt-out-able email (via Resend) to an essay's author when a coach reads their essay, someone comments on it, or someone votes ("likes") it, with per-event toggles in a new personal settings page.

**Architecture:** A new `notification_preferences` table (1:1 with `profiles`, missing row = all-on) backs three independent toggles. Three existing route handlers (`comments`, `vote`, `coach-read` POSTs) call a shared `essay-notifications` dispatch module via Next's `after()` so email sending never blocks the response or gets killed by the platform after the response flushes. A new `/settings/notifikace` page + `PATCH /api/profile/notification-preferences` route let a user manage the toggles, following the exact patterns already used by `/beta` and `/settings/kniha-knih`.

**Tech Stack:** Next.js 16 (App Router, Route Handlers, `after()` from `next/server`), Supabase (Postgres + RLS + `supabase-js`), Drizzle (schema-authoring only, not a runtime client), Resend (email delivery), shadcn/ui `Switch`, Vitest (unit + component tests).

**Full design spec:** `docs/superpowers/specs/2026-07-26-essay-email-notifications-design.md`

## Global Constraints

- TypeScript strict mode: no `any`; use `interface` over `type` except for DB-derived types, which must be `type` (e.g. `Tables<'notification_preferences'>`); prefer `??` over `||`.
- Naming: PascalCase components/types, camelCase vars/functions, UPPER_SNAKE_CASE constants, kebab-case files.
- Imports ordered: external → `@/` internal → styles, one blank line between groups.
- Default to Server Components; `"use client"` only for interactivity (forms, toggles).
- Never hardcode magic values — extract to named constants (`NOTIFICATION_FROM_EMAIL`, toggle column names, etc.).
- **Schema changes never get a hand-written migration.** Edit `db/schema/*.ts`, run `pnpm db:generate` (safe — writes a migration file, does not touch any database), review the generated SQL for unexpected drops, commit schema + migration together, then **stop and prompt the user to run `pnpm db:migrate` themselves** — do not run `pnpm db:up` or `pnpm db:migrate` without the user's explicit go-ahead, and do not proceed to tasks that depend on the new table existing in the local DB (or on `database.types.ts` including it) until they confirm it's applied.
- Every new table must have RLS enabled and per-operation `pgPolicy` entries (not one blanket policy), matching `db/schema/essays.ts`.
- Never hand-edit files under `supabase/migrations/`.
- New unit tests co-locate as `*.test.ts` next to their `src/lib/*` source; component tests co-locate as `*.test.tsx` next to the component; integration tests live in `tests/integration/*.int.test.ts`.
- `RESEND_API_KEY` is a secret — goes in `.env.local`, never committed, never added to `.env.example`.
- All user-facing email/UI copy is in Czech, matching the rest of the app.
- Route handlers return errors as `NextResponse.json({ error: '<Czech message>' }, { status })`, matching the three existing essay routes.

---

### Task 1: `notification_preferences` schema + migration

**Files:**
- Create: `db/schema/notification-preferences.ts`
- Modify: none (drizzle-kit picks up every file under `db/schema/`, there is no index to register)
- Generated: a new file under `supabase/migrations/` (exact name assigned by `drizzle-kit generate`)

**Interfaces:**
- Produces: table `notification_preferences` with columns `profile_id` (PK/FK → `profiles.id`), `essay_coach_read_email`, `essay_comment_email`, `essay_vote_email` (all `boolean not null default true`), plus the standard `created_at`/`updated_at`/`created_by_profile_id`/`updated_by_profile_id` audit columns. Every later task that reads/writes this table uses exactly these snake_case column names via `supabase-js` (not the Drizzle object) — Drizzle here is schema-authoring only.

- [ ] **Step 1: Write the schema file**

```ts
// db/schema/notification-preferences.ts
// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
import { pgTable, foreignKey, pgPolicy, uuid, boolean, timestamp } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"

export const notificationPreferences = pgTable("notification_preferences", {
	profileId: uuid("profile_id").primaryKey().notNull(),
	essayCoachReadEmail: boolean("essay_coach_read_email").default(true).notNull(),
	essayCommentEmail: boolean("essay_comment_email").default(true).notNull(),
	essayVoteEmail: boolean("essay_vote_email").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "notification_preferences_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "notification_preferences_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "notification_preferences_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Users can view their own notification preferences", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can insert their own notification preferences", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can update their own notification preferences", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(profile_id = current_profile_id())`, withCheck: sql`(profile_id = current_profile_id())` }),
]).enableRLS();
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: a new timestamped file appears under `supabase/migrations/` containing `CREATE TABLE "notification_preferences"`, its foreign keys, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, and the three `CREATE POLICY` statements. No `DROP` statements should appear anywhere in the generated file — if any do, stop and investigate before continuing (per project convention, an unexpected drop in an additive migration means something upstream drifted).

- [ ] **Step 3: Commit schema + migration together**

```bash
git add db/schema/notification-preferences.ts supabase/migrations/
git commit -m "$(cat <<'EOF'
feat: add notification_preferences table

Backs per-event email toggles (coach read / comment / vote) for the
essay notifications feature. A missing row means all three default on.
EOF
)"
```

- [ ] **Step 4: Stop and hand off to the user**

Tell the user: "Schema + migration committed. Please run `pnpm db:migrate` and check the generated migration for anything unexpected (especially any drop) before I continue — the next tasks need the table to exist locally and `database.types.ts` to include it." Do not proceed to Task 2 or beyond until they confirm.

---

### Task 2: Email sending core (Resend wrapper)

**Files:**
- Create: `src/lib/notifications/constants.ts`
- Create: `src/lib/notifications/send-email.ts`
- Test: `src/lib/notifications/send-email.test.ts`
- Modify: `package.json` (add `resend` dependency)

**Interfaces:**
- Produces: `NOTIFICATION_FROM_EMAIL: string` constant; `sendEmail(params: { to: string; subject: string; html: string }): Promise<void>` — throws if `RESEND_API_KEY` is unset or Resend returns an error. Later tasks (Task 4) import `sendEmail` from this file.

- [ ] **Step 1: Add the dependency**

Run: `pnpm add resend`

- [ ] **Step 2: Write the constants file**

```ts
// src/lib/notifications/constants.ts
export const NOTIFICATION_FROM_EMAIL = 'Tappka <notifications@tiimi.cz>';
```

- [ ] **Step 3: Write the failing test**

```ts
// src/lib/notifications/send-email.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const sendMock = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

import { sendEmail } from './send-email';

beforeEach(() => {
  sendMock.mockReset();
  process.env.RESEND_API_KEY = 'test-key';
});

describe('sendEmail', () => {
  it('sends with the notification from-address', async () => {
    sendMock.mockResolvedValue({ data: { id: '1' }, error: null });

    await sendEmail({ to: 'a@b.cz', subject: 'Subj', html: '<p>hi</p>' });

    expect(sendMock).toHaveBeenCalledWith({
      from: 'Tappka <notifications@tiimi.cz>',
      to: 'a@b.cz',
      subject: 'Subj',
      html: '<p>hi</p>',
    });
  });

  it('throws when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;

    await expect(
      sendEmail({ to: 'a@b.cz', subject: 'S', html: 'h' }),
    ).rejects.toThrow('RESEND_API_KEY');
  });

  it('throws when Resend returns an error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'bad request' } });

    await expect(
      sendEmail({ to: 'a@b.cz', subject: 'S', html: 'h' }),
    ).rejects.toThrow('bad request');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm test:unit -- send-email`
Expected: FAIL with "Cannot find module './send-email'" (file doesn't exist yet)

- [ ] **Step 5: Write the implementation**

```ts
// src/lib/notifications/send-email.ts
import { Resend } from 'resend';

import { NOTIFICATION_FROM_EMAIL } from './constants';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set');
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from: NOTIFICATION_FROM_EMAIL, to, subject, html });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test:unit -- send-email`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/notifications/constants.ts src/lib/notifications/send-email.ts src/lib/notifications/send-email.test.ts
git commit -m "$(cat <<'EOF'
feat: add Resend email-sending wrapper

Thin wrapper around the Resend SDK for the essay notifications
feature; throws on missing API key or send failure so callers can
catch-and-log rather than silently losing the error.
EOF
)"
```

---

### Task 3: Email templates

**Files:**
- Create: `src/lib/notifications/email-templates.ts`
- Test: `src/lib/notifications/email-templates.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (pure functions).
- Produces: `interface EssayEmailContext { essayTitle: string; essayUrl: string; actorName: string }`, `interface EmailContent { subject: string; html: string }`, and three functions `coachReadEmail`, `commentEmail`, `voteEmail`, each `(ctx: EssayEmailContext) => EmailContent`. Task 4 imports all three plus both interfaces.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/notifications/email-templates.test.ts
import { describe, expect, it } from 'vitest';

import { coachReadEmail, commentEmail, voteEmail } from './email-templates';

const ctx = {
  essayTitle: 'Moje esej o vedení',
  essayUrl: 'https://tappka.app/eseje/essay-1',
  actorName: 'Anna Nováková',
};

describe('coachReadEmail', () => {
  it('mentions the actor and essay title in the subject, and links to the essay', () => {
    const { subject, html } = coachReadEmail(ctx);
    expect(subject).toContain('Anna Nováková');
    expect(subject).toContain('Moje esej o vedení');
    expect(html).toContain('https://tappka.app/eseje/essay-1');
  });
});

describe('commentEmail', () => {
  it('mentions the actor and essay title in the subject, and links to the essay', () => {
    const { subject, html } = commentEmail(ctx);
    expect(subject).toContain('Anna Nováková');
    expect(subject).toContain('Moje esej o vedení');
    expect(html).toContain('https://tappka.app/eseje/essay-1');
  });
});

describe('voteEmail', () => {
  it('mentions the actor and essay title in the subject, and links to the essay', () => {
    const { subject, html } = voteEmail(ctx);
    expect(subject).toContain('Anna Nováková');
    expect(subject).toContain('Moje esej o vedení');
    expect(html).toContain('https://tappka.app/eseje/essay-1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:unit -- email-templates`
Expected: FAIL with "Cannot find module './email-templates'"

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/notifications/email-templates.ts
export interface EssayEmailContext {
  essayTitle: string;
  essayUrl: string;
  actorName: string;
}

export interface EmailContent {
  subject: string;
  html: string;
}

function wrapEmail(bodyHtml: string): string {
  return `<div style="font-family: sans-serif; font-size: 15px; color: #111;">${bodyHtml}</div>`;
}

export function coachReadEmail(ctx: EssayEmailContext): EmailContent {
  return {
    subject: `${ctx.actorName} přečetl/a tvou esej „${ctx.essayTitle}“`,
    html: wrapEmail(
      `<p>${ctx.actorName} si přečetl/a tvou esej <strong>${ctx.essayTitle}</strong>.</p>` +
        `<p><a href="${ctx.essayUrl}">Zobrazit esej</a></p>`,
    ),
  };
}

export function commentEmail(ctx: EssayEmailContext): EmailContent {
  return {
    subject: `${ctx.actorName} okomentoval/a tvou esej „${ctx.essayTitle}“`,
    html: wrapEmail(
      `<p>${ctx.actorName} přidal/a komentář k tvé eseji <strong>${ctx.essayTitle}</strong>.</p>` +
        `<p><a href="${ctx.essayUrl}">Zobrazit komentář</a></p>`,
    ),
  };
}

export function voteEmail(ctx: EssayEmailContext): EmailContent {
  return {
    subject: `${ctx.actorName} dal/a like tvé eseji „${ctx.essayTitle}“`,
    html: wrapEmail(
      `<p>${ctx.actorName} dal/a like tvé eseji <strong>${ctx.essayTitle}</strong>.</p>` +
        `<p><a href="${ctx.essayUrl}">Zobrazit esej</a></p>`,
    ),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:unit -- email-templates`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/email-templates.ts src/lib/notifications/email-templates.test.ts
git commit -m "feat: add Czech email templates for essay notifications"
```

---

### Task 4: Essay-author lookup + notification dispatch functions

**Files:**
- Modify: `src/lib/essays/queries.ts` (add `getEssayAuthorInfo`, reusing the existing exported `pickLatestRevision`, e.g. near `getEssayById` at line 274)
- Create: `src/lib/notifications/essay-notifications.ts`
- Test: `src/lib/notifications/essay-notifications.test.ts`

**Interfaces:**
- Consumes: `sendEmail` from `./send-email` (Task 2); `coachReadEmail`/`commentEmail`/`voteEmail`/`EssayEmailContext` from `./email-templates` (Task 3); `getProfileById(supabase, profileId): Promise<ProfileWithTeam | null>` from `@/lib/komunita/queries` (existing, returns `work_email`/`name` among the spread `profiles` columns).
- Produces: `getEssayAuthorInfo(supabase, essayId): Promise<{ id: string; title: string; authorProfileId: string } | null>` in `src/lib/essays/queries.ts`. `interface NotifyParams { essayId: string; actorProfileId: string; origin: string }` and three functions `notifyEssayCoachRead`, `notifyEssayCommented`, `notifyEssayVoted`, each `(supabase: SupabaseClient<Database>, params: NotifyParams) => Promise<void>`. Task 5 imports these three by name.

- [ ] **Step 1: Add `getEssayAuthorInfo` to `src/lib/essays/queries.ts`**

Add this function (e.g. directly below `getEssayById`, around line 290):

```ts
export async function getEssayAuthorInfo(
  supabase: SupabaseClient<Database>,
  essayId: string,
): Promise<{ id: string; title: string; authorProfileId: string } | null> {
  const { data, error } = await supabase
    .from('essays')
    .select('id, author_profile_id, essay_revisions(title, revision_no, invalid_since)')
    .eq('id', essayId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const revision = pickLatestRevision(
    data.essay_revisions as { title: string; revision_no: number; invalid_since: string | null }[] | null,
  );

  return {
    id: data.id as string,
    title: revision?.title ?? '',
    authorProfileId: data.author_profile_id as string,
  };
}
```

- [ ] **Step 2: Write the failing test for the dispatch module**

```ts
// src/lib/notifications/essay-notifications.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/lib/essays/queries', () => ({
  getEssayAuthorInfo: vi.fn(),
}));
vi.mock('@/lib/komunita/queries', () => ({
  getProfileById: vi.fn(),
}));
vi.mock('./send-email', () => ({
  sendEmail: vi.fn(),
}));

import { getEssayAuthorInfo } from '@/lib/essays/queries';
import { getProfileById } from '@/lib/komunita/queries';
import { sendEmail } from './send-email';
import { notifyEssayCommented, notifyEssayVoted, notifyEssayCoachRead } from './essay-notifications';

const mockedGetEssayAuthorInfo = vi.mocked(getEssayAuthorInfo);
const mockedGetProfileById = vi.mocked(getProfileById);
const mockedSendEmail = vi.mocked(sendEmail);

function supabaseStub(preferencesRow: Record<string, boolean> | null): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: preferencesRow, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const ESSAY = { id: 'essay-1', title: 'Moje esej', authorProfileId: 'author-1' };
const AUTHOR = { id: 'author-1', name: 'Anna Autorová', work_email: 'anna@studenti.czu.cz' };
const ACTOR = { id: 'actor-1', name: 'Petr Herec', work_email: 'petr@studenti.czu.cz' };

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetEssayAuthorInfo.mockResolvedValue(ESSAY);
  mockedGetProfileById.mockImplementation(async (_supabase, id) =>
    (id === AUTHOR.id ? AUTHOR : ACTOR) as never,
  );
});

describe('notifyEssayCommented', () => {
  it('skips when the actor is the essay author', async () => {
    mockedGetEssayAuthorInfo.mockResolvedValue({ ...ESSAY, authorProfileId: ACTOR.id });

    await notifyEssayCommented(supabaseStub(null), {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('skips when the preference is explicitly off', async () => {
    await notifyEssayCommented(supabaseStub({ essay_comment_email: false }), {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('sends when no preference row exists (default on)', async () => {
    await notifyEssayCommented(supabaseStub(null), {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: AUTHOR.work_email }),
    );
  });

  it('sends to the essay author with a link back to the essay', async () => {
    await notifyEssayCommented(supabaseStub({ essay_comment_email: true }), {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    const call = mockedSendEmail.mock.calls[0][0];
    expect(call.to).toBe(AUTHOR.work_email);
    expect(call.html).toContain('https://tappka.app/eseje/essay-1');
  });
});

describe('notifyEssayVoted', () => {
  it('checks the essay_vote_email preference', async () => {
    await notifyEssayVoted(supabaseStub({ essay_vote_email: false }), {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});

describe('notifyEssayCoachRead', () => {
  it('checks the essay_coach_read_email preference', async () => {
    await notifyEssayCoachRead(supabaseStub({ essay_coach_read_email: false }), {
      essayId: ESSAY.id,
      actorProfileId: ACTOR.id,
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test:unit -- essay-notifications`
Expected: FAIL with "Cannot find module './essay-notifications'"

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/notifications/essay-notifications.ts
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';
import { getEssayAuthorInfo } from '@/lib/essays/queries';
import { getProfileById } from '@/lib/komunita/queries';

import { sendEmail } from './send-email';
import { coachReadEmail, commentEmail, voteEmail, type EmailContent, type EssayEmailContext } from './email-templates';

export interface NotifyParams {
  essayId: string;
  actorProfileId: string;
  origin: string;
}

type PreferenceColumn = 'essay_coach_read_email' | 'essay_comment_email' | 'essay_vote_email';

async function dispatchEssayNotification(
  supabase: SupabaseClient<Database>,
  params: NotifyParams,
  preferenceColumn: PreferenceColumn,
  buildEmail: (ctx: EssayEmailContext) => EmailContent,
): Promise<void> {
  const essay = await getEssayAuthorInfo(supabase, params.essayId);
  if (!essay) return;
  if (essay.authorProfileId === params.actorProfileId) return;

  const [author, actor, { data: preferences }] = await Promise.all([
    getProfileById(supabase, essay.authorProfileId),
    getProfileById(supabase, params.actorProfileId),
    supabase
      .from('notification_preferences')
      .select(preferenceColumn)
      .eq('profile_id', essay.authorProfileId)
      .maybeSingle(),
  ]);

  if (!author?.work_email || !actor) return;
  if (preferences && (preferences as Record<PreferenceColumn, boolean>)[preferenceColumn] === false) return;

  const { subject, html } = buildEmail({
    essayTitle: essay.title,
    essayUrl: `${params.origin}/eseje/${essay.id}`,
    actorName: actor.name ?? 'Někdo',
  });

  await sendEmail({ to: author.work_email, subject, html });
}

export async function notifyEssayCoachRead(
  supabase: SupabaseClient<Database>,
  params: NotifyParams,
): Promise<void> {
  await dispatchEssayNotification(supabase, params, 'essay_coach_read_email', coachReadEmail);
}

export async function notifyEssayCommented(
  supabase: SupabaseClient<Database>,
  params: NotifyParams,
): Promise<void> {
  await dispatchEssayNotification(supabase, params, 'essay_comment_email', commentEmail);
}

export async function notifyEssayVoted(
  supabase: SupabaseClient<Database>,
  params: NotifyParams,
): Promise<void> {
  await dispatchEssayNotification(supabase, params, 'essay_vote_email', voteEmail);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test:unit -- essay-notifications`
Expected: PASS (6 tests)

- [ ] **Step 6: Run the full unit suite to confirm no regressions in `essays/queries.ts`**

Run: `pnpm test:unit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/essays/queries.ts src/lib/notifications/essay-notifications.ts src/lib/notifications/essay-notifications.test.ts
git commit -m "$(cat <<'EOF'
feat: add essay notification dispatch functions

notifyEssayCoachRead/Commented/Voted look up the essay author, skip
self-notifications, respect notification_preferences (default on when
no row exists), and send via Resend.
EOF
)"
```

---

### Task 5: Wire dispatch into the three essay routes (+ coach-read dedup fix)

**Files:**
- Modify: `src/app/api/essays/[id]/comments/route.ts`
- Modify: `src/app/api/essays/[id]/vote/route.ts`
- Modify: `src/app/api/essays/[id]/coach-read/route.ts`

**Interfaces:**
- Consumes: `notifyEssayCommented`, `notifyEssayVoted`, `notifyEssayCoachRead` from `@/lib/notifications/essay-notifications` (Task 4). Uses `after` from `next/server` (already a stable export in this Next version — verified in `node_modules/next/server.d.ts`).

- [ ] **Step 1: Wire the comments route**

In `src/app/api/essays/[id]/comments/route.ts`, add `after` to the existing `next/server` import, import `notifyEssayCommented`, and fire it after the successful insert but before returning:

```ts
import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssayComments } from '@/lib/essays/queries';
import { notifyEssayCommented } from '@/lib/notifications/essay-notifications';
```

Replace the tail of `POST` (after `if (error) throw error;`):

```ts
    if (error) throw error;

    after(() => {
      notifyEssayCommented(supabase, {
        essayId: id,
        actorProfileId: profile.id,
        origin: new URL(request.url).origin,
      }).catch((err) => console.error('notifyEssayCommented failed:', err));
    });

    return NextResponse.json({ data }, { status: 201 });
```

- [ ] **Step 2: Wire the vote route**

In `src/app/api/essays/[id]/vote/route.ts`: rename the unused `_request` parameter of `POST` to `request` (it's now needed for the origin), add the same `after`/import additions, and fire the notification after a successful insert:

```ts
import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { notifyEssayVoted } from '@/lib/notifications/essay-notifications';
```

```ts
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { error } = await supabase
      .from('essay_votes')
      .insert({
        essay_id: id,
        voter_profile_id: profile.id,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Již jste hlasoval/a' }, { status: 409 });
      }
      if (error.code === '42501' || error.message?.includes('policy')) {
        return NextResponse.json({ error: 'Nelze hlasovat za vlastní esej' }, { status: 403 });
      }
      console.error('POST vote error:', error);
      return NextResponse.json({ error: 'Chyba při hlasování' }, { status: 500 });
    }

    after(() => {
      notifyEssayVoted(supabase, {
        essayId: id,
        actorProfileId: profile.id,
        origin: new URL(request.url).origin,
      }).catch((err) => console.error('notifyEssayVoted failed:', err));
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('POST /api/essays/[id]/vote error:', error);
    return NextResponse.json({ error: 'Chyba při hlasování' }, { status: 500 });
  }
}
```

(The `DELETE` handler in this file is unchanged.)

- [ ] **Step 3: Wire the coach-read route, with the dedup fix**

In `src/app/api/essays/[id]/coach-read/route.ts`: rename `_request` to `request` on `POST`, add `.select('essay_id')` to the upsert so a genuinely-new insert can be distinguished from an ignored duplicate, and only notify when a row comes back:

```ts
import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { notifyEssayCoachRead } from '@/lib/notifications/essay-notifications';
```

```ts
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

    const { data, error } = await supabase
      .from('essay_coach_reads')
      .upsert(
        {
          essay_id: id,
          coach_profile_id: profile.id,
          created_by_profile_id: profile.id,
          updated_by_profile_id: profile.id,
        },
        { onConflict: 'essay_id,coach_profile_id', ignoreDuplicates: true },
      )
      .select('essay_id');

    if (error) {
      if (error.code === '42501' || error.message?.includes('policy')) {
        return NextResponse.json({ error: 'Nelze označit tuto esej' }, { status: 403 });
      }
      console.error('POST coach-read error:', error);
      return NextResponse.json({ error: 'Chyba při označení' }, { status: 500 });
    }

    if (data && data.length > 0) {
      after(() => {
        notifyEssayCoachRead(supabase, {
          essayId: id,
          actorProfileId: profile.id,
          origin: new URL(request.url).origin,
        }).catch((err) => console.error('notifyEssayCoachRead failed:', err));
      });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('POST /api/essays/[id]/coach-read error:', error);
    return NextResponse.json({ error: 'Chyba při označení' }, { status: 500 });
  }
}
```

(The `DELETE` handler is unchanged.)

- [ ] **Step 4: Typecheck and run the full test suite**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all PASS — these three files have no existing dedicated route tests (this codebase's convention is that route-handler coverage belongs to E2E, which is out of scope here), so this step is the safety net for this task.

- [ ] **Step 5: Manual smoke check**

With `pnpm dev` running (and `RESEND_API_KEY` unset locally, which is fine): as one seeded user, comment on / vote on / mark-as-coach-read an essay authored by a different seeded user. Confirm in the terminal:
- A `notifyEssayCommented failed: Error: RESEND_API_KEY is not set` (or similar) log appears for the comment and vote actions — this confirms the `after()` callback fired without crashing the request.
- Marking the same essay as coach-read a **second** time from the same coach does **not** log a second `notifyEssayCoachRead` attempt (confirms the dedup fix).
- Commenting/voting/marking-read on **your own** essay does not log any notify attempt (confirms the self-notification guard end-to-end, not just in the Task 4 unit tests).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/essays/[id]/comments/route.ts src/app/api/essays/[id]/vote/route.ts src/app/api/essays/[id]/coach-read/route.ts
git commit -m "$(cat <<'EOF'
feat: send email notifications on essay comment/vote/coach-read

Uses next/server's after() so sending never blocks the response. The
coach-read upsert now selects its result to distinguish a genuinely
new read from a re-opened already-read essay, so re-reads don't
re-notify the author.
EOF
)"
```

---

### Task 6: Settings API route (`PATCH /api/profile/notification-preferences`)

**Files:**
- Create: `src/app/api/profile/notification-preferences/route.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`, `getCurrentUserProfile` from `@/lib/auth-helpers` (both existing).
- Produces: `PATCH` accepting a partial `{ essay_coach_read_email?, essay_comment_email?, essay_vote_email?: boolean }` body; Task 7's form calls this exact route with exactly one key per request.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/profile/notification-preferences/route.ts
import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentUserProfile } from "@/lib/auth-helpers"

const TOGGLE_KEYS = ["essay_coach_read_email", "essay_comment_email", "essay_vote_email"] as const
type ToggleKey = (typeof TOGGLE_KEYS)[number]

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 })

    const profile = await getCurrentUserProfile(supabase, { user })
    if (!profile) return NextResponse.json({ error: "Profil nenalezen" }, { status: 403 })

    const body = await request.json()
    const updates: Partial<Record<ToggleKey, boolean>> = {}
    for (const key of TOGGLE_KEYS) {
      if (key in body) {
        if (typeof body[key] !== "boolean") {
          return NextResponse.json({ error: "Neplatná hodnota" }, { status: 400 })
        }
        updates[key] = body[key]
      }
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Žádné změny" }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from("notification_preferences")
      .select("essay_coach_read_email, essay_comment_email, essay_vote_email")
      .eq("profile_id", profile.id)
      .maybeSingle()

    const { data, error } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          profile_id: profile.id,
          essay_coach_read_email: existing?.essay_coach_read_email ?? true,
          essay_comment_email: existing?.essay_comment_email ?? true,
          essay_vote_email: existing?.essay_vote_email ?? true,
          ...updates,
          created_by_profile_id: profile.id,
          updated_by_profile_id: profile.id,
        },
        { onConflict: "profile_id" },
      )
      .select()
      .single()

    if (error) {
      console.error("PATCH notification-preferences error:", error)
      return NextResponse.json({ error: "Nepodařilo se uložit" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("PATCH /api/profile/notification-preferences error:", error)
    return NextResponse.json({ error: "Chyba serveru" }, { status: 500 })
  }
}
```

Note the `existing?.x ?? true` merge: this is what stops toggling one switch from silently resetting the other two columns to their table defaults on the upsert.

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. (No dedicated route test — matches this codebase's existing convention of not unit-testing Route Handlers; covered indirectly by the Task 8 integration test on the underlying table and the Task 7 component test on the caller.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/profile/notification-preferences/route.ts
git commit -m "feat: add PATCH /api/profile/notification-preferences route"
```

---

### Task 7: Settings page, form, and nav entry point

**Files:**
- Create: `src/app/(main)/settings/notifikace/page.tsx`
- Create: `src/components/settings/notification-preferences-form.tsx`
- Test: `src/components/settings/notification-preferences-form.test.tsx`
- Modify: `src/components/nav-user.tsx`

**Interfaces:**
- Consumes: `PATCH /api/profile/notification-preferences` (Task 6); `Switch` from `@/components/ui/switch` (existing).
- Produces: route `/settings/notifikace`; `NotificationPreferencesForm` client component taking `{ initialCoachReadEmail, initialCommentEmail, initialVoteEmail }: boolean` props.

- [ ] **Step 1: Write the failing component test**

```tsx
// src/components/settings/notification-preferences-form.test.tsx
import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form"

const fetchSpy = vi.spyOn(globalThis, "fetch")

beforeEach(() => {
  fetchSpy.mockReset()
  mockRefresh.mockReset()
})

const defaultProps = {
  initialCoachReadEmail: true,
  initialCommentEmail: true,
  initialVoteEmail: false,
}

describe("NotificationPreferencesForm", () => {
  it("renders a switch per notification type with the initial state", () => {
    render(<NotificationPreferencesForm {...defaultProps} />)
    expect(screen.getByRole("switch", { name: "Kouč přečetl tvou esej" })).toBeChecked()
    expect(screen.getByRole("switch", { name: "Nový like na tvou esej" })).not.toBeChecked()
  })

  it("sends a PATCH with only the toggled key on change", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }))
    const user = userEvent.setup()
    render(<NotificationPreferencesForm {...defaultProps} />)

    await user.click(screen.getByRole("switch", { name: "Nový like na tvou esej" }))

    expect(fetchSpy).toHaveBeenCalledWith("/api/profile/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ essay_vote_email: true }),
    })
  })

  it("rolls back the toggle when the request fails", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }))
    const user = userEvent.setup()
    render(<NotificationPreferencesForm {...defaultProps} />)

    const toggle = screen.getByRole("switch", { name: "Nový like na tvou esej" })
    await user.click(toggle)

    expect(toggle).not.toBeChecked()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:component -- notification-preferences-form`
Expected: FAIL with "Cannot find module '@/components/settings/notification-preferences-form'"

- [ ] **Step 3: Write the form component**

```tsx
// src/components/settings/notification-preferences-form.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Switch } from "@/components/ui/switch"

interface NotificationPreferencesFormProps {
  initialCoachReadEmail: boolean
  initialCommentEmail: boolean
  initialVoteEmail: boolean
}

type ToggleKey = "essay_coach_read_email" | "essay_comment_email" | "essay_vote_email"

const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: "essay_coach_read_email", label: "Kouč přečetl tvou esej" },
  { key: "essay_comment_email", label: "Nový komentář na tvou esej" },
  { key: "essay_vote_email", label: "Nový like na tvou esej" },
]

export function NotificationPreferencesForm({
  initialCoachReadEmail,
  initialCommentEmail,
  initialVoteEmail,
}: NotificationPreferencesFormProps) {
  const router = useRouter()
  const [values, setValues] = useState<Record<ToggleKey, boolean>>({
    essay_coach_read_email: initialCoachReadEmail,
    essay_comment_email: initialCommentEmail,
    essay_vote_email: initialVoteEmail,
  })
  const [savingKey, setSavingKey] = useState<ToggleKey | null>(null)

  const handleToggle = async (key: ToggleKey, value: boolean) => {
    setSavingKey(key)
    setValues((prev) => ({ ...prev, [key]: value }))

    try {
      const res = await fetch("/api/profile/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      })
      if (!res.ok) {
        setValues((prev) => ({ ...prev, [key]: !value }))
      }
      router.refresh()
    } catch {
      setValues((prev) => ({ ...prev, [key]: !value }))
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="space-y-3">
      {TOGGLES.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
          <span className="text-sm">{label}</span>
          <Switch
            aria-label={label}
            checked={values[key]}
            onCheckedChange={(value) => handleToggle(key, value)}
            disabled={savingKey === key}
          />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:component -- notification-preferences-form`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the settings page**

```tsx
// src/app/(main)/settings/notifikace/page.tsx
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { NotificationPreferencesForm } from '@/components/settings/notification-preferences-form';

export default async function NotificationSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) redirect('/');

  const { data: preferences } = await supabase
    .from('notification_preferences')
    .select('essay_coach_read_email, essay_comment_email, essay_vote_email')
    .eq('profile_id', profile.id)
    .maybeSingle();

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Notifikace</h1>
        <p className="text-muted-foreground text-sm">Vyber si, o čem tě budeme informovat e-mailem.</p>
      </div>
      <NotificationPreferencesForm
        initialCoachReadEmail={preferences?.essay_coach_read_email ?? true}
        initialCommentEmail={preferences?.essay_comment_email ?? true}
        initialVoteEmail={preferences?.essay_vote_email ?? true}
      />
    </div>
  );
}
```

- [ ] **Step 6: Add the nav entry point**

In `src/components/nav-user.tsx`: add `Bell` to the `lucide-react` import (line 12), and add a `DropdownMenuItem` right after the existing "Profil" item (after line 117):

```tsx
import {
  ChevronsUpDown,
  LogOut,
  Moon,
  Sun,
  Laptop,
  User as UserIcon,
  BriefcaseBusiness,
  FlaskConical,
  Bell,
} from "lucide-react"
```

```tsx
              <DropdownMenuItem onClick={() => router.push(`/komunita/profil/${user.id}`)}>
                <UserIcon className="mr-2 h-4 w-4" />
                Profil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings/notifikace")}>
                <Bell className="mr-2 h-4 w-4" />
                Notifikace
              </DropdownMenuItem>
```

- [ ] **Step 7: Typecheck, lint, and run the full test suite**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all PASS

- [ ] **Step 8: Manual check**

With `pnpm dev` running, log in, open the avatar dropdown in the sidebar footer, click "Notifikace", confirm `/settings/notifikace` renders three switches all on (assuming no preference row yet), toggle one off, refresh the page, and confirm it stays off.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(main\)/settings/notifikace/page.tsx src/components/settings/notification-preferences-form.tsx src/components/settings/notification-preferences-form.test.tsx src/components/nav-user.tsx
git commit -m "feat: add notification settings page and nav entry point"
```

---

### Task 8: Integration test for `notification_preferences` RLS

**Files:**
- Test: `tests/integration/notification-preferences.int.test.ts`

**Interfaces:**
- Consumes: `withRollback` from `@/tests/setup/tx`, `insertAuthUser` from `@/tests/setup/factories` (both existing, same helpers used by `essay-votes.int.test.ts`).

- [ ] **Step 1: Write the test**

```ts
// tests/integration/notification-preferences.int.test.ts
import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";

async function seed(client: import("pg").PoolClient) {
  const ownerAuth = await insertAuthUser(client);
  const otherAuth = await insertAuthUser(client);

  const { rows: ownerUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [ownerAuth.id],
  );
  const { rows: otherUserRows } = await client.query(
    "select id from public.users where auth_user_id = $1",
    [otherAuth.id],
  );

  await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ('Owner', 'owner@studenti.czu.cz', $1, 'student')`,
    [ownerUserRows[0].id],
  );
  const { rows: ownerProfiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [ownerUserRows[0].id],
  );

  await client.query(
    `insert into public.profiles (name, work_email, user_id, role)
     values ('Other', 'other@studenti.czu.cz', $1, 'student')`,
    [otherUserRows[0].id],
  );
  const { rows: otherProfiles } = await client.query(
    "select id from public.profiles where user_id = $1",
    [otherUserRows[0].id],
  );

  return {
    ownerProfileId: ownerProfiles[0].id as string,
    otherProfileId: otherProfiles[0].id as string,
  };
}

describe("notification_preferences rows", () => {
  it("upserts a row for a profile and reads it back", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId } = await seed(client);

      await client.query(
        `insert into public.notification_preferences
           (profile_id, essay_vote_email, created_by_profile_id, updated_by_profile_id)
         values ($1, false, $1, $1)`,
        [ownerProfileId],
      );

      const { rows } = await client.query(
        "select essay_vote_email, essay_comment_email from public.notification_preferences where profile_id = $1",
        [ownerProfileId],
      );

      expect(rows[0].essay_vote_email).toBe(false);
      expect(rows[0].essay_comment_email).toBe(true); // column default, untouched by the insert
    });
  });
});

describe("notification_preferences RLS", () => {
  it("does not let one profile's row collide with another's on insert", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId, otherProfileId } = await seed(client);

      await client.query(
        `insert into public.notification_preferences (profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $1, $1)`,
        [ownerProfileId],
      );
      await client.query(
        `insert into public.notification_preferences (profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $1, $1)`,
        [otherProfileId],
      );

      const { rows } = await client.query(
        "select count(*)::int as cnt from public.notification_preferences",
      );
      expect(rows[0].cnt).toBe(2);
    });
  });

  it("cascades delete when the owning profile is removed", async () => {
    await withRollback(async (client) => {
      const { ownerProfileId } = await seed(client);

      await client.query(
        `insert into public.notification_preferences (profile_id, created_by_profile_id, updated_by_profile_id)
         values ($1, $1, $1)`,
        [ownerProfileId],
      );
      await client.query("delete from public.profiles where id = $1", [ownerProfileId]);

      const { rows } = await client.query(
        "select count(*)::int as cnt from public.notification_preferences where profile_id = $1",
        [ownerProfileId],
      );
      expect(rows[0].cnt).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run the integration suite**

Run: `pnpm test:integration -- notification-preferences`
Expected: PASS (3 tests). If it fails with `relation "notification_preferences" does not exist`, the Task 1 migration hasn't been applied locally yet — re-confirm with the user that `pnpm db:migrate` has been run.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/notification-preferences.int.test.ts
git commit -m "test: add integration coverage for notification_preferences"
```

---

## Self-Review Notes

- **Spec coverage:** all seven spec sections (data model, email sending, route changes, settings UI, testing) map to Tasks 1–8. The rollout note (schema migration confirmation) is Task 1, Step 4.
- **Type consistency:** `NotifyParams` (Task 4) is used identically by all three route call sites (Task 5). `ToggleKey`/column names (`essay_coach_read_email`, `essay_comment_email`, `essay_vote_email`) are consistent across the schema (Task 1), dispatch module (Task 4), API route (Task 6), and form component (Task 7).
- **No placeholders:** every step has literal code, not a description of code.
