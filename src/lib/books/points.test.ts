import { describe, expect, it } from 'vitest';

import {
  formatPoints,
  formatPointsWithLabel,
  pointsNumber,
  suggestedBookPoints,
  suggestedReviewPoints,
} from './points';

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

describe('suggestedReviewPoints', () => {
  it('has no suggestion for a book nothing scored', () => {
    expect(suggestedReviewPoints(null)).toBeNull();
    expect(suggestedReviewPoints(undefined)).toBeNull();
  });

  it("keeps a stored 0, because 0 is the AI's rejection", () => {
    expect(suggestedReviewPoints(0)).toBe(0);
    expect(suggestedReviewPoints('0.00')).toBe(0);
  });

  it('reads the string form the DB actually returns', () => {
    expect(suggestedReviewPoints('2.00')).toBe(2);
    expect(suggestedReviewPoints('3.00')).toBe(3);
  });

  it('rounds legacy fractional scores without inventing a rejection', () => {
    expect(suggestedReviewPoints(0.33)).toBe(0);
    expect(suggestedReviewPoints(1.5)).toBe(2);
  });

  it('clamps out-of-range scores instead of leaking them to the classify route', () => {
    expect(suggestedReviewPoints(5)).toBe(3);
    expect(suggestedReviewPoints(-1)).toBe(0);
  });
});

describe('suggestedBookPoints', () => {
  it('never offers 0 — a list move cannot reject a book', () => {
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
