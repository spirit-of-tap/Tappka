# Reading Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the reading section into three focused pages (Přehled / Eseje / Knihovna) with upvotes, comment counts, and team reading lists.

**Architecture:** Bottom-up: DB migration → query layer → API endpoints → UI components → pages. Each task is independently commitable. No test infrastructure exists — verify with `npx tsc --noEmit` and manual checks after each task.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL + RLS), TypeScript, Tailwind CSS, shadcn/ui, Lucide icons.

---

## File Map

### New files
| Path | Purpose |
|------|---------|
| `supabase/migrations/20260610000001_reading_hub.sql` | essay_votes, vote_count, team reading lists |
| `app/api/essays/[essayId]/vote/route.ts` | POST / DELETE vote toggle |
| `app/api/team-reading-lists/route.ts` | GET all lists, POST create |
| `app/api/team-reading-lists/[listId]/route.ts` | DELETE list |
| `app/api/team-reading-lists/[listId]/books/route.ts` | POST add book, DELETE remove book |
| `lib/books/team-lists.ts` | DB queries for team reading lists |
| `components/essays/essay-vote-button.tsx` | Upvote toggle button |
| `components/essays/topic-pills.tsx` | Horizontally scrollable tag filter |
| `components/books/team-reading-list-card.tsx` | Single team list card |
| `components/books/team-reading-lists-hero.tsx` | Hero strip on /knihovna |

### Modified files
| Path | What changes |
|------|-------------|
| `lib/essays/types.ts` | Add `vote_count` to Essay, `EssaySortOrder` type, `tag`+`sort` to EssayFilters, guarantee `comment_count: number` |
| `lib/essays/queries.ts` | Add `essay_comments(count)` to select, normalize `comment_count`, support `sort` + `tag` filters |
| `app/api/essays/route.ts` | Pass `sort` + `tag` params to `getEssays`; normalize `comment_count` |
| `components/app-sidebar.tsx` | Add Eseje nav item under Čtení |
| `components/essays/personal-progress.tsx` | Slim single-bar redesign |
| `components/essays/prehled-tabs.tsx` | Remove Eseje tab; accept `votedEssayIds` prop |
| `components/essays/my-essay-list.tsx` | Show `vote_count` (read-only) + `comment_count` |
| `components/essays/essay-card.tsx` | Add optional `VoteButton` + `initialVoted` prop |
| `components/essays/load-more-essays.tsx` | Add `sort` + `tag` props |
| `app/(main)/prehled/page.tsx` | Fetch `userVotes`; pass `votedEssayIds` down |
| `app/(main)/eseje/page.tsx` | Remove tabs; add sort toggle + TopicPills; pass `votedEssayIds` |
| `app/(main)/knihovna/page.tsx` | Add TeamReadingListsHero above book grid |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260610000001_reading_hub.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- essay_votes: one row per (essay, voter), drives vote_count
-- ============================================================

create table public.essay_votes (
  essay_id          uuid not null references public.essays(id) on delete cascade,
  voter_profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at        timestamptz not null default now(),
  primary key (essay_id, voter_profile_id)
);

alter table public.essays
  add column vote_count integer not null default 0;

create or replace function public.handle_essay_vote_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.essays set vote_count = vote_count + 1 where id = new.essay_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.essays set vote_count = greatest(0, vote_count - 1) where id = old.essay_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger essay_votes_change_trigger
  after insert or delete on public.essay_votes
  for each row execute function public.handle_essay_vote_change();

alter table public.essay_votes enable row level security;

create index essay_votes_essay_idx  on public.essay_votes(essay_id);
create index essay_votes_voter_idx  on public.essay_votes(voter_profile_id);

create policy "Authenticated users can view votes"
  on public.essay_votes for select to authenticated using (true);

create policy "Users can vote (not own essays)"
  on public.essay_votes for insert to authenticated
  with check (
    voter_profile_id = public.current_profile_id()
    and essay_id not in (
      select id from public.essays
      where author_profile_id = public.current_profile_id()
    )
  );

create policy "Users can remove own votes"
  on public.essay_votes for delete to authenticated
  using (voter_profile_id = public.current_profile_id());

-- ============================================================
-- team_reading_lists + team_reading_list_books
-- ============================================================

