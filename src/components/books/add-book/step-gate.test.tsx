import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BOOK_POINT_CATEGORIES } from '@/lib/books/enrichment/rubric';

import { StepGate } from './step-gate';
import { DOES_NOT_BELONG } from './types';

describe('StepGate', () => {
  it('shows all three scoring categories with their point values', () => {
    render(<StepGate onContinue={vi.fn()} />);

    for (const category of BOOK_POINT_CATEGORIES) {
      expect(screen.getByText(category.name)).toBeInTheDocument();
    }
  });

  it('lists what does not belong in BOBa', () => {
    render(<StepGate onContinue={vi.fn()} />);

    for (const item of DOES_NOT_BELONG) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it('continues only when the affirm button is pressed', async () => {
    const onContinue = vi.fn();
    render(<StepGate onContinue={onContinue} />);

    expect(onContinue).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /chci přidat/i }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
