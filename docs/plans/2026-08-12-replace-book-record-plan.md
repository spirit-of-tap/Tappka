# Replace Wrong Google Books Record — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the coach fix a book that has the wrong Google Books volume attached: search external providers from the "Upravit knihu" dialog, pick the correct version, and rewrite cover + ISBN + volume ID (+ source) in the DB. Title/author/description stay manual + AI-fetchable.

**Architecture:** New `replace-record` action branch in `PATCH /api/books/[id]` (coach/admin-guarded, ISBN/external_id conflict check, returns full book via `getBookById` so the dashboard syncs). New client-only `ReplaceRecordFlow` component (search → confirm) swapped into `BookEditDialog` alongside the existing form; `BookEditForm` gains an AI-fetch button that fills title/author/description via the existing `/api/books/enrich`. No schema changes.

**Tech Stack:** Next.js App Router API routes, supabase-js, Radix/vaul responsive dialog, sonner toasts, Vitest + Testing Library.

Design doc: `docs/plans/2026-08-12-replace-book-record-design.md`

---

### Task 1: API — `replace-record` action branch

**Files:**
- Modify: `src/app/api/books/[id]/route.ts` (PATCH body type at lines 46-48; add branch after `edit` at line 187)
- Test: none in this repo's conventions (routes have no unit tests); covered by the Task 3 component test + typecheck.

**Step 1: Extend the PATCH body union**

In `src/app/api/books/[id]/route.ts` lines 46-48, extend the `action` union with `'replace-record'` and add the payload fields:

```ts
const body: { action: 'classify' | 'highlight' | 'unhighlight' | 'edit' | 'points' | 'replace-record' } & Partial<ClassifyBookInput> & SetBookHighlightInput & {
  title?: string; author?: string; description?: string; tags?: string[]; is_rocket_model?: boolean;
  cover_url?: string | null; isbn_13?: string | null; external_id?: string | null; source?: string;
} = await request.json();
```

**Step 2: Add the branch after the `edit` branch (line 187)**

```ts
if (body.action === 'replace-record') {
  const source = body.source;
  if (source !== 'google_books' && source !== 'open_library') {
    return NextResponse.json({ error: 'Neplatný zdroj záznamu' }, { status: 400 });
  }
  if (!body.external_id?.trim()) {
    return NextResponse.json({ error: 'Chybí identifikátor záznamu' }, { status: 400 });
  }

  const coverUrl = body.cover_url?.trim() ? body.cover_url.trim().replace(/^http:\/\//, 'https://') : null;
  const isbn = body.isbn_13?.trim() || null;

  // The table has no UNIQUE constraint on isbn_13 (an ISBN identifies an
  // edition, not a work), so the duplicate guard is app-level.
  const { data: existing, error: existingError } = await supabase
    .from('books')
    .select('id')
    .or(`isbn_13.eq.${isbn ?? ''},and(source.eq.${source},external_id.eq.${body.external_id})`)
    .neq('id', id)
    .limit(1);
  if (existingError) throw existingError;
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Tento záznam už má jiná kniha' }, { status: 409 });
  }

  const { error } = await supabase
    .from('books')
    .update({
      google_books_cover_url: coverUrl,
      isbn_13: isbn,
      external_id: body.external_id,
      source,
      updated_by_profile_id: profile.id,
    })
    .eq('id', id);
  if (error) throw error;

  const book = await getBookById(supabase, id);
  return NextResponse.json({ data: book });
}
```

**Step 3: Typecheck + run existing tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS (no existing tests reference the PATCH body type).

**Step 4: Commit**

```bash
git add src/app/api/books/[id]/route.ts
git commit -m "feat(api): add replace-record action to PATCH /api/books/[id]"
```

---

### Task 2: AI fetch button in `BookEditForm`

**Files:**
- Modify: `src/components/books/book-edit-form.tsx`
- Test: Create `src/components/books/book-edit-form.test.tsx`

**Step 1: Write the failing test**

`src/components/books/book-edit-form.test.tsx` (component tests are jsdom; mock `fetch` via `vi.stubGlobal` — see `src/lib/books/external/google-books.test.ts`):

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BookEditForm } from './book-edit-form';
import type { BookWithProfiles } from '@/lib/books/types';

