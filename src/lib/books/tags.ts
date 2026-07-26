import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

interface BookTagJoinRow {
  tags: { name: string } | null;
}

/**
 * Derives display tag names from a `book_tags → tags` join payload.
 */
export function tagNamesFromJoin(
  bookTags: BookTagJoinRow[] | null | undefined,
): string[] {
  return (bookTags ?? [])
    .map((row) => row.tags?.name)
    .filter((name): name is string => Boolean(name));
}

/**
 * Resolves tag names to ids, creating missing tags when the caller may insert.
 * Returns ids in the same order as unique trimmed names.
 */
export async function resolveTagIds(
  supabase: SupabaseClient<Database>,
  names: string[],
  profileId: string,
): Promise<string[]> {
  const uniqueNames = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (uniqueNames.length === 0) return [];

  const { data: existing, error: selectError } = await supabase
    .from('tags')
    .select('id, name')
    .in('name', uniqueNames);

  if (selectError) throw selectError;

  const byName = new Map((existing ?? []).map((t) => [t.name, t.id]));
  const missing = uniqueNames.filter((name) => !byName.has(name));

  if (missing.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('tags')
      .insert(
        missing.map((name) => ({
          name,
          created_by_profile_id: profileId,
          updated_by_profile_id: profileId,
        })),
      )
      .select('id, name');

    if (insertError) throw insertError;

    for (const tag of inserted ?? []) {
      byName.set(tag.name, tag.id);
    }
  }

  return uniqueNames
    .map((name) => byName.get(name))
    .filter((id): id is string => Boolean(id));
}

/**
 * Replaces all tag links for a book with the given tag names.
 */
export async function setBookTags(
  supabase: SupabaseClient<Database>,
  bookId: string,
  tagNames: string[],
  profileId: string,
): Promise<void> {
  const tagIds = await resolveTagIds(supabase, tagNames, profileId);

  const { error: deleteError } = await supabase
    .from('book_tags')
    .delete()
    .eq('book_id', bookId);

  if (deleteError) throw deleteError;

  if (tagIds.length === 0) return;

  const { error: insertError } = await supabase.from('book_tags').insert(
    tagIds.map((tagId) => ({
      book_id: bookId,
      tag_id: tagId,
      created_by_profile_id: profileId,
      updated_by_profile_id: profileId,
    })),
  );

  if (insertError) throw insertError;
}

/**
 * Returns book ids that have at least one of the given tag names.
 */
export async function getBookIdsByTagNames(
  supabase: SupabaseClient<Database>,
  tagNames: string[],
): Promise<string[]> {
  if (tagNames.length === 0) return [];

  const { data, error } = await supabase
    .from('book_tags')
    .select('book_id, tags!inner(name)')
    .in('tags.name', tagNames);

  if (error) throw error;

  return [...new Set((data ?? []).map((row) => row.book_id))];
}
