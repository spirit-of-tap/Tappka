import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/lib/books/queries', () => ({
  getBookById: vi.fn(),
}));
vi.mock('@/lib/komunita/queries', () => ({
  getProfileById: vi.fn(),
}));
vi.mock('./send-email', () => ({
  sendEmail: vi.fn(),
}));

import { getBookById } from '@/lib/books/queries';
import { getProfileById } from '@/lib/komunita/queries';
import { sendEmail } from './send-email';
import { notifyBookBorrowed } from './library-notifications';

const mockedGetBookById = vi.mocked(getBookById);
const mockedGetProfileById = vi.mocked(getProfileById);
const mockedSendEmail = vi.mocked(sendEmail);

const BOOK = { id: 'book-1', title_cs: 'Atomové návyky' };
const BORROWER = { id: 'borrower-1', name: 'Petr Herec', work_email: 'petr@studenti.czu.cz' };

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetBookById.mockResolvedValue(BOOK as never);
  mockedGetProfileById.mockResolvedValue(BORROWER as never);
});

describe('notifyBookBorrowed', () => {
  it('sends a confirmation email with the due date and a link to my loans', async () => {
    await notifyBookBorrowed({} as SupabaseClient, {
      bookId: BOOK.id,
      borrowerProfileId: BORROWER.id,
      dueAt: '2026-08-30T00:00:00.000Z',
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    const call = mockedSendEmail.mock.calls[0][0];
    expect(call.to).toBe(BORROWER.work_email);
    expect(call.subject).toContain('Atomové návyky');
    expect(call.html).toContain('https://tappka.app/knihovna/moje');
  });

  it('skips when the borrower has no work email', async () => {
    mockedGetProfileById.mockResolvedValue({ ...BORROWER, work_email: null } as never);

    await notifyBookBorrowed({} as SupabaseClient, {
      bookId: BOOK.id,
      borrowerProfileId: BORROWER.id,
      dueAt: '2026-08-30T00:00:00.000Z',
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('skips when the book no longer exists', async () => {
    mockedGetBookById.mockResolvedValue(null);

    await notifyBookBorrowed({} as SupabaseClient, {
      bookId: BOOK.id,
      borrowerProfileId: BORROWER.id,
      dueAt: '2026-08-30T00:00:00.000Z',
      origin: 'https://tappka.app',
    });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});