function book(overrides: Partial<BookWithProfiles> = {}): BookWithProfiles {
  return {
    id: 'b1', title_cs: 'Sprint', title_en: null, author: 'Jake Knapp',
    description: null, book_points: null, list_status: 'processing',
    list_status_reason: null, page_count: 288, source: 'google_books',
    external_id: 'v1', google_books_cover_url: null, is_rocket_model: false,
    isbn_13: '9780593076118', created_at: '2026-08-01T10:00:00Z', created_by: null,
    list_status_changed_by: null, essay_count: 0, tags: [],
    highlight_category: null,
    ...overrides,
  } as unknown as BookWithProfiles;
}

afterEach(() => vi.unstubAllGlobals());

describe('BookEditForm AI fetch', () => {
  it('fills title/author/description from /api/books/enrich without saving', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { title_cs: 'Sprint: Vyřešte největší problémy', author: 'Jake Knapp & John Zeratsky', description: 'Praktický průvodce.', tag: 'Inovace & kreativita', suggested_points: 3, points_reason: 'x', confidence: 'high', low_confidence_fields: [] } }),
    }));

    render(<BookEditForm book={book()} />);
    await userEvent.click(screen.getByRole('button', { name: /dohledat údaje přes ai/i }));

    await waitFor(() => expect(screen.getByLabelText(/název/i)).toHaveValue('Sprint: Vyřešte největší problémy'));
    expect(screen.getByLabelText(/autor/i)).toHaveValue('Jake Knapp & John Zeratsky');
    expect(screen.getByLabelText(/popis/i)).toHaveValue('Praktický průvodce.');

    const calls = vi.mocked(fetch).mock.calls;
    const patched = calls.filter(([url]) => String(url).includes('/api/books/'));
    expect(patched.length).toBe(0);
  });

  it('surfaces the budget error without touching fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Zkusil jsi to příliš mnohokrát. Zkus to za chvíli, nebo vyplň údaje ručně.' }),
    }));

    render(<BookEditForm book={book()} />);
    await userEvent.click(screen.getByRole('button', { name: /dohledat údaje přes ai/i }));

    await waitFor(() => expect(screen.getByText(/zkusil jsi to příliš mnohokrát/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/název/i)).toHaveValue('Sprint');
  });
});
```

**Step 2: Run to verify it fails**

Run: `pnpm vitest run src/components/books/book-edit-form.test.tsx`
Expected: FAIL — no "Dohledat údaje přes AI" button.

**Step 3: Implement**

In `book-edit-form.tsx`:

```tsx
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
// keep existing imports (Rocket, Save, Button, Input, Label, Textarea, Switch, Spinner, CategoryPicker)
```

State:

```tsx
const [isEnriching, setIsEnriching] = useState(false);
const [enrichError, setEnrichError] = useState<string | null>(null);
```

Handler (fills fields, never saves — the coach reviews before "Uložit změny"):

```tsx
const handleEnrich = async () => {
  if (!title.trim() || !author.trim()) return;
  setIsEnriching(true);
  setEnrichError(null);
  try {
    const res = await fetch('/api/books/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        author: author.trim(),
        isbn_13: book.isbn_13,
        page_count: book.page_count,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setEnrichError(json.error ?? 'Nepodařilo se dohledat údaje');
      return;
    }
    setTitle(json.data.title_cs);
    setAuthor(json.data.author);
    setDescription(json.data.description ?? '');
  } finally {
    setIsEnriching(false);
  }
};
```

Button after the description field (before the Rocket Model row):

```tsx
<div className="flex items-center gap-2">
  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={handleEnrich}
    disabled={!title.trim() || !author.trim() || isEnriching}
    className="gap-2"
  >
    {isEnriching ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}
    Dohledat údaje přes AI
  </Button>
  {enrichError && <p className="text-sm text-destructive">{enrichError}</p>}
