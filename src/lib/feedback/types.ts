import type { Database } from '@/lib/supabase/database.types';
import type { Tables } from '@/lib/supabase/tables';

export type Feedback = Tables<'feedback'>;

type ProfileRole = Database['public']['Enums']['profile_role'];

export interface FeedbackAuthor {
  id: string;
  name: string;
  picture: string | null;
  role: ProfileRole;
}

export interface FeedbackWithAuthor extends Feedback {
  author: FeedbackAuthor | null;
}
