import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ContentSource, ContentSourceStatus } from './types';

export interface ContentSourceFilters {
  status?: ContentSourceStatus;
  createdBy?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const PAGE_SIZE_DEFAULT = 20;

export async function getContentSources(
  supabase: SupabaseClient<Database>,
  filters: ContentSourceFilters = {},
): Promise<ContentSource[]> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? PAGE_SIZE_DEFAULT;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('content_sources')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to);

  query = query.eq('status', filters.status ?? 'approved');
  if (filters.createdBy) query = query.eq('created_by_profile_id', filters.createdBy);
  if (filters.search?.trim()) query = query.ilike('title', `%${filters.search.trim()}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ContentSource[];
}

export async function getContentSourceById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<ContentSource | null> {
  const { data, error } = await supabase
    .from('content_sources')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as ContentSource | null;
}

export async function getPendingContentSources(
  supabase: SupabaseClient<Database>,
): Promise<ContentSource[]> {
  const { data, error } = await supabase
    .from('content_sources')
    .select('*')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ContentSource[];
}
