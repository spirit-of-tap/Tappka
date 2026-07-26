export interface RewriteResult<T> {
  readonly value: T;
  readonly rewritten: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Replaces `fromPrefix` with `toPrefix` on every string that *starts with*
 * `fromPrefix`. Exact-prefix matching, so external and malformed srcs are
 * returned byte-identical (spec R5).
 */
export function rewriteLocalStorageUrls<T>(
  node: T,
  fromPrefix: string,
  toPrefix: string,
): RewriteResult<T> {
  let rewritten = 0;

  const walk = (value: unknown): unknown => {
    if (typeof value === "string") {
      if (value.startsWith(fromPrefix)) {
        rewritten += 1;
        return `${toPrefix}${value.slice(fromPrefix.length)}`;
      }
      return value;
    }
    if (Array.isArray(value)) return value.map(walk);
    if (isPlainObject(value)) {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(value)) out[key] = walk(child);
      return out;
    }
    return value;
  };

  return { value: walk(node) as T, rewritten };
}

/**
 * Collects the distinct storage object paths referenced by local URLs, decoded
 * so they match `storage.objects.name`.
 */
export function collectLocalObjectPaths(node: unknown, fromPrefix: string): string[] {
  const paths = new Set<string>();

  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      if (!value.startsWith(fromPrefix)) return;
      const raw = value.slice(fromPrefix.length).replace(/^\/+/, "");
      if (raw === "") return;
      paths.add(decodeURIComponent(raw));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (isPlainObject(value)) {
      Object.values(value).forEach(walk);
    }
  };

  walk(node);
  return [...paths];
}
