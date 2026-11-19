// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
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
    expect(readDraft<{ title: string }>(storage, 'essay:nova')?.payload.title).toBe('Čerstvý');
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
