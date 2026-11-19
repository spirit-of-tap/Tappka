# Editor Draft Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Protect long-form writing (essays, TS preparation) from accidental loss by persisting drafts to localStorage and offering recovery via a banner.

**Architecture:** A pure storage module + a debounced React hook (`useEditorDraft`) shared by both surfaces, plus a presentational `DraftRecoveryBanner` component. Each surface wires the hook into its existing save flow; drafts are cleared when a save lands and offered back only when newer than the server copy.

**Tech Stack:** React 19, Next.js 16 (App Router), Vitest 4 + Testing Library, Tiptap (existing), localStorage.

**Design doc:** `docs/plans/2026-11-19-editor-draft-recovery-design.md`

---

## Task 1: `draft-storage.ts` — pure storage helpers

**Files:**
- Create: `src/lib/editor-drafts/draft-storage.ts`
- Test: `src/lib/editor-drafts/draft-storage.test.ts`

### Step 1: Write the failing test

Create `src/lib/editor-drafts/draft-storage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildDraftKey, isDraftExpired, isDraftNewerThan, moveDraft,
  readDraft, removeDraft, writeDraft, DRAFT_TTL_MS,
} from './draft-storage';

const storage = window.localStorage;

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
  storage.clear();
});

describe('buildDraftKey', () => {
  it('prefixes the scope', () => {
    expect(buildDraftKey('essay:essay-1')).toBe('tappka:draft:essay:essay-1');
  });
});

describe('writeDraft / readDraft', () => {
  it('roundtrips a payload', () => {
    writeDraft(storage, 'essay:nova', { title: 'Název' });
    const draft = readDraft<{ title: string }>(storage, 'essay:nova');
    expect(draft?.payload.title).toBe('Název');
    expect(typeof draft?.savedAt).toBe('string');
  });

  it('returns null when nothing is stored', () => {
    expect(readDraft(storage, 'essay:nova')).toBeNull();
  });

  it('returns null on corrupt JSON', () => {
    storage.setItem('tappka:draft:essay:nova', '{invalid json');
    expect(readDraft(storage, 'essay:nova')).toBeNull();
  });

  it('returns null for a value without savedAt/payload', () => {
    storage.setItem('tappka:draft:essay:nova', JSON.stringify({ foo: 1 }));
    expect(readDraft(storage, 'essay:nova')).toBeNull();
  });

  it('drops and removes an expired draft', () => {
    writeDraft(storage, 'essay:nova', { title: 'Starý' });
    // Rewrite the stored savedAt to be older than the TTL.
    const raw = JSON.parse(storage.getItem('tappka:draft:essay:nova')!);
    storage.setItem('tappka:draft:essay:nova', JSON.stringify({ ...raw, savedAt: hoursAgo(24 * 15) }));
    expect(readDraft(storage, 'essay:nova')).toBeNull();
    expect(storage.getItem('tappka:draft:essay:nova')).toBeNull();
  });

  it('keeps a draft younger than the TTL', () => {
    writeDraft(storage, 'essay:nova', { title: 'Čerstvý' });
    const raw = JSON.parse(storage.getItem('tappka:draft:essay:nova')!);
    storage.setItem('tappka:draft:essay:nova', JSON.stringify({ ...raw, savedAt: hoursAgo(24 * 13) }));
    expect(readDraft(storage, 'essay:nova')?.payload.title).toBe('Čerstvý');
  });
});

describe('isDraftExpired', () => {
  it('treats unparseable timestamps as expired', () => {
    expect(isDraftExpired('not-a-date')).toBe(true);
  });

  it('is false just inside the TTL', () => {
    expect(isDraftExpired(new Date(Date.now() - DRAFT_TTL_MS + 1000).toISOString())).toBe(false);
  });

  it('is true past the TTL', () => {
    expect(isDraftExpired(new Date(Date.now() - DRAFT_TTL_MS - 1000).toISOString())).toBe(true);
  });
});

describe('isDraftNewerThan', () => {
  const draft = { savedAt: new Date('2026-08-02T10:00:00Z').toISOString(), payload: {} };

  it('offers the draft when there is no server copy', () => {
    expect(isDraftNewerThan(draft, null)).toBe(true);
  });

  it('offers the draft when it is newer than the server copy', () => {
    expect(isDraftNewerThan(draft, '2026-08-01T10:00:00Z')).toBe(true);
  });

  it('suppresses the draft when the server copy is newer', () => {
    expect(isDraftNewerThan(draft, '2026-08-03T10:00:00Z')).toBe(false);
  });

  it('offers the draft when the server timestamp is unparseable', () => {
    expect(isDraftNewerThan(draft, 'garbage')).toBe(true);
  });
});

describe('removeDraft', () => {
  it('removes the stored draft', () => {
    writeDraft(storage, 'essay:nova', { title: 'X' });
    removeDraft(storage, 'essay:nova');
    expect(storage.getItem('tappka:draft:essay:nova')).toBeNull();
  });
});

describe('moveDraft', () => {
  it('moves a stored draft to a new scope', () => {
    writeDraft(storage, 'essay:nova', { title: 'X' });
    moveDraft(storage, 'essay:nova', 'essay:essay-1');
    expect(storage.getItem('tappka:draft:essay:nova')).toBeNull();
    expect(readDraft<{ title: string }>(storage, 'essay:essay-1')?.payload.title).toBe('X');
  });

  it('does nothing when there is no stored draft', () => {
    moveDraft(storage, 'essay:nova', 'essay:essay-1');
    expect(storage.getItem('tappka:draft:essay:essay-1')).toBeNull();
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm vitest run src/lib/editor-drafts/draft-storage.test.ts`
Expected: FAIL with `Failed to resolve import "./draft-storage"`.

