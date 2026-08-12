import { describe, expect, it } from 'vitest';

import { formatPoints, formatPointsWithLabel, pointsNumber, suggestedBookPoints } from './points';

describe('pointsNumber', () => {
  it('coerces the string PostgREST returns for a numeric column', () => {
    expect(pointsNumber('2.00')).toBe(2);
  });

  it('floors junk and nulls at zero rather than producing NaN', () => {
    expect(pointsNumber(null)).toBe(0);
    expect(pointsNumber('abc')).toBe(0);
    expect(pointsNumber(-4)).toBe(0);
  });
});

describe('formatPoints', () => {
  it('keeps whole numbers undecorated and gives fractions a Czech comma', () => {
    expect(formatPoints('3.00')).toBe('3');
    expect(formatPoints(0.33)).toBe('0,33');
  });
});

describe('formatPointsWithLabel', () => {
  it('declines "bod" for each Czech numeric class', () => {
    expect(formatPointsWithLabel(1)).toBe('1 bod');
    expect(formatPointsWithLabel(2)).toBe('2 body');
    expect(formatPointsWithLabel(5)).toBe('5 bodů');
  });
});

describe('suggestedBookPoints', () => {
  it('falls back to 1 when the book carries no score', () => {
    expect(suggestedBookPoints(null)).toBe(1);
    expect(suggestedBookPoints(undefined)).toBe(1);
    expect(suggestedBookPoints(0)).toBe(1);
  });

  it('reads the string form the DB actually returns', () => {
    expect(suggestedBookPoints('2.00')).toBe(2);
    expect(suggestedBookPoints('3.00')).toBe(3);
  });

  it('rounds legacy fractional scores into the 1-3 range', () => {
    expect(suggestedBookPoints(0.33)).toBe(1);
    expect(suggestedBookPoints(1.5)).toBe(2);
    expect(suggestedBookPoints(2.5)).toBe(3);
  });

  it('clamps out-of-range scores instead of leaking them to the classify route', () => {
    expect(suggestedBookPoints(5)).toBe(3);
    expect(suggestedBookPoints(-1)).toBe(1);
  });
});
