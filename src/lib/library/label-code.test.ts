import { describe, expect, it } from 'vitest';

import { formatLibraryLabelCode, parseLibraryLabelCode } from './label-code';

describe('parseLibraryLabelCode', () => {
  it.each([
    ['1', 1],
    ['001', 1],
    ['https://tiimi.cz/l/42', 42],
    ['https://tiimi.cz/l/350/', 350],
  ])('reads %s as label %i', (value, expected) => {
    expect(parseLibraryLabelCode(value)).toBe(expected);
  });

  it.each([
    '',
    '0',
    '-1',
    '1.5',
    'https://tiimi.cz/?l=1',
    'https://tiimi.cz/books/1',
    'https://example.com/l/1',
  ])(
    'rejects %s',
    (value) => {
      expect(parseLibraryLabelCode(value)).toBeNull();
    },
  );
});

describe('formatLibraryLabelCode', () => {
  it('pads short codes for the printed label format', () => {
    expect(formatLibraryLabelCode(7)).toBe('#007');
    expect(formatLibraryLabelCode(350)).toBe('#350');
  });
});