### Step 3: Write the implementation

Create `src/lib/editor-drafts/draft-storage.ts`:

```ts
/**
 * Pure localStorage helpers for editor drafts. All reads and writes go
 * through here so the hook stays thin and every rule (TTL, shape, key
 * prefix) lives in one testable place.
 */

export const DRAFT_KEY_PREFIX = 'tappka:draft:';
export const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface EditorDraft<T> {
  savedAt: string;
  payload: T;
}

export function buildDraftKey(scope: string): string {
  return `${DRAFT_KEY_PREFIX}${scope}`;
}

/** Drops a draft whose timestamp is unparseable or older than the TTL. */
export function isDraftExpired(savedAt: string, now = Date.now()): boolean {
  const timestamp = Date.parse(savedAt);
  if (Number.isNaN(timestamp)) return true;
  return now - timestamp > DRAFT_TTL_MS;
}

/**
 * A draft is worth offering only when there is no server copy or the server
 * copy is older. Unparseable server timestamps fail open (offer the draft).
 */
export function isDraftNewerThan(draft: EditorDraft<unknown>, serverTime: string | null): boolean {
  if (serverTime === null) return true;
  const serverTimestamp = Date.parse(serverTime);
  if (Number.isNaN(serverTimestamp)) return true;
  return Date.parse(draft.savedAt) > serverTimestamp;
}

/** Reads and shape-checks a draft; expired or corrupt entries are dropped. */
export function readDraft<T>(storage: Storage, scope: string): EditorDraft<T> | null {
  const key = buildDraftKey(scope);
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as { savedAt?: unknown; payload?: unknown };
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (typeof parsed.savedAt !== 'string' || !('payload' in parsed)) return null;
    if (isDraftExpired(parsed.savedAt)) {
      storage.removeItem(key);
      return null;
    }
    return { savedAt: parsed.savedAt, payload: parsed.payload as T };
  } catch {
    // Corrupt JSON or storage disabled — treat as no draft.
    return null;
  }
}

/** Writes a draft; quota or storage errors are swallowed (recovery degrades silently). */
export function writeDraft<T>(storage: Storage, scope: string, payload: T): EditorDraft<T> {
  const draft: EditorDraft<T> = { savedAt: new Date().toISOString(), payload };
  try {
    storage.setItem(buildDraftKey(scope), JSON.stringify(draft));
  } catch {
    // Quota exceeded or storage disabled.
  }
  return draft;
}

export function removeDraft(storage: Storage, scope: string): void {
  try {
    storage.removeItem(buildDraftKey(scope));
  } catch {
    // Storage disabled.
  }
}

/** Moves a stored draft between scopes; a no-op when nothing is stored. */
export function moveDraft(storage: Storage, fromScope: string, toScope: string): void {
  try {
    const fromKey = buildDraftKey(fromScope);
    const raw = storage.getItem(fromKey);
    if (raw === null) return;
    storage.setItem(buildDraftKey(toScope), raw);
    storage.removeItem(fromKey);
  } catch {
    // Storage disabled.
  }
}
```

### Step 4: Run test to verify it passes

Run: `pnpm vitest run src/lib/editor-drafts/draft-storage.test.ts`
Expected: PASS (all tests).

### Step 5: Commit

```bash
git add src/lib/editor-drafts/draft-storage.ts src/lib/editor-drafts/draft-storage.test.ts
git commit -m "feat(editor-drafts): add pure draft storage helpers"
```

---

## Task 2: `use-editor-draft.ts` — debounced draft hook

**Files:**
- Create: `src/lib/editor-drafts/use-editor-draft.ts`
- Test: `src/lib/editor-drafts/use-editor-draft.test.ts`

### Step 1: Write the failing test

