import { describe, expect, it } from 'vitest';

import { buildLabelLookup, RESCAN_COOLDOWN_MS, shouldReportScan } from './scan-session';

describe('buildLabelLookup', () => {
  it('maps each label code to its book title', () => {
    const lookup = buildLabelLookup([
      { code: 7, title: 'Atomové návyky' },
      { code: 12, title: 'Pirátská ekonomika' },
    ]);

    expect(lookup.get(7)).toBe('Atomové návyky');
    expect(lookup.get(12)).toBe('Pirátská ekonomika');
  });

  it('does not contain codes that were never assigned', () => {
    const lookup = buildLabelLookup([{ code: 7, title: 'Atomové návyky' }]);

    expect(lookup.has(99)).toBe(false);
  });
});

describe('shouldReportScan', () => {
  it('reports the first scan of a session', () => {
    expect(shouldReportScan(null, 'https://tiimi.cz/l/7', 1_000)).toBe(true);
  });

  it('reports a different code right away', () => {
    expect(shouldReportScan({ key: 'a', at: 1_000 }, 'b', 1_100)).toBe(true);
  });

  it('suppresses the same code while it stays in the camera frame', () => {
    expect(shouldReportScan({ key: 'a', at: 1_000 }, 'a', 1_000 + RESCAN_COOLDOWN_MS - 1)).toBe(
      false,
    );
  });

  it('reports the same code again after it leaves the frame', () => {
    expect(shouldReportScan({ key: 'a', at: 1_000 }, 'a', 1_000 + RESCAN_COOLDOWN_MS)).toBe(true);
  });
});
