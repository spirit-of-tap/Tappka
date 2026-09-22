import { contentTextFromJson, normalizeContentJson } from '@/lib/essays/content-text';

export const MAX_BIO_TEXT_LENGTH = 5000;

const ALLOWED_NODES: ReadonlySet<string> = new Set([
  'doc',
  'paragraph',
  'text',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'hardBreak',
]);

const ALLOWED_MARKS: ReadonlySet<string> = new Set(['bold', 'italic', 'underline', 'strike', 'link']);

interface BioOk {
  ok: true;
  value: object | null;
}

interface BioErr {
  ok: false;
  error: string;
}

export type BioValidation = BioOk | BioErr;

const ALLOWED_LINK_SCHEMES: ReadonlySet<string> = new Set(['http', 'https', 'mailto', 'tel']);

const SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function isAllowedLinkHref(href: string): boolean {
  const trimmed = href.trimStart();
  const match = SCHEME_PATTERN.exec(trimmed);
  if (match === null) {
    return true;
  }
  const scheme = match[0].slice(0, -1).toLowerCase();
  return ALLOWED_LINK_SCHEMES.has(scheme);
}

function linkHrefIsAllowed(href: unknown): boolean {
  if (typeof href !== 'string') {
    return false;
  }
  return isAllowedLinkHref(href);
}

function collectLinkHrefs(node: unknown, hrefs: unknown[]): void {
  if (node === null || node === undefined || typeof node !== 'object') {
    return;
  }
  const record = node as { marks?: unknown; content?: unknown };
  if (Array.isArray(record.marks)) {
    for (const mark of record.marks) {
      const markRecord = mark as { type?: unknown; attrs?: unknown };
      if (markRecord.type === 'link') {
        hrefs.push((markRecord.attrs as { href?: unknown } | undefined)?.href);
      }
    }
  }
  if (Array.isArray(record.content)) {
    for (const child of record.content) {
      collectLinkHrefs(child, hrefs);
    }
  }
}

function containsOnlyAllowedNodes(node: unknown): boolean {
  if (node === null || node === undefined || typeof node !== 'object') {
    return true;
  }
  const record = node as { type?: unknown; marks?: unknown; content?: unknown };
  if (typeof record.type === 'string' && !ALLOWED_NODES.has(record.type)) {
    return false;
  }
  if (Array.isArray(record.marks)) {
    for (const mark of record.marks) {
      const markType = (mark as { type?: unknown }).type;
      if (typeof markType !== 'string' || !ALLOWED_MARKS.has(markType)) {
        return false;
      }
    }
  }
  if (Array.isArray(record.content)) {
    return record.content.every(containsOnlyAllowedNodes);
  }
  return true;
}

export function validateBioContent(input: unknown): BioValidation {
  const json = normalizeContentJson(input);
  if (!containsOnlyAllowedNodes(json)) {
    return { ok: false, error: 'Bio podporuje jen základní formátování, odkazy a seznamy.' };
  }
  const linkHrefs: unknown[] = [];
  collectLinkHrefs(json, linkHrefs);
  if (!linkHrefs.every(linkHrefIsAllowed)) {
    return { ok: false, error: 'Odkaz v biu má nepovolený formát.' };
  }
  const text = contentTextFromJson(json);
  if (text.length === 0) {
    return { ok: true, value: null };
  }
  if (text.length > MAX_BIO_TEXT_LENGTH) {
    return { ok: false, error: `Bio je příliš dlouhé (maximum je ${MAX_BIO_TEXT_LENGTH} znaků).` };
  }
  return { ok: true, value: json };
}