Create `src/lib/editor-drafts/use-editor-draft.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEditorDraft, WRITE_DEBOUNCE_MS } from './use-editor-draft';
import { buildDraftKey, writeDraft } from './draft-storage';

const storage = window.localStorage;

beforeEach(() => {
  storage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useEditorDraft', () => {
  it('hydrates a stored draft on mount', () => {
    writeDraft(storage, 'preparation:session-1', { contentJson: { type: 'doc' } });
    const { result } = renderHook(() => useEditorDraft<{ contentJson: object }>('preparation:session-1'));
    expect(result.current.draft?.payload.contentJson).toEqual({ type: 'doc' });
  });

  it('drops an expired draft on mount', () => {
    writeDraft(storage, 'preparation:session-1', { contentJson: { type: 'doc' } });
    const key = buildDraftKey('preparation:session-1');
    const raw = JSON.parse(storage.getItem(key)!) as { savedAt: string };
    storage.setItem(key, JSON.stringify({ ...raw, savedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() }));
    const { result } = renderHook(() => useEditorDraft<{ contentJson: object }>('preparation:session-1'));
    expect(result.current.draft).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });

  it('writes updates to storage after the debounce', () => {
    const { result } = renderHook(() => useEditorDraft<string>('preparation:session-1'));
    act(() => result.current.update('první verze'));
    expect(storage.getItem(buildDraftKey('preparation:session-1'))).toBeNull();
    act(() => { vi.advanceTimersByTime(WRITE_DEBOUNCE_MS); });
    const stored = JSON.parse(storage.getItem(buildDraftKey('preparation:session-1'))!);
    expect(stored.payload).toBe('první verze');
  });

  it('collapses rapid updates into one write', () => {
    const { result } = renderHook(() => useEditorDraft<string>('preparation:session-1'));
    act(() => {
      result.current.update('a');
      vi.advanceTimersByTime(WRITE_DEBOUNCE_MS - 1);
      result.current.update('b');
      vi.advanceTimersByTime(WRITE_DEBOUNCE_MS);
    });
    const stored = JSON.parse(storage.getItem(buildDraftKey('preparation:session-1'))!);
    expect(stored.payload).toBe('b');
  });

  it('flushes the pending update immediately', () => {
    const { result } = renderHook(() => useEditorDraft<string>('preparation:session-1'));
    act(() => { result.current.update('okamžitě'); });
    act(() => { result.current.flush(); });
    const stored = JSON.parse(storage.getItem(buildDraftKey('preparation:session-1'))!);
    expect(stored.payload).toBe('okamžitě');
  });

  it('flush without pending update writes nothing', () => {
    const { result } = renderHook(() => useEditorDraft<string>('preparation:session-1'));
    act(() => { result.current.flush(); });
    expect(storage.getItem(buildDraftKey('preparation:session-1'))).toBeNull();
  });

  it('discard clears storage, pending writes, and state', () => {
    writeDraft(storage, 'preparation:session-1', 'uložená');
    const { result } = renderHook(() => useEditorDraft<string>('preparation:session-1'));
    act(() => { result.current.update('rozepsaná'); });
    act(() => { result.current.discard(); });
    expect(result.current.draft).toBeNull();
    expect(storage.getItem(buildDraftKey('preparation:session-1'))).toBeNull();
    act(() => { vi.advanceTimersByTime(WRITE_DEBOUNCE_MS); });
    expect(storage.getItem(buildDraftKey('preparation:session-1'))).toBeNull();
  });

  it('flushes pending updates on pagehide', () => {
    const { result } = renderHook(() => useEditorDraft<string>('preparation:session-1'));
    act(() => { result.current.update('před zavřením'); });
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    const stored = JSON.parse(storage.getItem(buildDraftKey('preparation:session-1'))!);
    expect(stored.payload).toBe('před zavřením');
  });

  it('migrate moves the stored draft and future writes to the new scope', () => {
    writeDraft(storage, 'essay:nova', 'obsah');
    const { result } = renderHook(() => useEditorDraft<string>('essay:nova'));
    act(() => { result.current.migrate('essay:essay-1'); });
    expect(storage.getItem(buildDraftKey('essay:nova'))).toBeNull();
    expect(JSON.parse(storage.getItem(buildDraftKey('essay:essay-1'))!).payload).toBe('obsah');
    act(() => {
      result.current.update('novější');
      vi.advanceTimersByTime(WRITE_DEBOUNCE_MS);
    });
    expect(JSON.parse(storage.getItem(buildDraftKey('essay:essay-1'))!).payload).toBe('novější');
    expect(storage.getItem(buildDraftKey('essay:nova'))).toBeNull();
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm vitest run src/lib/editor-drafts/use-editor-draft.test.ts`
Expected: FAIL with `Failed to resolve import "./use-editor-draft"`.

### Step 3: Write the implementation

