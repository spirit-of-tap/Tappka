/**
 * Reader-facing stats derived from an essay's plain text. Used by the editor
 * footer, the revision history, and the koncepty list, so the same body of
 * text always reports the same numbers.
 */

/** Average reading pace for Czech prose, in words per minute. */
const WORDS_PER_MINUTE = 200;

const NUMBER_FORMAT = new Intl.NumberFormat('cs-CZ');

/** Words in a plain-text body. Empty and whitespace-only bodies count as zero. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Czech counts nouns in three forms: 1 slovo, 2–4 slova, 0 and 5+ slov.
 * Getting this wrong is the fastest way to make an interface read as translated.
 */
export function formatWordCount(count: number): string {
  const noun = count === 1 ? 'slovo' : count >= 2 && count <= 4 ? 'slova' : 'slov';
  return `${NUMBER_FORMAT.format(count)} ${noun}`;
}

/** Rounded reading time. Anything non-empty reads as at least a minute. */
export function formatReadingTime(wordCount: number): string {
  return `${Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE))} min čtení`;
}

/** Signed word delta between two revisions, or null when nothing changed. */
export function formatWordDelta(current: number, previous: number): string | null {
  const delta = current - previous;
  if (delta === 0) return null;
  return `${delta > 0 ? '+' : '−'}${NUMBER_FORMAT.format(Math.abs(delta))}`;
}
