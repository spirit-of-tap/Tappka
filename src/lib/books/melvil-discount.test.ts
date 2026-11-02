import { describe, expect, it } from 'vitest';

import { isMelvilDiscountLive } from './melvil-discount';

describe('isMelvilDiscountLive', () => {
  it('is hidden before 4. 11. 2026 12:00 Prague time', () => {
    expect(isMelvilDiscountLive(new Date('2026-11-04T10:59:59Z'))).toBe(false);
  });

  it('is live from 4. 11. 2026 12:00 Prague time on', () => {
    expect(isMelvilDiscountLive(new Date('2026-11-04T11:00:00Z'))).toBe(true);
    expect(isMelvilDiscountLive(new Date('2026-12-01T12:00:00Z'))).toBe(true);
  });
});