create table public.team_reading_lists (
  id                    uuid primary key default gen_random_uuid(),
  team_id               uuid not null references public.teams(id) on delete cascade,
  title                 text not null,
  month                 text,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.team_reading_list_books (
  list_id   uuid not null references public.team_reading_lists(id) on delete cascade,
  book_id   uuid not null references public.books(id) on delete cascade,
  position  smallint not null default 0,
  primary key (list_id, book_id)
);

create trigger team_reading_lists_updated_at_trigger
  before update on public.team_reading_lists
  for each row execute function public.handle_updated_at();

create index team_reading_lists_team_idx      on public.team_reading_lists(team_id);
create index team_reading_list_books_list_idx on public.team_reading_list_books(list_id);

alter table public.team_reading_lists      enable row level security;
alter table public.team_reading_list_books enable row level security;

create policy "Authenticated users can view team lists"
  on public.team_reading_lists for select to authenticated using (true);

create policy "Team members can create lists"
  on public.team_reading_lists for insert to authenticated
  with check (
    team_id = (select team_id from public.profiles where id = public.current_profile_id())
  );

create policy "Team members can update their lists"
  on public.team_reading_lists for update to authenticated
  using (team_id = (select team_id from public.profiles where id = public.current_profile_id()));

create policy "Team members can delete their lists"
  on public.team_reading_lists for delete to authenticated
  using (team_id = (select team_id from public.profiles where id = public.current_profile_id()));

create policy "Authenticated users can view list books"
  on public.team_reading_list_books for select to authenticated using (true);

create policy "Team members can manage list books"
  on public.team_reading_list_books for insert to authenticated
  with check (
    list_id in (
      select id from public.team_reading_lists
      where team_id = (select team_id from public.profiles where id = public.current_profile_id())
    )
  );

create policy "Team members can remove list books"
  on public.team_reading_list_books for delete to authenticated
  using (
    list_id in (
      select id from public.team_reading_lists
      where team_id = (select team_id from public.profiles where id = public.current_profile_id())
    )
  );
```

- [ ] **Step 2: Apply migration**

```bash
cd /Users/kulo/development/timii/Tappka
npx supabase db reset
```

Expected: migration applies without errors.

- [ ] **Step 3: Verify tables exist**

```bash
npx supabase db diff --schema public 2>/dev/null | grep -E "essay_votes|team_reading_lists|vote_count"
```

Expected: output mentions `essay_votes`, `team_reading_lists`, `vote_count`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260610000001_reading_hub.sql
git commit -m "feat: add essay_votes, vote_count, team_reading_lists migration"
```

---

## Task 2: Update Essay Types

**Files:**
- Modify: `lib/essays/types.ts`

- [ ] **Step 1: Add `vote_count` to base Essay interface, `EssaySortOrder`, update `EssayFilters` and `EssayWithDetails`**

In `lib/essays/types.ts`, make these changes:

Add after the existing imports/enums section:
```typescript
export type EssaySortOrder = 'recent' | 'week' | 'best';
```

Update the `Essay` interface — add `vote_count`:
```typescript
export interface Essay {
  id: string;
  author_profile_id: string;
  book_id: string | null;
  title: string;
  content_json: object;
  content_text: string;
  published: boolean;
  view_count: number;
  vote_count: number;
  created_at: string;
  updated_at: string;
}
```

Update `EssayWithDetails` — change `comment_count?: number` to `comment_count: number`:
```typescript
export interface EssayWithDetails extends Essay {
  comment_count: number;
  author: Pick<Profile, 'id' | 'name' | 'picture' | 'role'> | null;
  book: Pick<Book, 'id' | 'title' | 'author' | 'book_points' | 'status' | 'cover_path'> | null;
}
```

Update `EssayFilters` — add `tag` and `sort`:
```typescript
export interface EssayFilters {
  view?: EssayListView;
  authorProfileId?: string;
  teamId?: string;
  bookId?: string;
  tag?: string;
  sort?: EssaySortOrder;
  search?: string;
  page?: number;
  pageSize?: number;
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors about `comment_count` mismatches — these will be fixed in the next task.

- [ ] **Step 3: Commit**

```bash
git add lib/essays/types.ts
git commit -m "feat: add vote_count, EssaySortOrder, tag/sort filters to essay types"
```

---

## Task 3: Update `getEssays` Query

**Files:**
- Modify: `lib/essays/queries.ts`

- [ ] **Step 1: Add `essay_comments(count)` to select, normalize `comment_count`, support `sort` + `tag`**

Replace the `getEssays` function body in `lib/essays/queries.ts`:

```typescript
export async function getEssays(
  supabase: SupabaseClient,
  filters?: EssayFilters,
): Promise<EssayWithDetails[]> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? PAGE_SIZE_DEFAULT;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Tag filter: resolve book IDs first (tags live on books, not essays)
  let tagBookIds: string[] | null = null;
  if (filters?.tag) {
    const { data: taggedBooks, error: tagError } = await supabase
      .from('books')
      .select('id')
      .contains('tags', [filters.tag]);
    if (tagError) throw tagError;
    tagBookIds = (taggedBooks ?? []).map((b: { id: string }) => b.id);
    if (tagBookIds.length === 0) return [];
  }

  let query = supabase
    .from('essays')
    .select(`
      *,
      essay_comments(count),
      author:profiles!author_profile_id(id, name, picture, role),
      book:books!book_id(id, title, author, book_points, status, cover_path)
    `)
    .eq('published', true)
    .range(from, to);

  // Sort
  if (filters?.sort === 'week') {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query
      .gte('created_at', oneWeekAgo)
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: false });
  } else if (filters?.sort === 'best') {
    query = query
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  if (filters?.authorProfileId) {
    query = query.eq('author_profile_id', filters.authorProfileId);
  }

  if (filters?.bookId) {
    query = query.eq('book_id', filters.bookId);
  }

  if (tagBookIds) {
    query = query.in('book_id', tagBookIds);
  }

  if (filters?.search?.trim()) {
    const q = filters.search.trim();
    const safe = q.replace(/[%_]/g, '\\$&');
    query = query.or(`title.ilike.%${safe}%,content_text.plfts(simple).${q}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Normalize essay_comments(count) → comment_count
  return (data as (EssayWithDetails & { essay_comments?: { count: number }[] })[]).map(
    ({ essay_comments, ...rest }) => ({
      ...rest,
      comment_count: Number(essay_comments?.[0]?.count ?? 0),
    }),
  ) as EssayWithDetails[];
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors (or only errors from files not yet updated).

- [ ] **Step 3: Commit**

```bash
git add lib/essays/queries.ts
git commit -m "feat: add comment_count normalization, sort, tag filtering to getEssays"
```

---

## Task 4: Update `/api/essays` Route

**Files:**
- Modify: `app/api/essays/route.ts`

- [ ] **Step 1: Add `sort` and `tag` params; normalize `comment_count` in responses**

Replace the `GET` handler:

```typescript
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const view = (searchParams.get('view') ?? 'vse') as EssayListView;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
    const teamId = searchParams.get('team_id') ?? undefined;
    const search = searchParams.get('q') ?? undefined;
    const sort = (searchParams.get('sort') ?? 'recent') as import('@/lib/essays/types').EssaySortOrder;
    const tag = searchParams.get('tag') ?? undefined;

    if (view === 'moje') {
      const profile = await getCurrentUserProfile(supabase, { user });
      if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });
      const essays = await getEssays(supabase, { authorProfileId: profile.id, page, search, sort, tag });
      return NextResponse.json({ data: essays });
    }

    if (view === 'tym' && teamId) {
      const essays = await getEssaysByTeam(supabase, teamId, { page, search });
      return NextResponse.json({ data: essays });
    }

    const essays = await getEssays(supabase, { page, search, sort, tag });
    return NextResponse.json({ data: essays });
  } catch (error) {
    console.error('GET /api/essays error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst eseje' }, { status: 500 });
  }
}
```

Also update the `POST` handler's select to include `essay_comments(count)` and normalize:

```typescript
    const { data: raw, error } = await supabase
      .from('essays')
      .insert({ ... })
      .select(`
        *,
        essay_comments(count),
        author:profiles!author_profile_id(id, name, picture, role),
        book:books!book_id(id, title, author, book_points, status, cover_path)
      `)
      .single();

    if (error) throw error;

    const { essay_comments, ...rest } = raw as typeof raw & { essay_comments?: { count: number }[] };
    const data = { ...rest, comment_count: Number(essay_comments?.[0]?.count ?? 0) };
    return NextResponse.json({ data }, { status: 201 });
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add app/api/essays/route.ts
git commit -m "feat: add sort and tag params to /api/essays"
```

---

## Task 5: Vote API Endpoint

**Files:**
- Create: `app/api/essays/[essayId]/vote/route.ts`

- [ ] **Step 1: Create the vote toggle route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';

interface RouteParams {
  params: Promise<{ essayId: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { essayId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

  const { error } = await supabase
    .from('essay_votes')
    .insert({ essay_id: essayId, voter_profile_id: profile.id });

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

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { essayId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });

  const { error } = await supabase
    .from('essay_votes')
    .delete()
    .eq('essay_id', essayId)
    .eq('voter_profile_id', profile.id);

  if (error) {
    console.error('DELETE vote error:', error);
    return NextResponse.json({ error: 'Chyba při odstranění hlasu' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add app/api/essays/[essayId]/vote/route.ts
git commit -m "feat: add POST/DELETE /api/essays/[essayId]/vote endpoint"
```