</div>
```

Note: `Button` inside forms in this repo — the save button at line 96 uses `onClick` without `type`; keep the new button `type="button"` so it doesn't submit anything.

**Step 4: Run tests**

Run: `pnpm vitest run src/components/books/book-edit-form.test.tsx`
Expected: PASS (2 tests).

**Step 5: Commit**

```bash
git add src/components/books/book-edit-form.tsx src/components/books/book-edit-form.test.tsx
git commit -m "feat(books): add AI fetch button to book edit form"
```

---

### Task 3: `ReplaceRecordFlow` component

**Files:**
- Create: `src/components/books/replace-record-flow.tsx`
- Test: Create `src/components/books/replace-record-flow.test.tsx`

**Step 1: Write the failing test**

`src/components/books/replace-record-flow.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReplaceRecordFlow } from './replace-record-flow';
import type { BookWithProfiles } from '@/lib/books/types';

function book(overrides: Partial<BookWithProfiles> = {}): BookWithProfiles {
  return {
    id: 'b1', title_cs: 'Sprint', title_en: null, author: 'Jake Knapp',
    description: null, book_points: null, list_status: 'processing',
    list_status_reason: null, page_count: 288, source: 'google_books',
    external_id: 'v1', google_books_cover_url: 'https://books.google.com/old.jpg',
    is_rocket_model: false, isbn_13: '9780593076118',
    created_at: '2026-08-01T10:00:00Z', created_by: null,
    list_status_changed_by: null, essay_count: 0, tags: [],
    highlight_category: null,
    ...overrides,
  } as unknown as BookWithProfiles;
}

const CANDIDATE = {
  title: 'Sprint (CZ)', author: 'Jake Knapp', isbn_13: '9788027504376',
  description: null, cover_url: 'https://books.google.com/new.jpg', page_count: 288,
  publisher: 'Jan Melvil', published_year: 2019, preview_link: null,
  source: 'google_books', external_id: 'v2',
};

afterEach(() => vi.unstubAllGlobals());

