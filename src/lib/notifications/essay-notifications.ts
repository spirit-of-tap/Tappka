import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';
import { getEssayAuthorInfo } from '@/lib/essays/queries';
import { getProfileById } from '@/lib/komunita/queries';

import { sendEmail } from './send-email';
import { coachReadEmail, commentEmail, replyEmail, voteEmail, type EmailContent, type EssayEmailContext } from './email-templates';

export interface NotifyParams {
  essayId: string;
  actorProfileId: string;
  origin: string;
  commentBody?: string;
}

type PreferenceColumn = 'essay_coach_read_email' | 'essay_comment_email' | 'essay_vote_email';

async function dispatchEssayNotification(
  supabase: SupabaseClient<Database>,
  params: NotifyParams,
  preferenceColumn: PreferenceColumn,
  buildEmail: (ctx: EssayEmailContext) => EmailContent,
): Promise<void> {
  const essay = await getEssayAuthorInfo(supabase, params.essayId);
  if (!essay) return;
  if (essay.authorProfileId === params.actorProfileId) return;

  const [author, actor, { data: preferencesRows, error: preferencesError }] = await Promise.all([
    getProfileById(supabase, essay.authorProfileId),
    getProfileById(supabase, params.actorProfileId),
    supabase.rpc('get_notification_preferences', { p_profile_id: essay.authorProfileId }),
  ]);

  if (!author?.work_email || !actor) return;
  if (!author.beta_access_granted_at) return;
  if (preferencesError) throw preferencesError;

  const preferences = preferencesRows?.[0];
  if (preferences && preferences[preferenceColumn] === false) return;

  const { subject, html } = buildEmail({
    essayTitle: essay.title,
    essayUrl: `${params.origin}/cteni/eseje/${essay.id}`,
    actorName: actor.name ?? 'Někdo',
    commentBody: params.commentBody,
  });

  await sendEmail({ to: author.work_email, subject, html });
}

export async function notifyEssayCoachRead(
  supabase: SupabaseClient<Database>,
  params: NotifyParams,
): Promise<void> {
  await dispatchEssayNotification(supabase, params, 'essay_coach_read_email', coachReadEmail);
}

export async function notifyEssayCommented(
  supabase: SupabaseClient<Database>,
  params: NotifyParams,
): Promise<void> {
  await dispatchEssayNotification(supabase, params, 'essay_comment_email', commentEmail);
}

export interface NotifyReplyParams {
  essayId: string;
  parentId: string;
  actorProfileId: string;
  origin: string;
  replyBody?: string;
}

export async function notifyEssayReplied(
  supabase: SupabaseClient<Database>,
  params: NotifyReplyParams,
): Promise<void> {
  const { essayId, parentId, actorProfileId, origin, replyBody } = params;

  const essay = await getEssayAuthorInfo(supabase, essayId);
  if (!essay) return;

  const { data: parentComment } = await supabase
    .from('essay_comments')
    .select('author_profile_id')
    .eq('id', parentId)
    .is('removed_at', null)
    .maybeSingle();
  if (!parentComment) return;
  if (parentComment.author_profile_id === actorProfileId) return;

  const commentAuthorProfileId = parentComment.author_profile_id as string;

  const [commentAuthor, actor, { data: preferencesRows, error: preferencesError }] = await Promise.all([
    getProfileById(supabase, commentAuthorProfileId),
    getProfileById(supabase, actorProfileId),
    supabase.rpc('get_notification_preferences', { p_profile_id: commentAuthorProfileId }),
  ]);

  if (!commentAuthor?.work_email || !actor) return;
  if (!commentAuthor.beta_access_granted_at) return;
  if (preferencesError) throw preferencesError;

  const preferences = preferencesRows?.[0];
  if (preferences && preferences.essay_comment_email === false) return;

  const { subject, html } = replyEmail({
    essayTitle: essay.title,
    essayUrl: `${origin}/cteni/eseje/${essay.id}`,
    actorName: actor.name ?? 'Někdo',
    commentBody: replyBody,
  });

  await sendEmail({ to: commentAuthor.work_email, subject, html });
}

export async function notifyEssayVoted(
  supabase: SupabaseClient<Database>,
  params: NotifyParams,
): Promise<void> {
  await dispatchEssayNotification(supabase, params, 'essay_vote_email', voteEmail);
}
