import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BOOK_POINT_CATEGORIES } from '@/lib/books/enrichment/rubric';

import { StepGate } from './step-gate';
import { BELONGS_CHIPS, DOES_NOT_BELONG_CHIPS } from './types';

describe('StepGate', () => {
  it('names every kind of book we are looking for', () => {
    render(<StepGate onContinue={vi.fn()} />);

    expect(screen.getByText('Tyhle knihy hledáme')).toBeInTheDocument();
    for (const { label } of BELONGS_CHIPS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('names every kind of book that does not belong', () => {
    render(<StepGate onContinue={vi.fn()} />);

    expect(screen.getByText('Tyhle ne')).toBeInTheDocument();
    for (const { label } of DOES_NOT_BELONG_CHIPS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('keeps the two groups distinguishable as separate lists', () => {
    render(<StepGate onContinue={vi.fn()} />);

    const [wanted, unwanted] = screen.getAllByRole('list');
    expect(wanted.children).toHaveLength(BELONGS_CHIPS.length);
    expect(unwanted.children).toHaveLength(DOES_NOT_BELONG_CHIPS.length);
  });

  it('never shows the scoring rubric — that is for the model, not the submitter', () => {
    render(<StepGate onContinue={vi.fn()} />);

    for (const category of BOOK_POINT_CATEGORIES) {
      expect(screen.queryByText(category.name)).not.toBeInTheDocument();
      expect(screen.queryByText(category.description)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/\d\s*b\./)).not.toBeInTheDocument();
  });

  it('shows no book covers or images at all', () => {
    render(<StepGate onContinue={vi.fn()} />);

    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('encourages adding a book when the submitter is unsure', () => {
    render(<StepGate onContinue={vi.fn()} />);

    expect(screen.getByText(/kouč:ka rozhodne/i)).toBeInTheDocument();
  });

  it('continues only when the button is pressed', async () => {
    const onContinue = vi.fn();
    render(<StepGate onContinue={onContinue} />);

    expect(onContinue).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /pojďme na to/i }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