---

## Task 6: Sidebar — Add Eseje Nav Item

**Files:**
- Modify: `components/app-sidebar.tsx`

- [ ] **Step 1: Import `PenLine` and add Eseje item**

Add `PenLine` to the lucide-react import line:
```typescript
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Mail,
  Database,
  ChevronRight,
  MessageCircleQuestion,
  BookOpen,
  FileText,
  BriefcaseBusiness,
  PenLine,
} from "lucide-react"
```

In `getNavData`, update the Čtení section to add Eseje before BoB:
```typescript
    {
      title: "Čtení",
      items: [
        {
          title: "Přehled",
          url: "/prehled",
          icon: FileText,
        },
        {
          title: "Eseje",
          url: "/eseje",
          icon: PenLine,
        },
        {
          title: "BoB",
          url: "/knihovna",
          icon: BookOpen,
        },
      ],
    },
```

- [ ] **Step 2: Type check + verify**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add components/app-sidebar.tsx
git commit -m "feat: add Eseje nav item to sidebar Čtení section"
```

---

## Task 7: EssayVoteButton Component

**Files:**
- Create: `components/essays/essay-vote-button.tsx`

- [ ] **Step 1: Create the vote button**

```typescript
'use client';

import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EssayVoteButtonProps {
  essayId: string;
  initialVoteCount: number;
  initialVoted: boolean;
  readOnly?: boolean;
}