describe('ReplaceRecordFlow', () => {
  it('searches, picks a record and PATCHes replace-record with the correct payload', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [CANDIDATE] }) }) // external-search
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { ...book(), isbn_13: CANDIDATE.isbn_13 } }) })); // PATCH

    const onReplaced = vi.fn();
    render(<ReplaceRecordFlow book={book()} onBack={vi.fn()} onReplaced={onReplaced} />);

    await userEvent.type(screen.getByPlaceholderText(/hledat podle názvu, autora nebo isbn/i), 'sprint');
    const pick = await screen.findByText('Sprint (CZ)');
    await userEvent.click(pick);
    await userEvent.click(screen.getByRole('button', { name: /potvrdit náhradu/i }));

    await waitFor(() => expect(onReplaced).toHaveBeenCalledTimes(1));

    const patchCall = vi.mocked(fetch).mock.calls.find(([url]) =>
      String(url).includes('/api/books/b1'));
    expect(patchCall?.[1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({
        action: 'replace-record',
        cover_url: 'https://books.google.com/new.jpg',
        isbn_13: '9788027504376',
        external_id: 'v2',
        source: 'google_books',
      }),
    });
  });

  it('shows a search error when the external search fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Externí hledání selhalo' }),
    }));

    render(<ReplaceRecordFlow book={book()} onBack={vi.fn()} onReplaced={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/hledat podle názvu, autora nebo isbn/i), 'sprint');

    await waitFor(() => expect(screen.getByText(/externí hledání selhalo/i)).toBeInTheDocument());
  });

  it('lets the coach go back to the search from the confirm step', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [CANDIDATE] }) }));

    const onBack = vi.fn();
    render(<ReplaceRecordFlow book={book()} onBack={onBack} onReplaced={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/hledat podle názvu, autora nebo isbn/i), 'sprint');
    await userEvent.click(await screen.findByText('Sprint (CZ)'));
    await userEvent.click(screen.getByRole('button', { name: /zpět/i }));

    expect(screen.getByPlaceholderText(/hledat podle názvu, autora nebo isbn/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run to verify it fails**

Run: `pnpm vitest run src/components/books/replace-record-flow.test.tsx`
Expected: FAIL — module not found.

**Step 3: Implement**

`src/components/books/replace-record-flow.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Loader2, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { StorageImage } from '@/components/storage/storage-image';
import type { BookWithProfiles, ExternalBookCandidate } from '@/lib/books/types';

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

interface ReplaceRecordFlowProps {
  book: BookWithProfiles;
  /** Back to the edit form; nothing has been saved yet. */
  onBack: () => void;
  /** Called with the refreshed book after a successful replacement. */
  onReplaced: (book: BookWithProfiles) => void;
}

type Step = 'search' | 'confirm';

export function ReplaceRecordFlow({ book, onBack, onReplaced }: ReplaceRecordFlowProps) {
  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExternalBookCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<ExternalBookCandidate | null>(null);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearchError(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/books/external-search?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        if (!res.ok) {
          setSearchError(json.error ?? 'Externí hledání selhalo');
          setResults([]);
          return;
        }
        setResults((json.data ?? []) as ExternalBookCandidate[]);
      } catch {
        setSearchError('Externí hledání selhalo');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  const handleConfirm = async () => {
    if (!candidate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replace-record',
          cover_url: candidate.cover_url,
          isbn_13: candidate.isbn_13,
          external_id: candidate.external_id,
          source: candidate.source,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? 'Nepodařilo se nahradit záznam');
        return;
      }
      toast.success('Záznam knihy byl nahrazen');
      onReplaced(json.data);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'confirm' && candidate) {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold">Potvrdit náhradu</h3>
          <p className="text-sm text-muted-foreground">
            Obálka, ISBN a identifikátor záznamu (zdroj) budou v databázi přepsány.
            Název a autor zůstanou beze změny.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Současný záznam</p>
            <CoverOrMissing url={book.google_books_cover_url} />
            <p className="text-sm font-medium">{book.title_cs}</p>
            <p className="text-sm text-muted-foreground">{book.isbn_13 ?? 'bez ISBN'}</p>
            <p className="text-xs text-muted-foreground">Zdroj: {book.source} · {book.external_id ?? 'bez ID'}</p>
          </div>
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nový záznam</p>
            <CoverOrMissing url={candidate.cover_url} />
            <p className="text-sm font-medium">{candidate.title}</p>
            <p className="text-sm text-muted-foreground">{candidate.isbn_13 ?? 'bez ISBN'}</p>
            <p className="text-xs text-muted-foreground">Zdroj: {candidate.source} · {candidate.external_id}</p>
          </div>
        </div>

        {saving ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" /> Ukládám…
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button onClick={handleConfirm} disabled={saving} className="gap-2">
              <Check className="size-4" />
              Potvrdit náhradu
            </Button>
            <Button variant="ghost" onClick={() => { setCandidate(null); setStep('search'); }} disabled={saving} className="gap-2">
              <ArrowLeft className="size-4" />
              Zpět
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Nahradit záznam</h3>
        <p className="text-sm text-muted-foreground">
          Najdi správnou verzi knihy. Obálka a ISBN se přepíšou v databázi.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="replace-query">Hledat</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="replace-query"
            className="pl-8"
            placeholder="Hledat podle názvu, autora nebo ISBN…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {searching && <Spinner className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2" />}
        </div>
      </div>

      {searchError && <p className="text-sm text-destructive">{searchError}</p>}

      <div className="max-h-[60vh] space-y-2 overflow-y-auto">
        {results.length === 0 && !searching && query.trim().length >= MIN_QUERY_LENGTH && (
          <p className="text-sm text-muted-foreground">Žádné výsledky</p>
        )}
        {results.map((hit) => (
          <button
            key={`${hit.source}:${hit.external_id}`}
            type="button"
            onClick={() => { setCandidate(hit); setStep('confirm'); }}
            className="flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors hover:bg-muted/50"
          >
            <CoverOrMissing url={hit.cover_url} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{hit.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {hit.author} · {hit.isbn_13 ?? 'bez ISBN'} {hit.published_year ? `· ${hit.published_year}` : ''}
              </p>
            </div>
            <BookOpen className="size-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="size-4" />
        Zpět na úpravy
      </Button>
    </div>
  );
}

function CoverOrMissing({ url, size = 'md' }: { url: string | null; size?: 'sm' | 'md' }) {
  const className = size === 'sm' ? 'h-16 w-12' : 'h-24 w-16';
  if (!url) {
    return (
      <div className={`${className} flex items-center justify-center rounded-sm bg-muted text-muted-foreground`}>
        <BookOpen className="size-5" />
      </div>
    );
  }
  return (
    <StorageImage
      storageKey={url}
      alt=""
      width={size === 'sm' ? 48 : 64}
      height={size === 'sm' ? 64 : 96}
      className={`${className} rounded-sm object-cover`}
    />
  );
}
```

`StorageImage` props verified: `storageKey` (handles external URLs via `isExternalUrl`), `alt`, `className`, `width`, `height`. Also: desktop `DialogContent` has no max-height (checked `responsive-dialog.tsx` + `ui/dialog.tsx`), so cap the results list:

**Step 4: Run tests**

Run: `pnpm vitest run src/components/books/replace-record-flow.test.tsx`
Expected: PASS (3 tests). Fix any `StorageImage` prop mismatches found in step 3.

**Step 5: Commit**

```bash
git add src/components/books/replace-record-flow.tsx src/components/books/replace-record-flow.test.tsx
git commit -m "feat(books): add replace-record flow component"
```

---

### Task 4: Wire `ReplaceRecordFlow` into `BookEditDialog`

**Files:**
- Modify: `src/components/books/book-edit-dialog.tsx`
- Test: none new — the dialog keeps the existing open/onSaved contract; covered by Task 3 + manual check.

**Step 1: Implement**

`book-edit-dialog.tsx` — swap the dialog body between form and replace flow, keeping both mounted so unsaved form edits survive:

```tsx
'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { BookEditForm } from './book-edit-form';
import { ReplaceRecordFlow } from './replace-record-flow';
import type { BookWithProfiles } from '@/lib/books/types';

interface BookEditDialogProps {
  book: BookWithProfiles;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the updated book after a successful save. */
  onSaved: (book: BookWithProfiles) => void;
}

export function BookEditDialog({ book, open, onOpenChange, onSaved }: BookEditDialogProps) {
  const [replacing, setReplacing] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{replacing ? 'Nahradit záznam' : 'Upravit knihu'}</DialogTitle>
          <DialogDescription>
            {replacing
              ? 'Vyhledej správnou verzi knihy a přepiš obálku, ISBN a identifikátor záznamu.'
              : 'Uprav údaje o knize'}
          </DialogDescription>
        </DialogHeader>

        <div className={replacing ? 'hidden' : undefined}>
          <BookEditForm
            book={book}
            onSaved={(saved) => {
              onSaved(saved);
              onOpenChange(false);
            }}
          />
          <div className="mt-6 border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setReplacing(true)} className="gap-2">
              <RefreshCw className="size-4" />
              Nahradit záznam…
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              Opraví knihu, u které byl omylem vybrán špatný záznam z Google Books.
            </p>
          </div>
        </div>

        <div className={replacing ? undefined : 'hidden'}>
          <ReplaceRecordFlow
            book={book}
            onBack={() => setReplacing(false)}
            onReplaced={(updated) => {
              onSaved(updated);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Note: `DialogContent` in this repo — check `responsive-dialog.tsx` for a max-height/scroll style; the replace list may need the same treatment as other long dialogs.

**Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/components/books/book-edit-dialog.tsx
git commit -m "feat(books): wire replace-record flow into the edit dialog"
```

---

### Task 5: Full verification

**Step 1: Run the whole suite**

Run: `pnpm test && pnpm typecheck`
Expected: all PASS.

**Step 2: Manual smoke check**

Run: `pnpm dev` → `/cteni/sprava` → row ⋯ menu → "Upravit knihu" → "Nahradit záznam…" → search → pick → confirm. Verify:
- Dashboard updates the cover/ISBN across all tabs without a reload.
- Wrong record flow: a 409 (duplicate record) surfaces the toast message.

**Step 3: Commit**

```bash
git add -A
git commit -m "test: cover replace-record flow and AI fetch"  # only if extra changes
```

---

## Out of scope / notes

- No migration — no schema changes.
- `downloadAndStoreCover` is not used; covers stay external URLs.
- The `edit` action keeps ignoring `isbn_13` — replacement is the only path that rewrites it.
- The API branch is intentionally untested at unit level (repo convention); E2E per `tests/e2e` can be added later if the flow stabilizes.
