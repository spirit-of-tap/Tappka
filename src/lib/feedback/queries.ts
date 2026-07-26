import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { FeedbackWithAuthor } from './types';

const FEEDBACK_SELECT = `
  *,
  author:profiles!author_profile_id(id, name, picture, role)
`;

export async function listActiveFeedback(
  supabase: SupabaseClient<Database>,
): Promise<FeedbackWithAuthor[]> {
  const { data, error } = await supabase
    .from('feedback')
    .select(FEEDBACK_SELECT)
    .is('resolved_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as FeedbackWithAuthor[];
}

export async function listArchivedFeedback(
  supabase: SupabaseClient<Database>,
): Promise<FeedbackWithAuthor[]> {
  const { data, error } = await supabase
    .from('feedback')
    .select(FEEDBACK_SELECT)
    .not('resolved_at', 'is', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as FeedbackWithAuthor[];
}
