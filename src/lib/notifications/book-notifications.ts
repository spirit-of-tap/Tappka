import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';
import { POINTS_ELIGIBLE_LIST_STATUSES } from '@/lib/books/types';

import { logNotificationSkipped } from './log-skip';
import { sendEmail } from './send-email';
import { bookDecisionEmail, bookSubmittedEmail } from './email-templates';

export interface CoachRecipient {
  id: string;
  work_email: string | null;
  team_id: string | null;
  book_submitted_email: boolean;
}

interface Reachable {
  work_email: string | null;
  book_submitted_email: boolean;
}

/**
 * Book-submission emails are opt-in: coaches must enable the
 * `book_submitted_email` notification preference (default off). They also
 * need a work email, like every other email notification.
 */
function isReachable(profile: Reachable | null): boolean {
  return (
    Boolean(profile?.work_email) &&
    profile?.book_submitted_email === true
  );
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

type CoachRow = Pick<CoachRecipient, 'id' | 'work_email' | 'team_id'>;

/**
 * Direct reads of other profiles' notification_preferences rows are blocked by
 * RLS (owner-only), so preferences come from the SECURITY DEFINER RPC. A
 * missing read defaults to false (opt-in), which drops the coach.
 */
async function coachesWithPreferences(
  supabase: SupabaseClient<Database>,
  coaches: CoachRow[],
): Promise<CoachRecipient[]> {
  const withPreferences = await Promise.all(
    coaches.map(async (coach) => {
      const { data, error } = await supabase.rpc('get_notification_preferences', {
        p_profile_id: coach.id,
      });
      if (error) throw error;
      return { ...coach, book_submitted_email: data?.[0]?.book_submitted_email ?? false };
    }),
  );
  return withPreferences;
}

export async function notifyBookSubmitted(
  supabase: SupabaseClient<Database>,
  params: NotifyBookSubmittedParams,
): Promise<void> {
  const [
    { data: book, error: bookError },
    { data: submitter, error: submitterError },
    { data: coaches, error: coachesError },
  ] = await Promise.all([
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
      .select('id, work_email, team_id')
      .eq('role', 'coach'),
  ]);

  // A failed read must surface as an error, not masquerade as "nobody to notify".
  const readError = bookError ?? submitterError ?? coachesError;
  if (readError) throw readError;

  if (!book || !submitter) {
    logNotificationSkipped('notifyBookSubmitted', 'book or submitter not found', {
      bookId: params.bookId,
      submitterProfileId: params.submitterProfileId,
    });
    return;
  }

  const recipients = selectCoachRecipients(
    await coachesWithPreferences(supabase, coaches ?? []),
    submitter.team_id,
  );
  if (recipients.length === 0) {
    // Coach emails are opt-in, so this is the normal case for most teams.
    logNotificationSkipped('notifyBookSubmitted', 'no coach opted in', { bookId: params.bookId }, 'info');
    return;
  }

  const { subject, html } = bookSubmittedEmail({
    bookTitle: book.title_cs,
    bookAuthor: book.author,
    submitterName: submitter.name ?? 'Téčko',
    suggestedPoints: book.book_points === null ? null : Number(book.book_points),
    pointsReason: book.list_status_reason,
    reviewUrl: `${params.origin}/cteni/sprava`,
  });

  // One at a time: parallel sends to a large coach list trip Resend's per-second
  // rate limit, and Promise.all would abandon everyone after the first failure.
  const failures: unknown[] = [];
  for (const coach of recipients) {
    try {
      await sendEmail({ to: coach.work_email as string, subject, html });
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length > 0) {
    // The server logger records only the top-level message, so inline the reasons.
    const reasons = [...new Set(failures.map((e) => (e instanceof Error ? e.message : String(e))))];
    throw new AggregateError(
      failures,
      `Book submission email failed for ${failures.length} of ${recipients.length} coaches (book ${params.bookId}): ${reasons.join('; ')}`,
    );
  }
}

export interface NotifyBookDecidedParams {
  bookId: string;
  origin: string;
}

export async function notifyBookDecided(
  supabase: SupabaseClient<Database>,
  params: NotifyBookDecidedParams,
): Promise<void> {
  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('title_cs, book_points, list_status, list_status_reason, created_by_profile_id')
    .eq('id', params.bookId)
    .maybeSingle();

  if (bookError) throw bookError;

  if (!book) {
    logNotificationSkipped('notifyBookDecided', 'book not found', { bookId: params.bookId });
    return;
  }

  const { data: submitter, error: submitterError } = await supabase
    .from('profiles')
    .select('work_email')
    .eq('id', book.created_by_profile_id)
    .maybeSingle();

  if (submitterError) throw submitterError;

  if (!submitter?.work_email) {
    logNotificationSkipped('notifyBookDecided', 'submitter profile unavailable', {
      bookId: params.bookId,
      submitterProfileId: book.created_by_profile_id,
    });
    return;
  }

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
