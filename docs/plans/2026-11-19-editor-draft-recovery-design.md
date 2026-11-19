# Local draft recovery for essays and TS preparation

**Date:** 2026-11-19

## Goal

Protect long-form writing from accidental loss. When someone closes the tab,
navigates away mid-sentence, or the browser crashes while writing an essay or
a training-session preparation, the unsaved text can be recovered from
localStorage the next time they open the same page.

Today essays save only manually (button / Ctrl+S) and TS preparation saves
only manually too. The `beforeunload` guard and the in-app unsaved-changes
dialog help, but people click through them or the browser skips them — and
neither protects against a crash.

## What changes

### Shared building blocks

`src/lib/editor-drafts/use-editor-draft.ts` — a `'use client'` hook:

```ts
interface EditorDraft<T> { savedAt: string; payload: T }
useEditorDraft<T>(key: string) => {
  draft: EditorDraft<T> | null,   // hydrated from localStorage, TTL-checked
  update: (payload: T) => void,   // debounced ~1s write
  flush: () => void,              // immediate write
  discard: () => void,            // clears the key
}
```

- Storage key: `tappka:draft:<key>`, value `{ savedAt: ISO, payload }`.
- Writes are debounced ~1s; `flush()` runs on `pagehide`/`visibilitychange`
  so mobile Safari gets the last keystrokes even though it does not reliably
  fire `beforeunload`.
- Reads drop drafts older than 14 days (TTL, lazy expiry on read only).
- Corrupt JSON, quota errors, and disabled storage are caught silently —
  the feature degrades to "no recovery" without breaking the editor.

`src/components/editor-drafts/draft-recovery-banner.tsx` — presentational
banner: "Máš rozepsaný text z 14:32" with optional word count, buttons
**Obnovit** and **Zahodit**. The parent decides whether to show it.

### Essays

`src/components/essays/essay-editor-form.tsx`:

- Key: `tappka:draft:essay:<id>`, or `tappka:draft:essay:nova` on the
  new-essay page (an unsaved new essay has no id).
- Payload: `{ title, contentJson, contentText, bookId, contentSourceId }` —
  restoring brings back the title and the book/source picker, not just the
  prose.
- Updated on every title/content/book/source change.
- Cleared on a successful save (server == local at that point), on
  "Zahodit", and when the essay is deleted.
- Banner appears on mount when a draft exists and its `savedAt` is newer
  than `initialEssay.updated_at`. Server copy newer → silent drop.
- Restore puts the payload into form state and marks it dirty; the existing
  save flow takes over. No new save path.

### TS preparation

`src/components/training-sessions/preparation-panel.tsx`:

- Key: `tappka:draft:preparation:<sessionId>`.
- Payload: `{ contentJson }`.
- Updated on every editor change; cleared after a successful save and on
  "Zahodit".
- Banner appears when a draft exists and `savedAt` is newer than the server
  `publishedAt`. Only in the `canEdit` branch.

## Non-goals

- No draft support for other editors (team reflection already autosaves per
  field to the server; other forms hold short text).
- No cross-tab sync via `storage` events — last-write-wins is enough.
- No draft recovery UI beyond the banner (no history list of drafts, no
  automatic merge with newer server content).
- The banner is a recovery layer *under* the existing beforeunload and
  unsaved-changes warnings, not a replacement for them.

## Edge cases

- Stale draft on `/nova`: starting a second new essay still offers the
  previous one. Intentional — an unsaved new essay exists only locally;
  "Zahodit" dismisses it in one click.
- After restore, the key keeps updating while the text is still unsaved and
  clears on the first successful save. Closing again before saving works
  again.
- Multi-account on a shared machine: essay ids are per-user, so drafts
  cannot collide across accounts.

## Copy

Gender-neutral Czech: "Máš rozepsaný text z 14:32", "Obnovit", "Zahodit" —
no generic masculine.

## Testing

- Unit (`src/lib/editor-drafts/use-editor-draft.test.ts`): debounce, flush,
  TTL expiry, corrupt JSON, quota errors.
- Component (`draft-recovery-banner.test.tsx` + additions to
  `essay-editor-form.test.tsx` and `preparation-panel.test.tsx`): banner
  renders with time/word count, Obnovit/Zahodit wire up, banner suppressed
  when the server copy is newer, only editors see it.
