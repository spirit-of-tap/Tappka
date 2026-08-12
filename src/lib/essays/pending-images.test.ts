import { describe, expect, it } from 'vitest';
import { stripPendingImages } from '@/lib/essays/pending-images';

const uploaded = {
  type: 'image',
  attrs: { src: 'https://cdn.example.com/essay-images/a.webp' },
};

function doc(...content: object[]) {
  return { type: 'doc', content };
}

describe('stripPendingImages', () => {
  it('drops an image still marked as uploading', () => {
    const result = stripPendingImages(
      doc({ type: 'image', attrs: { src: 'blob:http://localhost/x', uploading: 'true' } }),
    );
    expect(result).toEqual(doc());
  });

  it('drops a blob-backed image even without the marker', () => {
    const result = stripPendingImages(doc({ type: 'image', attrs: { src: 'blob:http://x/y' } }));
    expect(result).toEqual(doc());
  });

  it('keeps images that finished uploading', () => {
    const input = doc(uploaded);
    expect(stripPendingImages(input)).toEqual(input);
  });

  it('strips placeholders nested inside other nodes', () => {
    const result = stripPendingImages(
      doc({
        type: 'blockquote',
        content: [
          { type: 'image', attrs: { src: 'blob:http://x/y', uploading: 'true' } },
          uploaded,
        ],
      }),
    );
    expect(result).toEqual(doc({ type: 'blockquote', content: [uploaded] }));
  });

  it('leaves surrounding text untouched', () => {
    const paragraph = { type: 'paragraph', content: [{ type: 'text', text: 'Kniha o návycích' }] };
    const result = stripPendingImages(
      doc(paragraph, { type: 'image', attrs: { src: 'blob:http://x/y' } }),
    );
    expect(result).toEqual(doc(paragraph));
  });

  it('does not mutate the document it was given', () => {
    const input = doc({ type: 'image', attrs: { src: 'blob:http://x/y' } });
    const before = JSON.stringify(input);
    stripPendingImages(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
