import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { CoachLibraryTools } from './coach-library-tools';
import type { PhysicalLibraryBookItem } from '@/lib/library/types';
import type { BookWithProfiles } from '@/lib/books/types';

const mockInventory: PhysicalLibraryBookItem[] = [
  {
    book: {
      id: 'b1',
      title_cs: 'Kniha s výtisky',
      title_en: null,
      author: 'Knihovník Jan',
      description: 'Testovací kniha',
      book_points: 2,
      list_status: 'shortlist',
      list_status_reason: null,
      page_count: 240,
      source: 'manual',
      external_id: null,
      google_books_cover_url: null,
      is_rocket_model: false,
      isbn_13: '9788000111223',
      created_at: '2026-08-01T10:00:00Z',
      created_by: null,
      list_status_changed_by: null,
      essay_count: 1,
      tags: [],
      highlight_category: null,
    } as unknown as BookWithProfiles,
    totalCopies: 2,
    availableCopies: 1,
    copies: [
      {
        id: 'c1',
        label_code: 1042,
        created_at: '2026-08-01T10:00:00Z',
        loan: null,
      },
      {
        id: 'c2',
        label_code: 1043,
        created_at: '2026-08-02T10:00:00Z',
        loan: {
          id: 'loan-1',
          borrowed_at: '2026-08-10T10:00:00Z',
          due_at: '2026-09-10T10:00:00Z',
          is_overdue: false,
          borrower: {
            id: 'u1',
            name: 'Pavel Novák',
            picture: null,
          },
        },
      },
    ],
  },
];

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('CoachLibraryTools', () => {
  it('renders library inventory overview and book copies', () => {
    render(<CoachLibraryTools initialInventory={mockInventory} />);

    expect(screen.getByText('Kniha s výtisky')).toBeInTheDocument();
    expect(screen.getByText('Knihovník Jan')).toBeInTheDocument();
    expect(screen.getByText('Štítek #1042')).toBeInTheDocument();
    expect(screen.getByText('Štítek #1043')).toBeInTheDocument();
    expect(screen.getByText(/Pavel Novák/)).toBeInTheDocument();
    expect(screen.getAllByText('K dispozici na poličce').length).toBeGreaterThan(0);
    expect(screen.getByText('1/2 k dispozici')).toBeInTheDocument();
  });

  it('filters books by search query', async () => {
    const user = userEvent.setup();
    render(<CoachLibraryTools initialInventory={mockInventory} />);

    const searchInput = screen.getByPlaceholderText(/Hledat podle názvu/);
    await user.type(searchInput, 'Neexistující kniha');

    expect(screen.queryByText('Kniha s výtisky')).not.toBeInTheDocument();
    expect(screen.getByText('Žádné výtisky nenalezeny')).toBeInTheDocument();
  });

  it('toggles scanner section', async () => {
    const user = userEvent.setup();
    render(<CoachLibraryTools initialInventory={mockInventory} />);

    const toggleButton = screen.getByRole('button', { name: /Naskenovat \/ přidat výtisk/ });
    await user.click(toggleButton);

    expect(screen.getByText('Skenování a evidence nového výtisku')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zavřít skener' })).toBeInTheDocument();
  });
});
