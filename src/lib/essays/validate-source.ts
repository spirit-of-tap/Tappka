/**
 * An essay is about at most one thing — mirrors the `essays_source_exclusive_check`
 * DB constraint so the API can return a friendly 400 instead of a raw SQL error.
 */
export function validateEssaySourceIds(
  bookId: string | null | undefined,
  contentSourceId: string | null | undefined,
): string | null {
  if (bookId && contentSourceId) {
    return 'Esej může patřit jen ke knize, nebo jen k jinému zdroji.';
  }
  return null;
}
