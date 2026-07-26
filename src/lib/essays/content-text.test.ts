import { describe, expect, it } from 'vitest';

import { contentTextFromJson, extractPlainTextFromContentJson } from './content-text';

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
