import { describe, expect, it } from 'vitest';
import { loanCaption } from './loan-caption';

const NOW = new Date('2026-12-10T12:00:00');

describe('loanCaption', () => {
  it('shows the short due date for a loan that is not due soon', () => {
    expect(loanCaption('2026-12-12T10:00:00', NOW)).toEqual({ label: 'Vrátit do 12. 12.', isOverdue: false });
  });

  it('says today and tomorrow in words', () => {
    expect(loanCaption('2026-12-10T23:00:00', NOW).label).toBe('Vrátit dnes');
    expect(loanCaption('2026-12-11T08:00:00', NOW).label).toBe('Vrátit zítra');
  });

  it('flags a loan past its due date', () => {
    expect(loanCaption('2026-12-01T10:00:00', NOW)).toEqual({ label: 'Po termínu od 1. 12.', isOverdue: true });
  });
});
