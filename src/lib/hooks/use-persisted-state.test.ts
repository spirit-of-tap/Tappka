// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedState } from './use-persisted-state';

describe('usePersistedState', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('initializes with defaultValue when storage is empty', () => {
    const { result } = renderHook(() => usePersistedState('test-key', 'default-val'));
    expect(result.current[0]).toBe('default-val');
    expect(result.current[2]).toBe(true); // isHydrated
  });

  it('hydrates stored value from localStorage on mount', () => {
    window.localStorage.setItem('test-key', JSON.stringify('stored-val'));
    const { result } = renderHook(() => usePersistedState('test-key', 'default-val'));
    expect(result.current[0]).toBe('stored-val');
  });

  it('updates state and localStorage on setState', () => {
    const { result } = renderHook(() => usePersistedState('test-key', 'initial'));

    act(() => {
      result.current[1]('updated');
    });

    expect(result.current[0]).toBe('updated');
    expect(JSON.parse(window.localStorage.getItem('test-key') ?? '""')).toBe('updated');
  });

  it('supports functional updater pattern in setState', () => {
    const { result } = renderHook(() => usePersistedState<number>('test-count', 10));

    act(() => {
      result.current[1]((prev) => prev + 5);
    });

    expect(result.current[0]).toBe(15);
    expect(JSON.parse(window.localStorage.getItem('test-count') ?? '0')).toBe(15);
  });

  it('works with sessionStorage when configured', () => {
    window.sessionStorage.setItem('session-key', JSON.stringify('session-val'));
    const { result } = renderHook(() =>
      usePersistedState('session-key', 'default-val', { storage: 'sessionStorage' }),
    );

    expect(result.current[0]).toBe('session-val');

    act(() => {
      result.current[1]('new-session-val');
    });

    expect(result.current[0]).toBe('new-session-val');
    expect(JSON.parse(window.sessionStorage.getItem('session-key') ?? '""')).toBe('new-session-val');
  });

  it('gracefully handles corrupted JSON in storage', () => {
    window.localStorage.setItem('bad-json', '{invalid json');
    const { result } = renderHook(() => usePersistedState('bad-json', 'safe-fallback'));

    expect(result.current[0]).toBe('safe-fallback');
  });
});
