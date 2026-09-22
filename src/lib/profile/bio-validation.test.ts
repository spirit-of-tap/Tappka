import { describe, expect, it } from 'vitest';

import { MAX_BIO_TEXT_LENGTH, isAllowedLinkHref, validateBioContent } from './bio-validation';

function doc(content: unknown[]): object {
  return { type: 'doc', content };
}

function paragraphWithText(text: string, marks?: unknown[]): object {
  return { type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] };
}

describe('validateBioContent', () => {
  it('accepts empty doc as null (no bio)', () => {
    expect(validateBioContent({ type: 'doc', content: [{ type: 'paragraph' }] })).toEqual({
      ok: true,
      value: null,
    });
  });

  it.each([['null', null], ['undefined', undefined], ['empty object', {}]])(
    'accepts %s as null (no bio)',
    (_label, input) => {
      expect(validateBioContent(input)).toEqual({ ok: true, value: null });
    },
  );

  it('accepts bold, links, and lists', () => {
    const json = doc([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hello ', marks: [{ type: 'bold' }] },
          {
            type: 'text',
            text: 'world',
            marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
          },
        ],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [paragraphWithText('item')],
          },
        ],
      },
    ]);
    const result = validateBioContent(json);
    expect(result).toEqual({ ok: true, value: json });
  });

  it('accepts text exactly at the length limit', () => {
    const exact = 'a'.repeat(MAX_BIO_TEXT_LENGTH);
    const json = doc([paragraphWithText(exact)]);
    const result = validateBioContent(json);
    expect(result).toEqual({ ok: true, value: json });
  });

  it('rejects text over the length limit', () => {
    const long = 'a'.repeat(MAX_BIO_TEXT_LENGTH + 1);
    const result = validateBioContent(doc([paragraphWithText(long)]));
    expect(result).toEqual({
      ok: false,
      error: `Bio je příliš dlouhé (maximum je ${MAX_BIO_TEXT_LENGTH} znaků).`,
    });
    expect(result.ok ? '' : result.error).toContain(String(MAX_BIO_TEXT_LENGTH));
  });

  it('rejects image nodes', () => {
    expect(validateBioContent(doc([{ type: 'image', attrs: { src: 'x' } }])).ok).toBe(false);
  });

  it('rejects heading nodes', () => {
    expect(
      validateBioContent(
        doc([
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'hi' }],
          },
        ]),
      ).ok,
    ).toBe(false);
  });

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['uppercase scheme', 'JaVaScRiPt:alert(1)'],
    ['leading whitespace', '   javascript:alert(1)'],
    ['data:', 'data:text/html,<h1>hi</h1>'],
    ['vbscript:', 'vbscript:msgbox(1)'],
  ])('rejects %s link hrefs', (_label, href) => {
    const result = validateBioContent(
      doc([
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'click',
              marks: [{ type: 'link', attrs: { href } }],
            },
          ],
        },
      ]),
    );
    expect(result).toEqual({ ok: false, error: 'Odkaz v biu má nepovolený formát.' });
  });

  it.each([
    ['https', 'https://example.com'],
    ['http', 'http://example.com'],
    ['mailto', 'mailto:nekdo@example.com'],
    ['tel', 'tel:+420123456789'],
    ['root-relative', '/profil'],
    ['fragment', '#kotva'],
    ['plain path', 'profil/muj'],
  ])('accepts %s link hrefs', (_label, href) => {
    const json = doc([
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'click',
            marks: [{ type: 'link', attrs: { href } }],
          },
        ],
      },
    ]);
    expect(validateBioContent(json)).toEqual({ ok: true, value: json });
  });
});

describe('isAllowedLinkHref', () => {
  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['uppercase scheme', 'JaVaScRiPt:alert(1)'],
    ['leading whitespace', '   javascript:alert(1)'],
    ['data:', 'data:text/html,<h1>hi</h1>'],
    ['vbscript:', 'vbscript:msgbox(1)'],
  ])('returns false for %s', (_label, href) => {
    expect(isAllowedLinkHref(href)).toBe(false);
  });

  it.each([
    ['https', 'https://example.com'],
    ['http', 'http://example.com'],
    ['mailto', 'mailto:nekdo@example.com'],
    ['tel', 'tel:+420123456789'],
    ['root-relative', '/profil'],
    ['fragment', '#kotva'],
    ['plain path', 'profil/muj'],
  ])('returns true for %s', (_label, href) => {
    expect(isAllowedLinkHref(href)).toBe(true);
  });
});
