// @vitest-environment jsdom
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
