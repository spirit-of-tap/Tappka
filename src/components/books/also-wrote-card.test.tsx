import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AlsoWroteCard } from './also-wrote-card';
import type { BookWithProfiles } from '@/lib/books/types';
import type { EssayWithDetails } from '@/lib/essays/types';

const mockBook: BookWithProfiles = {
  id: 'b-123',
  title_cs: 'The Lean Startup',
  title_en: 'The Lean Startup',
  author: 'Eric Ries',
  isbn_13: '9780307887894',
  description: 'Popis knihy...',
  google_books_cover_url: null,
  book_points: 3,
  page_count: 336,
  preview_link: null,
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

const mockEssays: EssayWithDetails[] = [
  {
    id: 'e1',
    author_profile_id: 'p1',
    book_id: 'b-123',
    title: 'MVP za víkend',
    content_json: {},
    content_text: 'Tento text popisuje jak jsme postavili MVP za vikend.',
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    pinned_at: null,
    pinned_by_profile_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    view_count: 10,
    removed_at: null,
    vote_count: 3,
    comment_count: 1,
    author: {
      id: 'p1',
      name: 'Lukáš Dvořák',
      picture: null,
      role: 'student',
      team_id: 't1',
    },
    book: {
      id: 'b-123',
      title_cs: 'The Lean Startup',
      author: 'Eric Ries',
      book_points: 3,
      list_status: 'shortlist',
      is_rocket_model: true,
      google_books_cover_url: null,
      highlight_category: null,
    },
  },
  {
    id: 'e2',
    author_profile_id: 'p2',
    book_id: 'b-123',
    title: 'Pohled na Lean po 2 letech v byznysu',
    content_json: {},
    content_text: 'Dnes s odstupem casu vidim jak nam tato kniha pomohla.',
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 400).toISOString(),
    pinned_at: null,
    pinned_by_profile_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    view_count: 25,
    removed_at: null,
    vote_count: 8,
    comment_count: 4,
    author: {
      id: 'p2',
      name: 'Tereza Novotná',
      picture: null,
      role: 'student',
      team_id: 't2',
    },
    book: {
      id: 'b-123',
      title_cs: 'The Lean Startup',
      author: 'Eric Ries',
      book_points: 3,
      list_status: 'shortlist',
      is_rocket_model: true,
      google_books_cover_url: null,
      highlight_category: null,
    },
  },
];

describe('AlsoWroteCard', () => {
  it('renders "Taky napsali" badge, book capsule and comparative reflections', () => {
    render(
      <AlsoWroteCard
        book={mockBook}
        essays={mockEssays}
        teamNamesById={{ t1: 'Tuuli', t2: 'Kipinä' }}
      />,
    );

    expect(screen.getByText('Taky napsali')).toBeInTheDocument();
    expect(screen.getByText('The Lean Startup')).toBeInTheDocument();
    expect(screen.getByText('Lukáš Dvořák')).toBeInTheDocument();
    expect(screen.getByText('Tuuli')).toBeInTheDocument();
    expect(screen.getByText(/MVP za víkend/)).toBeInTheDocument();
    expect(screen.getByText('Tereza Novotná')).toBeInTheDocument();
    expect(screen.getByText('Kipinä')).toBeInTheDocument();
    expect(screen.getByText(/Pohled na Lean po 2 letech/)).toBeInTheDocument();
  });
});
