import type { BookWithProfiles, HighlightCategory } from './types';

export interface HighlightedGroup {
  category: HighlightCategory;
  books: BookWithProfiles[];
}

/** Groups already-fetched highlighted books by their category, dropping empty categories. */
export function groupHighlightedBooks(
  books: BookWithProfiles[],
  categories: HighlightCategory[],
): HighlightedGroup[] {
  return categories
    .map((category) => ({
      category,
      books: books.filter((b) => b.highlight_category?.id === category.id),
    }))
    .filter((group) => group.books.length > 0);
}
