import type { ExternalBookCandidate } from '../types';

interface OpenLibraryDoc {
  key: string;
  title?: string;
  author_name?: string[];
  isbn?: string[];
  first_sentence?: { value: string } | string;
  cover_i?: number;
  number_of_pages_median?: number;
  publisher?: string[];
  first_publish_year?: number;
}

interface OpenLibrarySearchResponse {
  docs?: OpenLibraryDoc[];
}

const SEARCH_URL = 'https://openlibrary.org/search.json';
const COVER_URL = 'https://covers.openlibrary.org/b/id';
const MAX_RESULTS = 10;
const FIELDS = 'key,title,author_name,isbn,cover_i,first_sentence,number_of_pages_median,publisher,first_publish_year';

function normalizeDoc(doc: OpenLibraryDoc): ExternalBookCandidate | null {
  if (!doc.title || !doc.key) return null;

  const isbn13 = doc.isbn?.find((i) => i.length === 13) ?? null;
  const author = doc.author_name?.join(', ') ?? 'Neznámý autor';

  let description: string | null = null;
  if (doc.first_sentence) {
    description = typeof doc.first_sentence === 'string'
      ? doc.first_sentence
      : doc.first_sentence.value;
  }

  const coverUrl = doc.cover_i ? `${COVER_URL}/${doc.cover_i}-L.jpg` : null;

  return {
    title: doc.title,
    author,
    isbn_13: isbn13,
    description,
    cover_url: coverUrl,
    page_count: doc.number_of_pages_median ?? null,
    publisher: doc.publisher?.[0] ?? null,
    published_year: doc.first_publish_year ?? null,
    preview_link: `https://openlibrary.org${doc.key}`,
    source: 'open_library',
    external_id: doc.key,
  };
}

export async function searchOpenLibrary(query: string): Promise<ExternalBookCandidate[]> {
  const params = new URLSearchParams({ q: query, limit: String(MAX_RESULTS), fields: FIELDS });
  const res = await fetch(`${SEARCH_URL}?${params}`, { next: { revalidate: 60 } });
  if (!res.ok) return [];

  const json = (await res.json()) as OpenLibrarySearchResponse;
  return (json.docs ?? []).map(normalizeDoc).filter(Boolean) as ExternalBookCandidate[];
}

export async function fetchOpenLibraryByIsbn(isbn: string): Promise<ExternalBookCandidate | null> {
  const params = new URLSearchParams({ q: `isbn:${isbn}`, limit: '1', fields: FIELDS });
  const res = await fetch(`${SEARCH_URL}?${params}`, { next: { revalidate: 300 } });
  if (!res.ok) return null;

  const json = (await res.json()) as OpenLibrarySearchResponse;
  const first = json.docs?.[0];
  return first ? normalizeDoc(first) : null;
}
