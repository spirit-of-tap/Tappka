const POSITIVE_INTEGER_PATTERN = /^\d+$/;
const LIBRARY_LABEL_PATH_PATTERN = /^\/l\/(\d+)\/?$/;
const DISPLAY_CODE_LENGTH = 3;
const PRODUCTION_HOST = 'tiimi.cz';
const LOCAL_HOSTS = ['localhost', '127.0.0.1'] as const;

function parsePositiveInteger(value: string): number | null {
  if (!POSITIVE_INTEGER_PATTERN.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseLibraryLabelCode(value: string): number | null {
  const trimmed = value.trim();
  const directCode = parsePositiveInteger(trimmed);
  if (directCode != null) return directCode;

  try {
    const url = new URL(trimmed);
    const isTappkaHost = url.hostname === PRODUCTION_HOST || url.hostname.endsWith(`.${PRODUCTION_HOST}`);
    const isLocalHost = LOCAL_HOSTS.some((hostname) => hostname === url.hostname);
    if (!isTappkaHost && !isLocalHost) {
      return null;
    }

    const match = url.pathname.match(LIBRARY_LABEL_PATH_PATTERN);
    return match?.[1] ? parsePositiveInteger(match[1]) : null;
  } catch {
    return null;
  }
}

export function formatLibraryLabelCode(code: number): string {
  return `#${String(code).padStart(DISPLAY_CODE_LENGTH, '0')}`;
}
