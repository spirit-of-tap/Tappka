import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DraftRecoveryBanner, formatDraftTime } from './draft-recovery-banner';

describe('formatDraftTime', () => {
  it('shows only the time for a same-day draft', () => {
    const savedAt = new Date(2026, 10, 19, 14, 32).toISOString();
    const now = new Date(2026, 10, 19, 20, 0);
    expect(formatDraftTime(savedAt, now)).toBe('14:32');
  });

  it('shows date and time once the day changed', () => {
    const savedAt = new Date(2026, 10, 18, 9, 5).toISOString();
    const now = new Date(2026, 10, 19, 20, 0);
    expect(formatDraftTime(savedAt, now)).toBe('18. 11. 09:05');
  });

  it('returns an empty string for an unparseable timestamp', () => {
    const now = new Date(2026, 10, 19, 20, 0);
    expect(() => formatDraftTime('garbage', now)).not.toThrow();
    expect(formatDraftTime('garbage', now)).toBe('');
  });
});

describe('DraftRecoveryBanner', () => {
  it('offers restore and discard with the draft time', async () => {
    const onRestore = vi.fn();
    const onDiscard = vi.fn();
    const user = userEvent.setup();
    render(
      <DraftRecoveryBanner
        savedAt={new Date(2026, 10, 19, 14, 32).toISOString()}
        wordCount={120}
        now={new Date(2026, 10, 19, 20, 0)}
        onRestore={onRestore}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByText(/Máš rozepsaný text z 14:32/)).toBeInTheDocument();
    expect(screen.getByText(/120 slov/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Obnovit' }));
    expect(onRestore).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('hides the word count when none is given', () => {
    render(
      <DraftRecoveryBanner
        savedAt={new Date(2026, 10, 19, 14, 32).toISOString()}
        now={new Date(2026, 10, 19, 20, 0)}
        onRestore={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.queryByText(/slov/)).not.toBeInTheDocument();
  });
});
