/**
 * Empty TipTap/ProseMirror document: one empty paragraph, the way
 * ProseMirror's own empty document looks. A doc with no content renders
 * zero nodes, so there is no paragraph for the placeholder to attach to.
 * This is the canonical "no body yet" value — never persist `{}`.
 */
export const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] } as const;

function createEmptyDoc(): object {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

/**
 * Coerces unknown input into a renderable TipTap doc. Anything that is not
 * `{ type: 'doc', content?: [] }` (e.g. the legacy `{}` stored by title-only
 * saves) becomes a fresh empty doc instead of crashing `generateHTML`.
 */
export function normalizeContentJson(input: unknown): object {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return createEmptyDoc();
  }
  const record = input as { type?: unknown; content?: unknown };
  if (record.type !== 'doc') return createEmptyDoc();
  if (record.content !== undefined && !Array.isArray(record.content)) {
    return createEmptyDoc();
  }
  return input as object;
}

/**
 * Recursively extracts plain text from a TipTap/ProseMirror JSON document.
 */
export function extractPlainTextFromContentJson(node: unknown): string {
  if (node == null || typeof node !== 'object') return '';

  const record = node as { text?: unknown; content?: unknown[] };

  if (typeof record.text === 'string') return record.text;

  if (!Array.isArray(record.content)) return '';

  return record.content.map(extractPlainTextFromContentJson).join(' ');
}

/**
 * Normalizes TipTap JSON into a single-line snippet string.
 */
export function contentTextFromJson(contentJson: unknown): string {
  return extractPlainTextFromContentJson(contentJson).replace(/\s+/g, ' ').trim();
}
