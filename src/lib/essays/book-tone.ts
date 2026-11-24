/**
 * Band colours for book covers and essay cards. Every pair clears 4.5:1 in
 * light and dark (chart-4 is left out: white on it is only ~3.9:1).
 */
export const BOOK_TONE_CLASSES = [
  'bg-chart-1 text-primary-foreground',
  'bg-chart-2-strong text-primary-foreground',
  'bg-chart-3-strong text-primary-foreground',
  'bg-chart-5 text-primary-foreground',
] as const;

const HASH_MULTIPLIER = 31;

/** Same key, same colour, on every page and render. */
export function bookToneClass(key: string): (typeof BOOK_TONE_CLASSES)[number] {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * HASH_MULTIPLIER + key.charCodeAt(i)) >>> 0;
  }
  return BOOK_TONE_CLASSES[hash % BOOK_TONE_CLASSES.length];
}
