import type { Database } from '@/lib/supabase/database.types';
import type { Tables } from '@/lib/supabase/tables';

export type ContentSourceKind = Database['public']['Enums']['content_source_kind'];
export type ContentSourceStatus = Database['public']['Enums']['content_source_status'];

export type ContentSource = Tables<'content_sources'>;

export interface CreateContentSourceInput {
  kind: ContentSourceKind;
  title: string;
  creator?: string | null;
  description?: string | null;
  external_url?: string | null;
  /** Student's self-assigned value; a coach may override it on review. */
  points?: number | null;
}

export const CONTENT_SOURCE_KIND_LABELS: Record<ContentSourceKind, string> = {
  podcast: 'Podcast',
  conference: 'Konference',
  program: 'Program',
  other: 'Jiný zdroj',
};

export const CONTENT_SOURCE_STATUS_LABELS: Record<ContentSourceStatus, string> = {
  pending_review: 'Čeká na schválení',
  approved: 'Schváleno',
  archived: 'Zamítnuto',
};

export const CONTENT_SOURCE_KINDS: readonly ContentSourceKind[] = ['podcast', 'conference', 'program', 'other'];
