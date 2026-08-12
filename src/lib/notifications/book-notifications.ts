import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';
import { POINTS_ELIGIBLE_LIST_STATUSES } from '@/lib/books/types';

import { sendEmail } from './send-email';
import { bookDecisionEmail, bookSubmittedEmail } from './email-templates';

export interface CoachRecipient {
  id: string;
  work_email: string | null;
  team_id: string | null;
  beta_access_granted_at: string | null;
}

interface Reachable {
  work_email: string | null;
  beta_access_granted_at: string | null;
}

/**
 * There are no notification-preference columns for book emails — the schema is
 * frozen — so this follows `notifyBookBorrowed`, which also has no preference
 * check, plus the `beta_access_granted_at` gate used by essay notifications.
 */
function isReachable(profile: Reachable | null): boolean {
  return Boolean(profile?.work_email) && Boolean(profile?.beta_access_granted_at);
}

/** Coaches on the submitter's team, or all coaches when that team has none. */
export function selectCoachRecipients(
  coaches: CoachRecipient[],
  submitterTeamId: string | null,
): CoachRecipient[] {
  const reachable = coaches.filter(isReachable);
  if (!submitterTeamId) return reachable;

  const sameTeam = reachable.filter((coach) => coach.team_id === submitterTeamId);
  return sameTeam.length > 0 ? sameTeam : reachable;
}

export interface NotifyBookSubmittedParams {
  bookId: string;
  submitterProfileId: string;
  origin: string;
}

export async function notifyBookSubmitted(
  supabase: SupabaseClient<Database>,
  params: NotifyBookSubmittedParams,
): Promise<void> {
  const [{ data: book }, { data: submitter }, { data: coaches }] = await Promise.all([
    supabase
      .from('books')
      .select('title_cs, author, book_points, list_status_reason')
      .eq('id', params.bookId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('name, team_id')
      .eq('id', params.submitterProfileId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('id, work_email, team_id, beta_access_granted_at')
      .eq('role', 'coach'),
  ]);

  if (!book || !submitter) return;

  const recipients = selectCoachRecipients(coaches ?? [], submitter.team_id);
  if (recipients.length === 0) return;

  const { subject, html } = bookSubmittedEmail({
    bookTitle: book.title_cs,
    bookAuthor: book.author,
    submitterName: submitter.name ?? 'Téčko',
    suggestedPoints: book.book_points === null ? null : Number(book.book_points),
    pointsReason: book.list_status_reason,
    reviewUrl: `${params.origin}/cteni/sprava`,
  });

  await Promise.all(
    recipients.map((coach) => sendEmail({ to: coach.work_email as string, subject, html })),
  );
}

export interface NotifyBookDecidedParams {
  bookId: string;
  origin: string;
}

export async function notifyBookDecided(
  supabase: SupabaseClient<Database>,
  params: NotifyBookDecidedParams,
): Promise<void> {
  const { data: book } = await supabase
    .from('books')
    .select('title_cs, book_points, list_status, list_status_reason, created_by_profile_id')
    .eq('id', params.bookId)
    .maybeSingle();

  if (!book) return;

  const { data: submitter } = await supabase
    .from('profiles')
    .select('work_email, beta_access_granted_at')
    .eq('id', book.created_by_profile_id)
    .maybeSingle();

  if (!isReachable(submitter)) return;

  const approved = (POINTS_ELIGIBLE_LIST_STATUSES as readonly string[]).includes(book.list_status);

  const { subject, html } = bookDecisionEmail({
    bookTitle: book.title_cs,
    approved,
    points: book.book_points === null ? null : Number(book.book_points),
    reason: book.list_status_reason ?? 'Kouč neuvedl důvod.',
    bookUrl: `${params.origin}/cteni/knihy/${params.bookId}`,
  });

  await sendEmail({ to: submitter!.work_email as string, subject, html });
}
