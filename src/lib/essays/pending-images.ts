/**
 * Guards autosave against images that have not finished uploading.
 *
 * While an upload is in flight the editor shows the picture from a local
 * `blob:` URL. Autosave runs every couple of seconds, so without this filter a
 * blob URL — meaningless outside the tab that made it — would be written into
 * `content_json` and render as a broken image forever after.
 */

/** Attribute the editor sets on an image node whose upload is still running. */
export const PENDING_IMAGE_ATTR = 'uploading';

interface DocNode {
  type?: unknown;
  attrs?: Record<string, unknown>;
  content?: unknown;
}

function asNode(value: unknown): DocNode | null {
  return value != null && typeof value === 'object' ? (value as DocNode) : null;
}

function isPendingImage(node: DocNode): boolean {
  if (node.type !== 'image') return false;
  if (node.attrs?.[PENDING_IMAGE_ATTR] != null) return true;

  const src = node.attrs?.src;
  return typeof src === 'string' && src.startsWith('blob:');
}

/**
 * Returns a copy of a ProseMirror document with in-flight image placeholders
 * removed. The input is never mutated, so the live editor keeps its placeholder.
 */
export function stripPendingImages(doc: object): object {
  const stripped = stripNode(doc);
  // The doc root itself is never a pending image, so this cast always holds.
  return (stripped ?? {}) as object;
}

function stripNode(value: unknown): unknown {
  const node = asNode(value);
  if (!node) return value;
  if (isPendingImage(node)) return null;
  if (!Array.isArray(node.content)) return value;

  return {
    ...node,
    content: node.content.map(stripNode).filter((child) => child != null),
  };
}
