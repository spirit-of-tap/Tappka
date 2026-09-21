import { describe, expect, it } from 'vitest';
import { extractImageFiles } from '@/lib/essays/pasted-images';

function imageFile(name = 'pasted.png', type = 'image/png'): File {
  return new File(['pixels'], name, { type });
}

describe('extractImageFiles', () => {
  it('returns image files from a paste or drop payload', () => {
    const gif = imageFile('fun.gif', 'image/gif');
    expect(extractImageFiles([gif])).toEqual([gif]);
  });

  it('ignores non-image files but keeps the images', () => {
    const png = imageFile();
    const pdf = new File(['text'], 'doc.pdf', { type: 'application/pdf' });
    expect(extractImageFiles([png, pdf])).toEqual([png]);
  });

  it('returns an empty array when there is nothing to handle', () => {
    expect(extractImageFiles(null)).toEqual([]);
    expect(extractImageFiles(undefined)).toEqual([]);
    expect(extractImageFiles([])).toEqual([]);
  });
});
