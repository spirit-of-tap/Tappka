import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BOOK_POINT_CATEGORIES } from '@/lib/books/enrichment/rubric';
import type { GateExemplar } from '@/lib/books/types';

import { StepGate } from './step-gate';
import { DOES_NOT_BELONG_CHIPS } from './types';

const EXEMPLARS: GateExemplar[] = [
  {
    id: 'b1',
    title_cs: 'Sprint',
    author: 'Jake Knapp',
    google_books_cover_url: 'https://books.google.com/sprint.jpg',
  },
  {
    id: 'b2',
    title_cs: 'Pátá disciplína',
    author: 'Peter Senge',
    google_books_cover_url: 'https://books.google.com/senge.jpg',
  },
  {
    id: 'b3',
    title_cs: 'Dialog',
    author: 'William Isaacs',
    google_books_cover_url: 'https://books.google.com/dialog.jpg',
  },
];

describe('StepGate', () => {
  it('shows the exemplar covers it was given', () => {
    render(<StepGate exemplars={EXEMPLARS} onContinue={vi.fn()} />);

    expect(screen.getByText('Tyhle knihy hledáme')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Sprint' })).toBeInTheDocument();
    expect(screen.getByText('Peter Senge')).toBeInTheDocument();
  });

  it('shows every category of book that does not belong', () => {
    render(<StepGate exemplars={EXEMPLARS} onContinue={vi.fn()} />);

    for (const { label } of DOES_NOT_BELONG_CHIPS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('never shows the scoring rubric — that is for the model, not the submitter', () => {
    render(<StepGate exemplars={EXEMPLARS} onContinue={vi.fn()} />);

    for (const category of BOOK_POINT_CATEGORIES) {
      expect(screen.queryByText(category.name)).not.toBeInTheDocument();
      expect(screen.queryByText(category.description)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/\d\s*b\./)).not.toBeInTheDocument();
  });

  it('drops the shelf rather than showing a single cover', () => {
    render(<StepGate exemplars={[EXEMPLARS[0]]} onContinue={vi.fn()} />);

    expect(screen.queryByText('Tyhle knihy hledáme')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // The screen still makes its point without any examples.
    expect(screen.getByText('Beletrie')).toBeInTheDocument();
  });

  it('still renders when there are no exemplars at all', () => {
    render(<StepGate exemplars={[]} onContinue={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /co patří do boba/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pojďme na to/i })).toBeEnabled();
  });

  it('encourages adding a book when the submitter is unsure', () => {
    render(<StepGate exemplars={EXEMPLARS} onContinue={vi.fn()} />);

    expect(screen.getByText(/kouč rozhodne/i)).toBeInTheDocument();
  });

  it('continues only when the button is pressed', async () => {
    const onContinue = vi.fn();
    render(<StepGate exemplars={EXEMPLARS} onContinue={onContinue} />);

    expect(onContinue).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /pojďme na to/i }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