export function EssayVoteButton({
  essayId,
  initialVoteCount,
  initialVoted,
  readOnly = false,
}: EssayVoteButtonProps) {
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialVoteCount);
  const [loading, setLoading] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading || readOnly) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/essays/${essayId}/vote`, {
        method: voted ? 'DELETE' : 'POST',
      });
      if (res.ok || res.status === 409) {
        // 409 = already voted (race condition), treat as no-op
        if (res.ok) {
          setVoted((v) => !v);
          setCount((c) => (voted ? c - 1 : c + 1));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (readOnly) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
        <ChevronUp className="size-3" />
        {count}
      </span>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={cn(
        'flex items-center gap-1 text-xs rounded-full px-2 py-0.5 transition-colors select-none',
        voted
          ? 'bg-primary/15 text-primary font-semibold'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <ChevronUp className="size-3" />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add components/essays/essay-vote-button.tsx
git commit -m "feat: add EssayVoteButton component with optimistic toggle"
```

---

## Task 8: TopicPills Component

**Files:**
- Create: `components/essays/topic-pills.tsx`

- [ ] **Step 1: Create the topic pill filter**

```typescript
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';

const TOPICS = Object.keys(BOOK_CATEGORY_LABELS);

export function TopicPills() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get('tag') ?? '';

  const setTag = (tag: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tag === activeTag) {
      params.delete('tag');
    } else {
      params.set('tag', tag);
    }
    params.delete('page');
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {TOPICS.map((tag) => (
        <button
          key={tag}
          onClick={() => setTag(tag)}
          className={cn(
            'shrink-0 text-xs px-3 py-1 rounded-full border transition-colors whitespace-nowrap',
            activeTag === tag
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground',
          )}
        >
          {BOOK_CATEGORY_LABELS[tag]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add components/essays/topic-pills.tsx
git commit -m "feat: add TopicPills component for tag filtering"
```

---

## Task 9: Redesign PersonalProgress (Slim Strip)

**Files:**
- Modify: `components/essays/personal-progress.tsx`

- [ ] **Step 1: Replace with slim single-row bar**

