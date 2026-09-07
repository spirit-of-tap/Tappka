import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ContentSourceStatus, ContentSourceWithProfiles } from './types';

export interface ContentSourceFilters {
  status?: ContentSourceStatus | 'all';
  createdBy?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const PAGE_SIZE_DEFAULT = 20;

export async function getContentSources(
  supabase: SupabaseClient<Database>,
  filters: ContentSourceFilters = {},
): Promise<ContentSourceWithProfiles[]> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? PAGE_SIZE_DEFAULT;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('content_sources')
    .select('*, created_by:profiles!content_sources_created_by_profile_id_fkey(id, name, picture)')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.status !== 'all') {
    query = query.eq('status', filters.status ?? 'approved');
  }
  if (filters.createdBy) query = query.eq('created_by_profile_id', filters.createdBy);
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    query = query.or(`title.ilike.%${q}%,creator.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ContentSourceWithProfiles[];
}

export async function getContentSourceById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<ContentSourceWithProfiles | null> {
  const { data, error } = await supabase
    .from('content_sources')
    .select('*, created_by:profiles!content_sources_created_by_profile_id_fkey(id, name, picture)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as ContentSourceWithProfiles | null;
}

export async function getPendingContentSources(
  supabase: SupabaseClient<Database>,
): Promise<ContentSourceWithProfiles[]> {
  const { data, error } = await supabase
    .from('content_sources')
    .select('*, created_by:profiles!content_sources_created_by_profile_id_fkey(id, name, picture)')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as ContentSourceWithProfiles[];
}