Create `src/lib/editor-drafts/use-editor-draft.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { moveDraft, readDraft, removeDraft, writeDraft, type EditorDraft } from './draft-storage';

export const WRITE_DEBOUNCE_MS = 1000;

export interface UseEditorDraftResult<T> {
  /** The hydrated draft (TTL-checked), or null when nothing is stored. */
  draft: EditorDraft<T> | null;
  /** Schedules a debounced write of the latest payload. */
  update: (payload: T) => void;
  /** Writes the pending payload immediately (pagehide safety net). */
  flush: () => void;
  /** Clears the stored draft and any pending write. */
  discard: () => void;
  /** Moves the stored draft to a new scope; future writes go there too. */
  migrate: (nextScope: string) => void;
}

/**
 * Persists an in-progress editor document to localStorage so an accidentally
 * closed tab can be recovered. Debounced writes keep the storage quiet while
 * typing; `pagehide`/`visibilitychange` listeners flush the last keystrokes
 * on mobile browsers that skip `beforeunload`.
 */
export function useEditorDraft<T>(scope: string): UseEditorDraftResult<T> {
  const [draft, setDraft] = useState<EditorDraft<T> | null>(null);
  const pendingRef = useRef<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const update = useCallback((payload: T) => {
    pendingRef.current = payload;
    clearTimer();
    timerRef.current = setTimeout(() => {
      const pending = pendingRef.current;
      if (pending === null) return;
      writeDraft(window.localStorage, scopeRef.current, pending);
    }, WRITE_DEBOUNCE_MS);
  }, [clearTimer]);

  const flush = useCallback(() => {
    clearTimer();
    const pending = pendingRef.current;
    if (pending === null) return;
    writeDraft(window.localStorage, scopeRef.current, pending);
  }, [clearTimer]);

  const discard = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
    removeDraft(window.localStorage, scopeRef.current);
    setDraft(null);
  }, [clearTimer]);

  const migrate = useCallback((nextScope: string) => {
    if (nextScope === scopeRef.current) return;
    moveDraft(window.localStorage, scopeRef.current, nextScope);
    scopeRef.current = nextScope;
  }, []);

  // Hydrate on mount / scope change.
  useEffect(() => {
    const stored = readDraft<T>(window.localStorage, scope);
    if (stored !== null) setDraft(stored);
  }, [scope]);

  // Last-chance flush when the page is hidden or unloaded.
  useEffect(() => {
    const onHide = () => {
      clearTimer();
      const pending = pendingRef.current;
      if (pending === null) return;
      writeDraft(window.localStorage, scopeRef.current, pending);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [clearTimer]);

  return { draft, update, flush, discard, migrate };
}
```

### Step 4: Run test to verify it passes

Run: `pnpm vitest run src/lib/editor-drafts/use-editor-draft.test.ts`
Expected: PASS (all tests).

### Step 5: Commit

```bash
git add src/lib/editor-drafts/use-editor-draft.ts src/lib/editor-drafts/use-editor-draft.test.ts
git commit -m "feat(editor-drafts): add debounced useEditorDraft hook"
```

---

## Task 3: `draft-recovery-banner.tsx` — the recovery UI

**Files:**
- Create: `src/components/editor-drafts/draft-recovery-banner.tsx`
- Test: `src/components/editor-drafts/draft-recovery-banner.test.tsx`

### Step 1: Write the failing test

Create `src/components/editor-drafts/draft-recovery-banner.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DraftRecoveryBanner, formatDraftTime } from './draft-recovery-banner';

describe('formatDraftTime', () => {
  it('shows only the time for a same-day draft', () => {
    const savedAt = new Date(2026, 10, 19, 14, 32).toISOString();
    const now = new Date(2026, 10, 19, 20, 0);
    expect(formatDraftTime(savedAt, now)).toBe('14:32');
  });

  it('shows date and time once the day changed', () => {
    const savedAt = new Date(2026, 10, 18, 9, 5).toISOString();
    const now = new Date(2026, 10, 19, 20, 0);
    expect(formatDraftTime(savedAt, now)).toBe('18. 11. 09:05');
  });
});

describe('DraftRecoveryBanner', () => {
  // Deterministic "now" so the same-day assertion holds in any timezone and after midnight.
  const now = new Date(2026, 10, 19, 20, 0);

  it('offers restore and discard with the draft time', async () => {
    const onRestore = vi.fn();
    const onDiscard = vi.fn();
    const user = userEvent.setup();
    render(
      <DraftRecoveryBanner
        savedAt={new Date(2026, 10, 19, 14, 32).toISOString()}
        now={now}
        wordCount={120}
        onRestore={onRestore}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByText(/Máš rozepsaný text z 14:32/)).toBeInTheDocument();
    expect(screen.getByText(/120 slov/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Obnovit' }));
    expect(onRestore).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('hides the word count when none is given', () => {
    render(
      <DraftRecoveryBanner
        savedAt={new Date(2026, 10, 19, 14, 32).toISOString()}
        now={now}
        onRestore={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.queryByText(/slov/)).not.toBeInTheDocument();
  });
});
```

Note: `formatWordCount(120)` in this repo returns `"120 slov"` (cs-CZ), so the `/120 slov/` assertion is correct. The `formatDraftTime` tests construct dates in LOCAL time, so the expected strings are TZ-independent. Always pass an explicit `now` when asserting the rendered time — never rely on the real clock.

### Step 2: Run test to verify it fails

Run: `pnpm vitest run src/components/editor-drafts/draft-recovery-banner.test.tsx`
Expected: FAIL with `Failed to resolve import "./draft-recovery-banner"`.

### Step 3: Write the implementation

Create `src/components/editor-drafts/draft-recovery-banner.tsx`:

