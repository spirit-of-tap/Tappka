/**
 * Strips surrounding quotation marks (standard and typographical quotes) and trims whitespace.
 * e.g. '"Velká kniha"' -> 'Velká kniha', '„Restart“' -> 'Restart'
 */
export function cleanBookTitle(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^["'„“”»«`]+/, '')
    .replace(/["'„“”»«`]+$/, '')
    .trim();
}

export interface StructuredBookTitle {
  /** The clean main title of the book. */
  title: string;
  /** The subtitle if present (separated by colon or dash). */
  subtitle?: string;
  /** The full cleaned title (main + subtitle). */
  fullTitle: string;
}

/**
 * Structures a book title by cleaning stray quotes and splitting main title from subtitle.
 * Handles separators like ': ', ' - ', ' – ', ' — '.
 */
export function structureBookTitle(raw: string): StructuredBookTitle {
  const cleaned = cleanBookTitle(raw);
  if (!cleaned) return { title: '', fullTitle: '' };

  // 1. Colon separator: "Velká kniha: Rychlé a efektivní..."
  const colonIndex = cleaned.indexOf(': ');
  if (colonIndex > 0) {
    const main = cleanBookTitle(cleaned.slice(0, colonIndex));
    const sub = cleanBookTitle(cleaned.slice(colonIndex + 2));
    if (main && sub) {
      return {
        title: main,
        subtitle: sub,
        fullTitle: `${main}: ${sub}`,
      };
    }
  }

  // 2. Dash separator: "Title - Subtitle"
  const dashMatch = cleaned.match(/^(.*?)\s+[-–—]\s+(.*)$/);
  if (dashMatch && dashMatch[1] && dashMatch[2]) {
    const main = cleanBookTitle(dashMatch[1]);
    const sub = cleanBookTitle(dashMatch[2]);
    if (main.length >= 3 && sub.length >= 3) {
      return {
        title: main,
        subtitle: sub,
        fullTitle: `${main} – ${sub}`,
      };
    }
  }

  return { title: cleaned, fullTitle: cleaned };
}
