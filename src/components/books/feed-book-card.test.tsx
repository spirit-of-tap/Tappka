import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FeedBookCard } from './feed-book-card';
import type { BookWithProfiles } from '@/lib/books/types';

const mockBook: BookWithProfiles = {
  id: 'b-123',
  title_cs: 'The Lean Startup',
  title_en: 'The Lean Startup',
  author: 'Eric Ries',
  isbn_13: '9780307887894',
  description: 'Tato kniha představuje revoluční přístup k podnikání a inovacím, který pomáhá vyvíjet produkty efektivně a rychle.',
  google_books_cover_url: null,
  book_points: 3,
  page_count: 336,
  preview_link: 'https://books.google.com/example',
  source: 'google_books',
  external_id: '123',
  list_status: 'shortlist',
  list_status_changed_at: null,
  list_status_changed_by_profile_id: null,
  list_status_reason: null,
  highlight_category_id: null,
  is_rocket_model: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by_profile_id: 'p1',
  updated_by_profile_id: 'p1',
  created_by: null,
  list_status_changed_by: null,
  essay_count: 5,
  tags: ['Inovace & kreativita'],
  highlight_category: null,
};

describe('FeedBookCard', () => {
  it('renders title, author, description, points and essay list', () => {
    render(
      <FeedBookCard
        book={mockBook}
        essays={[
          {
            id: 'e1',
            title: 'Lean Startup v praxi',
            author: { id: 'u1', name: 'Petr Novák', picture: null },
          },
        ]}
        inLibrary={true}
      />,
    );

    expect(screen.getByText('The Lean Startup')).toBeInTheDocument();
    expect(screen.getByText('Eric Ries')).toBeInTheDocument();
    expect(screen.getByText(/Tato kniha představuje revoluční přístup/)).toBeInTheDocument();
    expect(screen.getByText('3 b.')).toBeInTheDocument();
    expect(screen.getByText('V TAP Knihovně')).toBeInTheDocument();
    expect(screen.getByText('Petr Novák')).toBeInTheDocument();
    expect(screen.getByText(/Lean Startup v praxi/)).toBeInTheDocument();
  });

  it('renders without essays when none provided', () => {
    render(
      <FeedBookCard
        book={{ ...mockBook, essay_count: 0 }}
        essays={[]}
      />,
    );

    expect(screen.getByText(/Zatím bez eseje/)).toBeInTheDocument();
  });
});