```tsx
'use client';

import { History } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatWordCount } from '@/lib/essays/text-stats';

interface DraftRecoveryBannerProps {
  savedAt: string;
  /** Shown as "· 120 slov" when provided and non-zero. */
  wordCount?: number;
  /** Test/SSR determinism hook; defaults to the current time. */
  now?: Date;
  onRestore: () => void;
  onDiscard: () => void;
}

/** "z 14:32" for a same-day draft, "z 18. 11. 09:05" once it crosses midnight. */
export function formatDraftTime(savedAt: string, now = new Date()): string {
  const saved = new Date(savedAt);
  if (Number.isNaN(saved.getTime())) return '';
  const time = saved.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  if (saved.toDateString() === now.toDateString()) return time;
  const date = saved.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
  return `${date} ${time}`;
}

/**
 * Notice above an editor offering to recover a draft saved in this browser.
 * Render only after mount: time formatting is viewer-local, so an SSR render
 * would hydrate-mismatch on the time.
 */
export function DraftRecoveryBanner({ savedAt, wordCount, now, onRestore, onDiscard }: DraftRecoveryBannerProps) {
  const showWordCount = wordCount !== undefined && wordCount > 0;

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <History className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">Máš rozepsaný text z {formatDraftTime(savedAt, now)}</p>
          <p className="text-xs text-muted-foreground">
            {showWordCount ? `${formatWordCount(wordCount)} · ` : ''}
            Neuložený text zůstal v tomto prohlížeči.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
        <Button type="button" size="sm" onClick={onRestore}>Obnovit</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>Zahodit</Button>
      </div>
    </div>
  );
}
```

### Step 4: Run test to verify it passes

