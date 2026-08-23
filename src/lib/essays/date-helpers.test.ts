import { describe, expect, it } from 'vitest';
import { formatRelativeTime, isRecentEssay } from './date-helpers';

describe('date-helpers', () => {
  it('formats very recent dates as právě teď or minutes', () => {
    const now = new Date();
    expect(formatRelativeTime(now.toISOString())).toBe('právě teď');

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    expect(formatRelativeTime(tenMinAgo.toISOString())).toBe('před 10 min');
  });

  it('formats hours and days', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoHoursAgo.toISOString())).toBe('před 2 h');

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeDaysAgo.toISOString())).toBe('před 3 dny');
  });

  it('identifies recent essays within 48 hours', () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isRecentEssay(oneDayAgo.toISOString())).toBe(true);

    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    expect(isRecentEssay(fourDaysAgo.toISOString())).toBe(false);
  });
});
