import { describe, expect, it } from 'vitest';
import { defaultContentSourcePoints, CONTENT_SOURCE_POINT_VALUES } from './points';

describe('defaultContentSourcePoints', () => {
  it('pre-fills 0.5 for a podcast', () => {
    expect(defaultContentSourcePoints('podcast')).toBe(0.5);
  });

  it('has no pre-fill for conference, program, or other', () => {
    expect(defaultContentSourcePoints('conference')).toBeNull();
    expect(defaultContentSourcePoints('program')).toBeNull();
    expect(defaultContentSourcePoints('other')).toBeNull();
  });

  it('exposes the allowed point values', () => {
    expect(CONTENT_SOURCE_POINT_VALUES).toEqual([0, 0.5, 1, 2, 3]);
  });
});