Run: `pnpm vitest run src/components/editor-drafts/draft-recovery-banner.test.tsx`
Expected: PASS. (If the time assertion fails, the environment TZ shifts `toLocaleTimeString` — adjust the expected string to match `cs-CZ` output in the local TZ, keeping both assertions internally consistent with `formatDraftTime`'s own logic.)

### Step 5: Commit

```bash
git add src/components/editor-drafts/draft-recovery-banner.tsx src/components/editor-drafts/draft-recovery-banner.test.tsx
git commit -m "feat(editor-drafts): add draft recovery banner"
```

---

## Task 4: Wire essays (`essay-editor-form.tsx`)

**Files:**
- Modify: `src/components/essays/essay-editor-form.tsx`
- Modify: `src/app/(main)/cteni/eseje/nova/page.tsx`
- Test: `src/components/essays/essay-editor-form.test.tsx`

### Step 1: Write the failing tests

Append to the existing `describe` blocks in `src/components/essays/essay-editor-form.test.tsx`. First add imports at the top:

```ts
import { buildDraftKey, writeDraft } from '@/lib/editor-drafts/draft-storage';
```

Then add a new `describe` block (before the final line of the file):

```ts
describe('EssayEditorForm — draft recovery', () => {
  const essayScope = 'essay:essay-1';

  function seedDraft(scope: string, savedAt: string, payload: Record<string, unknown>) {
    window.localStorage.setItem(buildDraftKey(scope), JSON.stringify({ savedAt, payload }));
  }

  const EMPTY_PAYLOAD = {
    title: '', contentJson: { type: 'doc' }, contentText: '',
    bookId: null, contentSourceId: null, book: null, contentSource: null,
  };

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('offers to restore a newer draft and fills the form on Obnovit', async () => {
    seedDraft(essayScope, new Date().toISOString(), {
      ...EMPTY_PAYLOAD,
      title: 'Obnovený název',
      contentText: 'Obnovený text',
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm initialEssay={draftEssay} />);

    expect(screen.getByText(/Máš rozepsaný text z/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Obnovit' }));

    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Název eseje')).toHaveValue('Obnovený název');
    expect(screen.getByLabelText('Text eseje')).toHaveValue('Obnovený text');
  });

  it('Zahodit removes the stored draft and hides the banner', async () => {
    seedDraft(essayScope, new Date().toISOString(), EMPTY_PAYLOAD);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm initialEssay={draftEssay} />);

    await user.click(screen.getByRole('button', { name: 'Zahodit' }));

    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem(buildDraftKey(essayScope))).toBeNull();
  });

  it('stays silent when the server copy is newer than the draft', async () => {
    seedDraft(essayScope, '2026-07-01T10:00:00Z', EMPTY_PAYLOAD);

    render(<EssayEditorForm initialEssay={{ ...draftEssay, updated_at: '2026-08-01T10:00:00Z' }} />);

    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument();
  });

  it('offers a draft on /nova, where no server copy exists', async () => {
    seedDraft('essay:nova:profile-1', new Date().toISOString(), {
      ...EMPTY_PAYLOAD,
      title: 'Nový náčrt',
      contentText: 'text',
    });

    render(<EssayEditorForm profileId="profile-1" />);

    expect(screen.getByText(/Máš rozepsaný text z/)).toBeInTheDocument();
  });

  it('keeps /nova drafts separate per profile', async () => {
    seedDraft('essay:nova:profile-2', new Date().toISOString(), {
      ...EMPTY_PAYLOAD,
      title: 'Cizí náčrt',
      contentText: 'text',
    });

    render(<EssayEditorForm profileId="profile-1" />);

    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument();
  });

  it('writes the draft to localStorage while typing', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm profileId="profile-1" />);

    await user.type(screen.getByLabelText('Název eseje'), 'Rozepsaná esej');
    await vi.advanceTimersByTimeAsync(1500);

    const raw = window.localStorage.getItem(buildDraftKey('essay:nova:profile-1'));
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).payload.title).toBe('Rozepsaná esej');
  });

  it('clears the draft once a save lands', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ data: { id: 'essay-1' } }, 201));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<EssayEditorForm profileId="profile-1" />);
    await user.type(screen.getByLabelText('Název eseje'), 'Uložená esej');
    await vi.advanceTimersByTimeAsync(1500);
    expect(window.localStorage.getItem(buildDraftKey('essay:nova:profile-1'))).not.toBeNull();

    await user.click(saveButton());
    await waitFor(() => {
      const creates = fetchSpy.mock.calls.filter(([url]) => url === '/api/essays');
      expect(creates).toHaveLength(1);
    });
    await vi.advanceTimersByTimeAsync(100);

    expect(window.localStorage.getItem(buildDraftKey('essay:nova:profile-1'))).toBeNull();
  });
});
```

(These tests use the jsdom default already active for `src/components/**/*.test.tsx`, so no environment docblock is needed here.)

### Step 2: Run test to verify it fails

Run: `pnpm vitest run src/components/essays/essay-editor-form.test.tsx`
Expected: FAIL — new tests error (missing imports / banner never rendered).

### Step 3: Write the implementation

In `src/components/essays/essay-editor-form.tsx`:

1. Add imports (alphabetical within groups):

```ts
import { DraftRecoveryBanner } from '@/components/editor-drafts/draft-recovery-banner';
import { isDraftNewerThan } from '@/lib/editor-drafts/draft-storage';
import { useEditorDraft } from '@/lib/editor-drafts/use-editor-draft';
import { extractPlainTextFromContentJson } from '@/lib/essays/content-text';
```

(Note: `normalizeContentJson` and `EMPTY_DOC` are already imported; extend that import with `extractPlainTextFromContentJson`.)

2. Add the payload interface and the `profileId` prop:

```ts
interface EssayEditorFormProps {
  initialEssay?: EssayWithDetails;
  /** Scopes the /nova draft so a shared machine never leaks one account's draft to another. */
  profileId?: string;
}

interface EssayDraftPayload {
  title: string;
  contentJson: object;
  contentText: string;
  bookId: string | null;
  contentSourceId: string | null;
  book: BookSearchResult | null;
  contentSource: ContentSource | null;
}
```

3. Destructure `profileId` in the component signature and add it to `latestRef` bookkeeping. Inside the component, right after the `creatingRef` declaration, extend `latestRef` with the selected objects and add the draft wiring:

```ts
const latestRef = useRef({
  title,
  content,
  bookId: selectedBook?.id ?? null,
  contentSourceId: selectedSource?.id ?? null,
  essayId,
  book: selectedBook as BookSearchResult | null,
  contentSource: selectedSource as ContentSource | null,
});
latestRef.current = {
  title,
  content,
  bookId: selectedBook?.id ?? null,
  contentSourceId: selectedSource?.id ?? null,
  essayId,
  book: selectedBook as BookSearchResult | null,
  contentSource: selectedSource as ContentSource | null,
};

const creatingRef = useRef(false);

// Recovery net: the draft outlives tab closes and crashes. The scope is
// derived from the initial essay only, so it is stable across the create
// flow (where `migrate` moves the stored draft once the id exists).
const draftScope = initialEssay?.id
  ? `essay:${initialEssay.id}`
  : `essay:nova:${profileId ?? 'anonymous'}`;
const { draft, update, discard, migrate } = useEditorDraft<EssayDraftPayload>(draftScope);
const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);

const scheduleDraft = useCallback(() => {
  const latest = latestRef.current;
  update({
    title: latest.title,
    contentJson: latest.content.json,
    contentText: latest.content.text,
    bookId: latest.bookId,
    contentSourceId: latest.contentSourceId,
    book: latest.book,
    contentSource: latest.contentSource,
  });
}, [update]);
```

4. In the POST branch of `persist`, after `setEssayId(data.id)` / `latestRef.current.essayId = data.id`, migrate the draft:

```ts
migrate(`essay:${data.id}`);
```

(`persist`'s dependency array becomes `[migrate]`.)

5. Call `scheduleDraft()` at the end of `handleContentChange`, `handleTitleChange`, `handleBookChange`, and `handleSourceChange` (after `markDirty()`); add it to each callback's dependency array.

6. After `const guard = useUnsavedChangesGuard(...)`, add the clear-on-save effect and the restore handler:

```ts
// A save that caught up with every edit makes the local draft redundant.
const draftCaughtUp = status === 'saved' && !isDirty;
const prevDraftCaughtUpRef = useRef(false);
useEffect(() => {
  if (draftCaughtUp && !prevDraftCaughtUpRef.current) discard();
  prevDraftCaughtUpRef.current = draftCaughtUp;
}, [draftCaughtUp, discard]);

const handleRestoreDraft = useCallback(() => {
  if (!draft) return;
  const payload = draft.payload;
  const json = normalizeContentJson(payload.contentJson);
  const text = typeof payload.contentText === 'string'
    ? payload.contentText
    : extractPlainTextFromContentJson(json);
  setTitle(payload.title ?? '');
  setContent({ json, text });
  setSelectedBook(payload.book ?? null);
  setSelectedSource(payload.contentSource ?? null);
  latestRef.current.title = payload.title ?? '';
  latestRef.current.content = { json, text };
  latestRef.current.bookId = payload.bookId ?? null;
  latestRef.current.contentSourceId = payload.contentSourceId ?? null;
  latestRef.current.book = payload.book ?? null;
  latestRef.current.contentSource = payload.contentSource ?? null;
  markDirty();
  setDraftBannerDismissed(true);
}, [draft, markDirty]);
```

7. Compute the banner flag and render the banner between `</header>` and the source selector `<section>`:

```ts
const showDraftBanner = draft !== null
  && !draftBannerDismissed
  && isDraftNewerThan(draft, initialEssay?.updated_at ?? null);
```

```tsx
{showDraftBanner && draft !== null && (
  <DraftRecoveryBanner
    savedAt={draft.savedAt}
    wordCount={countWords(draft.payload.contentText)}
    onRestore={handleRestoreDraft}
    onDiscard={() => {
      discard();
      setDraftBannerDismissed(true);
    }}
  />
)}
```

8. Pass the profile id from the nova page. In `src/app/(main)/cteni/eseje/nova/page.tsx`, follow the edit page's pattern:

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { EssayEditorForm } from '@/components/essays/essay-editor-form';
import { PageShell } from '@/components/ui/page-shell';

export default async function NovaEsejPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });

  return (
    <PageShell size="wide">
      {/* The visible document title is the editor's own title field, so the
          page heading only needs to exist for assistive technology. */}
      <h1 className="sr-only">Napsat esej</h1>
      <EssayEditorForm profileId={profile?.id} />
    </PageShell>
  );
}
```

(Check the exact `getCurrentUserProfile` signature in `src/lib/auth-helpers.ts` and mirror how the edit page calls it. If the page previously had no auth guard, keep the redirect behavior consistent with `/cteni/eseje/[essayId]/upravit`.)

### Step 4: Run test to verify it passes

Run: `pnpm vitest run src/components/essays/essay-editor-form.test.tsx`
Expected: PASS (old + new tests).

### Step 5: Commit

```bash
git add src/components/essays/essay-editor-form.tsx src/components/essays/essay-editor-form.test.tsx
git commit -m "feat(essays): recover unsaved essays from a local draft"
```

---

## Task 5: Wire TS preparation (`preparation-panel.tsx`)

**Files:**
- Modify: `src/components/training-sessions/preparation-panel.tsx`
- Test: `src/components/training-sessions/preparation-panel.test.tsx`

### Step 1: Write the failing tests

Append to `src/components/training-sessions/preparation-panel.test.tsx`. Add imports:

```ts
import { buildDraftKey, writeDraft } from "@/lib/editor-drafts/draft-storage"
```

Then add a `describe` block:

```ts
describe("PreparationPanel draft recovery", () => {
  const scope = "preparation:session-1"

  beforeEach(() => {
    window.localStorage.clear()
  })

  it("offers to restore a draft and saves the restored content", async () => {
    writeDraft(window.localStorage, scope, { contentJson: RICH_DOC })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)
    renderPanel(null)

    expect(screen.getByText(/Máš rozepsaný text z/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Obnovit" }))
    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Uložit" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/training-sessions/session-1/preparation",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ contentJson: RICH_DOC }),
        }),
      )
    })
  })

  it("Zahodit clears the draft and hides the banner", async () => {
    writeDraft(window.localStorage, scope, { contentJson: RICH_DOC })
    vi.stubGlobal("fetch", vi.fn())
    renderPanel(null)

    fireEvent.click(screen.getByRole("button", { name: "Zahodit" }))

    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument()
    expect(window.localStorage.getItem(buildDraftKey(scope))).toBeNull()
  })

  it("stays silent when the published copy is newer than the draft", () => {
    window.localStorage.setItem(buildDraftKey(scope), JSON.stringify({
      savedAt: "2026-08-01T10:00:00Z",
      payload: { contentJson: RICH_DOC },
    }))
    renderPanel(RICH_DOC)

    // publishedAt (2026-11-16) is newer than the draft.
    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument()
  })

  it("viewers never see the recovery banner", () => {
    writeDraft(window.localStorage, scope, { contentJson: RICH_DOC })
    render(
      <PreparationPanel
        sessionId="session-1"
        topic="Knihy 3v1"
        canEdit={false}
        upcoming
        contentJson={RICH_DOC}
        publishedAt="2026-11-16T07:00:00.000Z"
        attachments={[]}
        startsAt="2026-11-16T07:00:00.000Z"
        endsAt="2026-11-16T11:00:00.000Z"
        facilitatorNames={[]}
      />,
    )

    expect(screen.queryByText(/Máš rozepsaný text z/)).not.toBeInTheDocument()
  })
})
```

Note: the existing `renderPanel(contentJson)` passes `publishedAt={null}`. The newest test passes a real `publishedAt` by rendering directly.

### Step 2: Run test to verify it fails

Run: `pnpm vitest run src/components/training-sessions/preparation-panel.test.tsx`
Expected: FAIL — new tests error (banner never rendered / missing imports).

### Step 3: Write the implementation

In `src/components/training-sessions/preparation-panel.tsx`:

1. Add imports:

```ts
import { DraftRecoveryBanner } from "@/components/editor-drafts/draft-recovery-banner"
import { isDraftNewerThan } from "@/lib/editor-drafts/draft-storage"
import { useEditorDraft } from "@/lib/editor-drafts/use-editor-draft"
import { countWords } from "@/lib/essays/text-stats"
import { contentTextFromJson, EMPTY_DOC, normalizeContentJson } from "@/lib/essays/content-text"
```

(`contentTextFromJson` and `EMPTY_DOC` are already imported — extend that import with `normalizeContentJson`.)

2. Add a payload type near the top:

```ts
interface PreparationDraftPayload {
  contentJson: object;
}
```

3. In the component body, next to the existing refs/effects (before the `if (!canEdit)` return — hooks must run unconditionally):

```ts
// Recovery net: mirrors the doc into localStorage so a closed tab does not
// eat the preparation. Viewers hydrate it too but never render the banner.
const { draft, update, discard } = useEditorDraft<PreparationDraftPayload>(`preparation:${sessionId}`)
const [draftBannerDismissed, setDraftBannerDismissed] = useState(false)
const docRef = useRef(doc)
docRef.current = doc
```

4. In `saveNow()`, capture what is being saved and clear the draft only when the editor still holds exactly that content:

```ts
async function saveNow() {
  setPending(true)
  const saving = docRef.current
  try {
    const res = await fetch(`/api/training-sessions/${sessionId}/preparation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentJson: saving }),
    })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      toast.error(body.error ?? SAVE_ERROR_MESSAGE)
      return
    }
    // The saved content is safely on the server; the local draft is redundant
    // unless the person kept typing while the save was in flight.
    if (JSON.stringify(docRef.current) === JSON.stringify(saving)) discard()
    toast.success(SAVE_SUCCESS_MESSAGE)
    router.refresh()
  } catch {
    toast.error(SAVE_ERROR_MESSAGE)
  } finally {
    setPending(false)
  }
}
```

5. In the editor's `onChange`, mirror into the draft:

```tsx
<TiptapEditor
  initialContent={doc}
  onChange={(json) => {
    setDoc(json)
    update({ contentJson: json })
  }}
  placeholder="Co je potřeba si připravit, přečíst nebo promyslet předem?"
/>
```

6. Compute the banner flag (before `return`, next to `showLinkHint`) and render the banner above the editor inside the edit branch:

```ts
const showDraftBanner = draft !== null
  && !draftBannerDismissed
  && isDraftNewerThan(draft, publishedAt)
```

```tsx
{showDraftBanner && draft !== null && (
  <DraftRecoveryBanner
    savedAt={draft.savedAt}
    wordCount={countWords(contentTextFromJson(draft.payload.contentJson))}
    onRestore={() => {
      setDoc(normalizeContentJson(draft.payload.contentJson))
      setDraftBannerDismissed(true)
    }}
    onDiscard={() => {
      discard()
      setDraftBannerDismissed(true)
    }}
  />
)}
```

Place it as the first child of the `<div className="space-y-3">` that holds the editor.

### Step 4: Run test to verify it passes

Run: `pnpm vitest run src/components/training-sessions/preparation-panel.test.tsx`
Expected: PASS (old + new tests).

### Step 5: Commit

```bash
git add src/components/training-sessions/preparation-panel.tsx src/components/training-sessions/preparation-panel.test.tsx
git commit -m "feat(ts): recover unsaved preparation from a local draft"
```

---

## Task 6: Full verification

### Step 1: Run the fast test suite

Run: `pnpm test`
Expected: PASS (unit + component layers).

### Step 2: Typecheck

Run: `pnpm typecheck`
Expected: PASS.

### Step 3: Lint

Run: `pnpm lint`
Expected: PASS (fix any findings, then re-run).

### Step 4: Manual smoke (dev server)

Run `pnpm dev`, then:
1. Open an essay edit page, type, close the tab without saving, reopen → banner appears; Obnovit restores text; Zahodit clears.
2. Same for a TS preparation page.
3. Verify both light and dark themes show the banner legibly.

### Step 5: Commit any final fixes

```bash
git add -A && git commit -m "chore: address review findings"
```
