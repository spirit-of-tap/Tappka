import { describe, expect, it } from 'vitest';

import { contentTextFromJson, extractPlainTextFromContentJson, normalizeContentJson } from './content-text';

describe('extractPlainTextFromContentJson', () => {
  it('returns empty string for nullish or non-objects', () => {
    expect(extractPlainTextFromContentJson(null)).toBe('');
    expect(extractPlainTextFromContentJson(undefined)).toBe('');
    expect(extractPlainTextFromContentJson('x')).toBe('');
  });

  it('extracts nested tip tap text nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'world' }],
        },
      ],
    };

    expect(extractPlainTextFromContentJson(doc)).toBe('Hello world');
  });
});

describe('contentTextFromJson', () => {
  it('collapses whitespace', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '  Hi  ' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'there' }] },
      ],
    };

    expect(contentTextFromJson(doc)).toBe('Hi there');
  });
});

describe('normalizeContentJson', () => {
  it('passes a valid doc through untouched', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph' }] };

    expect(normalizeContentJson(doc)).toBe(doc);
  });

  it('heals the legacy {} from title-only saves into an empty doc', () => {
    expect(normalizeContentJson({})).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });
  });

  it('heals nullish, array, and non-doc inputs into an empty doc', () => {
    const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

    expect(normalizeContentJson(null)).toEqual(emptyDoc);
    expect(normalizeContentJson(undefined)).toEqual(emptyDoc);
    expect(normalizeContentJson([])).toEqual(emptyDoc);
    expect(normalizeContentJson({ type: 'paragraph' })).toEqual(emptyDoc);
    expect(normalizeContentJson({ type: 'doc', content: 'nope' })).toEqual(emptyDoc);
  });
});
