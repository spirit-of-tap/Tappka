import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';
import { getBookById } from '@/lib/books/queries';
import { getProfileById } from '@/lib/komunita/queries';

import { sendEmail } from './send-email';
import { bookLoanEmail } from './email-templates';

export interface NotifyBookBorrowedParams {
  bookId: string;
  borrowerProfileId: string;
  dueAt: string;
  origin: string;
}

export async function notifyBookBorrowed(
  supabase: SupabaseClient<Database>,
  params: NotifyBookBorrowedParams,
): Promise<void> {
  const [book, borrower] = await Promise.all([
    getBookById(supabase, params.bookId),
    getProfileById(supabase, params.borrowerProfileId),
  ]);

  if (!book || !borrower?.work_email) return;

  const dueDate = new Date(params.dueAt).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const { subject, html } = bookLoanEmail({
    bookTitle: book.title_cs,
    dueDate,
    loansUrl: `${params.origin}/cteni/prehled?tab=vypujcky`,
  });

  await sendEmail({ to: borrower.work_email, subject, html });
}
