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
