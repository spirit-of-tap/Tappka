import { describe, expect, it } from 'vitest';
import {
  MAX_GIF_BYTES,
  MAX_ORIGINAL_BYTES,
  validateEssayImage,
} from '@/lib/essays/image-upload';

const MB = 1024 * 1024;

describe('validateEssayImage', () => {
  it('accepts an ordinary phone photo', () => {
    expect(validateEssayImage({ type: 'image/jpeg', size: 12 * MB })).toBeNull();
  });

  it('rejects files that are not images', () => {
    expect(validateEssayImage({ type: 'application/pdf', size: 1000 })).toMatch(/obrázek/i);
  });

  it('accepts an image right at the limit but not past it', () => {
    expect(validateEssayImage({ type: 'image/png', size: MAX_ORIGINAL_BYTES })).toBeNull();
    expect(validateEssayImage({ type: 'image/png', size: MAX_ORIGINAL_BYTES + 1 })).toMatch(/25 MB/);
  });

  it('holds GIFs to their own tighter limit, since they skip optimization', () => {
    expect(validateEssayImage({ type: 'image/gif', size: MAX_GIF_BYTES })).toBeNull();
    expect(validateEssayImage({ type: 'image/gif', size: MAX_GIF_BYTES + 1 })).toMatch(/5 MB/);
    // Comfortably under the general limit, yet still too big for a GIF.
    expect(validateEssayImage({ type: 'image/gif', size: 10 * MB })).not.toBeNull();
  });

  it('accepts formats the browser may hand over from a camera', () => {
    expect(validateEssayImage({ type: 'image/heic', size: 4 * MB })).toBeNull();
  });
});