```typescript
import { cn } from '@/lib/utils';
import { BOOK_POINTS_GOAL } from '@/lib/books/types';

interface PersonalProgressProps {
  approved_points: number;
  pending_points: number;
}

const MILESTONES = [20, 40, 60, 80, 100, 120];

const MILESTONE_LABELS: Record<number, string> = {
  20: 'Rok 1 · 1. pol.',
  40: 'Rok 1 · 2. pol.',
  60: 'Rok 2 · 1. pol.',
  80: 'Rok 2 · 2. pol.',
  100: 'Rok 3 · 1. pol.',
  120: 'Rok 3 · 2. pol.',
};

export function PersonalProgress({ approved_points, pending_points }: PersonalProgressProps) {
  const pct = Math.min(100, (approved_points / BOOK_POINTS_GOAL) * 100);
  const pendingPct = Math.min(100 - pct, (pending_points / BOOK_POINTS_GOAL) * 100);
  const next = MILESTONES.find((m) => approved_points < m);

  return (
    <div className="space-y-1.5 py-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium tabular-nums text-foreground">
          {approved_points}
          <span className="font-normal text-muted-foreground"> / {BOOK_POINTS_GOAL} b.</span>
        </span>
        <span>
          {next
            ? `${MILESTONE_LABELS[next]} · ještě ${next - approved_points} b.`
            : 'Cíl splněn! 🎉'}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
        {pendingPct > 0 && (
          <div
            className="absolute inset-y-0 bg-primary/30 transition-all duration-700"
            style={{ left: `${pct}%`, width: `${pendingPct}%` }}
          />
        )}
        {MILESTONES.slice(0, -1).map((m) => (
          <div
            key={m}
            className={cn(
              'absolute top-0 bottom-0 w-px',
              approved_points >= m ? 'bg-background/40' : 'bg-background/50',
            )}
            style={{ left: `${(m / BOOK_POINTS_GOAL) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add components/essays/personal-progress.tsx
git commit -m "redesign: slim PersonalProgress strip (Duolingo-style)"
```

---

## Task 10: Update MyEssayList + PrehledTabs + /prehled Page

**Files:**
- Modify: `components/essays/my-essay-list.tsx`
- Modify: `components/essays/prehled-tabs.tsx`
- Modify: `app/(main)/prehled/page.tsx`

- [ ] **Step 1: Update MyEssayList to show vote count and comment badge**

In `components/essays/my-essay-list.tsx`:

Add imports:
```typescript
import { Eye, MessageCircle, ChevronUp, BookOpen, FileQuestion } from 'lucide-react';
import { EssayVoteButton } from './essay-vote-button';
```

Add `votedEssayIds` prop:
```typescript
interface MyEssayListProps {
  essays: EssayWithDetails[];
  votedEssayIds?: Set<string>;
}

export function MyEssayList({ essays, votedEssayIds = new Set() }: MyEssayListProps) {
```

Replace the footer row (views + date) with:
```typescript
              <div className="flex items-center gap-3 pt-0.5 text-xs text-muted-foreground/50">
                <EssayVoteButton
                  essayId={essay.id}
                  initialVoteCount={essay.vote_count}
                  initialVoted={votedEssayIds.has(essay.id)}
                  readOnly
                />
                <span className="flex items-center gap-1">
                  <Eye className="size-3" />
                  {essay.view_count}
                </span>
                {essay.comment_count > 0 && (
                  <span className="flex items-center gap-1 text-primary">
                    <MessageCircle className="size-3" />
                    {essay.comment_count}
                  </span>
                )}
                <span className="ml-auto">{date}</span>
              </div>
```

- [ ] **Step 2: Update PrehledTabs — remove Eseje tab, add `votedEssayIds` prop**

In `components/essays/prehled-tabs.tsx`:

Remove the `EssaySearch`, `LoadMoreEssays`, `EssayCard` imports (no longer used here).

Update props:
```typescript
interface PrehledTabsProps {
  defaultTab: string;
  stats: { approved_points: number; pending_points: number; essay_count: number };
  myEssays: EssayWithDetails[];
  teamStats: { profile: { id: string; name: string; picture: string | null }; approved_points: number; pending_points: number }[];
  hasTeam: boolean;
  votedEssayIds: Set<string>;
}

export function PrehledTabs({ defaultTab, stats, myEssays, teamStats, hasTeam, votedEssayIds }: PrehledTabsProps) {
```

Remove `TabsTrigger value="eseje"` and its `TabsContent`. Keep only Moje and Tým.

Pass `votedEssayIds` to `MyEssayList`:
```typescript
          <MyEssayList essays={myEssays} votedEssayIds={votedEssayIds} />
```

- [ ] **Step 3: Update /prehled page — fetch user votes**

In `app/(main)/prehled/page.tsx`, update the Promise.all:

```typescript
  const [stats, myEssays, teamStats, votesResult] = await Promise.all([
    getUserBookPointsStats(supabase, profile.id),
    getEssays(supabase, { authorProfileId: profile.id, pageSize: 50 }),
    profile.team_id ? getTeamBookPointsStats(supabase, profile.team_id) : Promise.resolve([]),
    supabase
      .from('essay_votes')
      .select('essay_id')
      .eq('voter_profile_id', profile.id),
  ]);

  const votedEssayIds = new Set(
    (votesResult.data ?? []).map((v: { essay_id: string }) => v.essay_id),
  );
```

Pass `votedEssayIds` to `PrehledTabs`:
```typescript
      <PrehledTabs
        defaultTab={defaultTab}
        stats={stats}
        myEssays={myEssays}
        teamStats={teamStats}
        hasTeam={!!profile.team_id}
        votedEssayIds={votedEssayIds}
      />
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add components/essays/my-essay-list.tsx components/essays/prehled-tabs.tsx app/(main)/prehled/page.tsx
git commit -m "feat: prehled — show vote_count, comment badges, remove Eseje tab"
```

---

## Task 11: Redesign /eseje Page + Update EssayCard + LoadMoreEssays

**Files:**
- Modify: `app/(main)/eseje/page.tsx`
- Modify: `components/essays/essay-card.tsx`
- Modify: `components/essays/load-more-essays.tsx`

- [ ] **Step 1: Update EssayCard to accept and show VoteButton**

In `components/essays/essay-card.tsx`, add props and import:

```typescript
import { EssayVoteButton } from './essay-vote-button';

interface EssayCardProps {
  essay: EssayWithDetails;
  showVoteButton?: boolean;
  initialVoted?: boolean;
}

export function EssayCard({ essay, showVoteButton = false, initialVoted = false }: EssayCardProps) {
```

In the footer row, replace the existing `<span className="flex items-center gap-1">` view count block with:

```typescript
          {/* Footer */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {showVoteButton ? (
              <EssayVoteButton
                essayId={essay.id}
                initialVoteCount={essay.vote_count}
                initialVoted={initialVoted}
              />
            ) : (
              <span className="flex items-center gap-1">
                <ChevronUp className="size-3" />
                {essay.vote_count}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="size-3" />
              {essay.view_count}
            </span>
            {essay.comment_count > 0 && (
              <span className="flex items-center gap-1">
                <MessageCircle className="size-3" />
                {essay.comment_count}
              </span>
            )}
            <span className="ml-auto">
              {new Date(essay.created_at).toLocaleDateString('cs-CZ', {
                day: 'numeric', month: 'numeric', year: 'numeric',
              })}
            </span>
          </div>
```

Add `ChevronUp` to the lucide-react imports.

- [ ] **Step 2: Update LoadMoreEssays — add `sort`, `tag`, `showVoteButton` props**

In `components/essays/load-more-essays.tsx`:

```typescript
interface LoadMoreEssaysProps {
  initialPage: number;
  view: 'vse' | 'moje' | 'tym';
  teamId?: string;
  q?: string;
  sort?: 'recent' | 'week' | 'best';
  tag?: string;
  showVoteButton?: boolean;
}

export function LoadMoreEssays({
  initialPage, view, teamId, q, sort, tag, showVoteButton = false,
}: LoadMoreEssaysProps) {
```

Update `buildUrl`:
```typescript
  const buildUrl = (p: number) => {
    const params = new URLSearchParams({ page: String(p), view });
    if (teamId) params.set('team_id', teamId);
    if (q) params.set('q', q);
    if (sort) params.set('sort', sort);
    if (tag) params.set('tag', tag);
    return `/api/essays?${params}`;
  };
```

Update the `useEffect` dependency array to include `sort` and `tag`:
```typescript
  useEffect(() => {
    setEssays([]);
    setPage(initialPage + 1);
    setHasMore(true);
  }, [view, teamId, initialPage, q, sort, tag]);
```

Update the render to pass `showVoteButton`:
```typescript
      {essays.map((essay) => (
        <EssayCard key={essay.id} essay={essay} showVoteButton={showVoteButton} />
      ))}
```

- [ ] **Step 3: Redesign /eseje page — remove tabs, add sort toggle + TopicPills**

Replace `app/(main)/eseje/page.tsx` entirely:

```typescript
import Link from 'next/link';
import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getEssays } from '@/lib/essays/queries';
import { EssayCard } from '@/components/essays/essay-card';
import { LoadMoreEssays } from '@/components/essays/load-more-essays';
import { EssaySearch } from '@/components/essays/essay-search';
import { TopicPills } from '@/components/essays/topic-pills';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EssaySortOrder } from '@/lib/essays/types';

interface PageProps {
  searchParams: Promise<{ q?: string; sort?: string; tag?: string }>;
}

const SORT_OPTIONS: { value: EssaySortOrder; label: string }[] = [
  { value: 'recent', label: 'Nejnovější' },
  { value: 'week',   label: 'Tento týden' },
  { value: 'best',   label: 'Nejlepší' },
];

export default async function EsejePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sort = (params.sort ?? 'recent') as EssaySortOrder;
  const tag = params.tag;
  const search = params.q;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getCurrentUserProfile(supabase, { user }) : null;

  const [essays, votesResult] = await Promise.all([
    getEssays(supabase, { sort, tag, search }),
    profile
      ? supabase.from('essay_votes').select('essay_id').eq('voter_profile_id', profile.id)
      : Promise.resolve({ data: [] }),
  ]);

  const votedIds = new Set(
    ((votesResult as { data: { essay_id: string }[] | null }).data ?? []).map((v) => v.essay_id),
  );

  return (
    <div className="container mx-auto py-6 space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Eseje</h1>
          <p className="text-muted-foreground">Praktické znalosti z přečtených knih</p>
        </div>
        <Button asChild>
          <Link href="/eseje/nova">
            <Plus className="size-4 mr-2" />
            Napsat
          </Link>
        </Button>
      </div>

      <Suspense>
        <EssaySearch />
      </Suspense>

      <Suspense>
        <TopicPills />
      </Suspense>

      {/* Sort toggle */}
      <div className="flex items-center gap-1">
        {SORT_OPTIONS.map(({ value, label }) => (
          <Link
            key={value}
            href={`?${new URLSearchParams({ ...(search && { q: search }), ...(tag && { tag }), sort: value }).toString()}`}
            className={cn(
              'text-sm px-3 py-1 rounded-full transition-colors',
              sort === value
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {essays.map((essay) => (
          <EssayCard
            key={essay.id}
            essay={essay}
            showVoteButton={!!profile}
            initialVoted={votedIds.has(essay.id)}
          />
        ))}
        <Suspense>
          <LoadMoreEssays
            initialPage={1}
            view="vse"
            q={search}
            sort={sort}
            tag={tag}
            showVoteButton={!!profile}
          />
        </Suspense>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add app/(main)/eseje/page.tsx components/essays/essay-card.tsx components/essays/load-more-essays.tsx
git commit -m "feat: eseje discovery — sort toggle, topic pills, vote buttons, no tabs"
```

---

## Task 12: Team Reading Lists — Queries + API

**Files:**
- Create: `lib/books/team-lists.ts`
- Create: `app/api/team-reading-lists/route.ts`
- Create: `app/api/team-reading-lists/[listId]/route.ts`
- Create: `app/api/team-reading-lists/[listId]/books/route.ts`

- [ ] **Step 1: Create query helpers**

`lib/books/team-lists.ts`:

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export interface TeamReadingListBook {
  book_id: string;
  position: number;
  book: {
    id: string;
    title: string;
    cover_path: string | null;
    author: string;
  };
}

export interface TeamReadingList {
  id: string;
  team_id: string;
  title: string;
  month: string | null;
  created_by_profile_id: string;
  created_at: string;
  updated_at: string;
  team: { id: string; name: string } | null;
  books: TeamReadingListBook[];
}

export async function getTeamReadingLists(
  supabase: SupabaseClient,
): Promise<TeamReadingList[]> {
  const { data, error } = await supabase
    .from('team_reading_lists')
    .select(`
      *,
      team:teams!team_id(id, name),
      books:team_reading_list_books(
        book_id,
        position,
        book:books!book_id(id, title, cover_path, author)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((list) => ({
    ...list,
    books: ((list.books ?? []) as TeamReadingListBook[]).sort(
      (a, b) => a.position - b.position,
    ),
  })) as TeamReadingList[];
}
```

- [ ] **Step 2: Create main team-reading-lists API route**

`app/api/team-reading-lists/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getTeamReadingLists } from '@/lib/books/team-lists';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });
    const lists = await getTeamReadingLists(supabase);
    return NextResponse.json({ data: lists });
  } catch (error) {
    console.error('GET /api/team-reading-lists error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst seznamy' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const profile = await getCurrentUserProfile(supabase, { user });
    if (!profile) return NextResponse.json({ error: 'Profil nenalezen' }, { status: 403 });
    if (!profile.team_id) return NextResponse.json({ error: 'Nejsi v týmu' }, { status: 403 });

    const { title, month } = await request.json();
    if (!title?.trim()) return NextResponse.json({ error: 'Název je povinný' }, { status: 400 });

    const { data, error } = await supabase
      .from('team_reading_lists')
      .insert({
        team_id: profile.team_id,
        title: title.trim(),
        month: month ?? null,
        created_by_profile_id: profile.id,
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('POST /api/team-reading-lists error:', error);
    return NextResponse.json({ error: 'Nepodařilo se vytvořit seznam' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create list detail API (DELETE)**

`app/api/team-reading-lists/[listId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ listId: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { listId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const { error } = await supabase
      .from('team_reading_lists')
      .delete()
      .eq('id', listId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/team-reading-lists/[listId] error:', error);
    return NextResponse.json({ error: 'Nepodařilo se smazat seznam' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create list books API (add/remove)**

`app/api/team-reading-lists/[listId]/books/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ listId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { listId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const { book_id, position } = await request.json();
    if (!book_id) return NextResponse.json({ error: 'book_id je povinný' }, { status: 400 });

    const { error } = await supabase
      .from('team_reading_list_books')
      .insert({ list_id: listId, book_id, position: position ?? 0 });

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Kniha již je v seznamu' }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('POST list books error:', error);
    return NextResponse.json({ error: 'Nepodařilo se přidat knihu' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { listId } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Neautorizováno' }, { status: 401 });

    const { book_id } = await request.json();
    if (!book_id) return NextResponse.json({ error: 'book_id je povinný' }, { status: 400 });

    const { error } = await supabase
      .from('team_reading_list_books')
      .delete()
      .eq('list_id', listId)
      .eq('book_id', book_id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE list books error:', error);
    return NextResponse.json({ error: 'Nepodařilo se odebrat knihu' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add lib/books/team-lists.ts app/api/team-reading-lists/
git commit -m "feat: team reading lists — queries and API routes"
```

---

## Task 13: TeamReadingListsHero + /knihovna Redesign

**Files:**
- Create: `components/books/team-reading-list-card.tsx`
- Create: `components/books/team-reading-lists-hero.tsx`
- Modify: `app/(main)/knihovna/page.tsx`

- [ ] **Step 1: Create TeamReadingListCard**

`components/books/team-reading-list-card.tsx`:

```typescript
import Link from 'next/link';
import { StorageImage } from '@/components/storage/storage-image';
import { BookOpen } from 'lucide-react';
import type { TeamReadingList } from '@/lib/books/team-lists';

interface TeamReadingListCardProps {
  list: TeamReadingList;
}

export function TeamReadingListCard({ list }: TeamReadingListCardProps) {
  const covers = list.books.slice(0, 4);

  return (
    <div className="shrink-0 w-44 rounded-xl border bg-card p-3 space-y-2.5 hover:shadow-md transition-shadow">
      {/* Stacked covers */}
      <div className="flex gap-1 h-20">
        {covers.length === 0 ? (
          <div className="w-full h-full rounded-md bg-muted flex items-center justify-center">
            <BookOpen className="size-6 text-muted-foreground/40" />
          </div>
        ) : (
          covers.map(({ book }, i) => (
            <div
              key={book.id}
              className="flex-1 rounded-md overflow-hidden bg-muted"
              style={{ opacity: 1 - i * 0.08 }}
            >
              {book.cover_path ? (
                <StorageImage
                  storageKey={book.cover_path}
                  alt={book.title}
                  width={40}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen className="size-4 text-muted-foreground/30" />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Info */}
      <div>
        <p className="font-semibold text-sm leading-snug line-clamp-1">{list.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {list.team?.name}
          {list.month && ` · ${new Date(list.month + '-01').toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}`}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create TeamReadingListsHero**

`components/books/team-reading-lists-hero.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TeamReadingListCard } from './team-reading-list-card';
import type { TeamReadingList } from '@/lib/books/team-lists';

interface TeamReadingListsHeroProps {
  lists: TeamReadingList[];
  hasTeam: boolean;
}

export function TeamReadingListsHero({ lists, hasTeam }: TeamReadingListsHeroProps) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [localLists, setLocalLists] = useState(lists);

  const create = async () => {
    if (!title.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/team-reading-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          month: new Date().toISOString().slice(0, 7),
        }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setLocalLists((prev) => [{ ...data, team: null, books: [] }, ...prev]);
        setTitle('');
        setCreating(false);
      }
    } finally {
      setLoading(false);
    }
  };

  if (localLists.length === 0 && !hasTeam) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base">Doporučené od týmů</h2>
        {hasTeam && !creating && (
          <Button variant="ghost" size="sm" onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="size-3.5" />
            Přidat seznam
          </Button>
        )}
      </div>

      {creating && (
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Název seznamu..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            className="h-8 text-sm"
            autoFocus
          />
          <Button size="sm" onClick={create} disabled={loading || !title.trim()}>
            Vytvořit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
            <X className="size-4" />
          </Button>
        </div>
      )}

      {localLists.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Zatím žádné seznamy — přidej první pro svůj tým
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {localLists.map((list) => (
            <TeamReadingListCard key={list.id} list={list} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update /knihovna page — add hero above book grid**

In `app/(main)/knihovna/page.tsx`, add to imports:
```typescript
import { TeamReadingListsHero } from '@/components/books/team-reading-lists-hero';
import { getTeamReadingLists } from '@/lib/books/team-lists';
```

In the server component, fetch lists and profile alongside existing data (add to Promise.all or separate fetch):
```typescript
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getCurrentUserProfile(supabase, { user }) : null;
  const lists = await getTeamReadingLists(supabase);
```

Add the hero above the `LibraryFilters` in the JSX:
```tsx
      <TeamReadingListsHero
        lists={lists}
        hasTeam={!!profile?.team_id}
      />
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add components/books/team-reading-list-card.tsx components/books/team-reading-lists-hero.tsx app/(main)/knihovna/page.tsx
git commit -m "feat: team reading lists hero on /knihovna"
```

---

## Final Verification

- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npx supabase db reset` → migrations apply cleanly
- [ ] Open `/prehled`: 2 tabs only (Moje + Tým), slim progress strip, essay rows show vote count + comment badge
- [ ] Open `/eseje`: no tabs, search bar + topic pills, sort toggle (Nejnovější/Tento týden/Nejlepší), vote buttons on cards
- [ ] Click a topic pill → feed filters to essays linked to books with that tag
- [ ] Click "Tento týden" → essays from last 7 days ordered by votes
- [ ] Vote on an essay → count increments; vote again → decrements; own essays cannot be voted
- [ ] Open `/knihovna`: team lists hero at top; click "Přidat seznam" → creates a list
- [ ] Sidebar shows Přehled / Eseje / BoB under Čtení
