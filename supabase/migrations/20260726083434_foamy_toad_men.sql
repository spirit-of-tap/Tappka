-- Drop the broken trigger that references essays.view_count (column does not exist)
DROP TRIGGER IF EXISTS essay_views_after_insert_trigger ON public.essay_views;
DROP FUNCTION IF EXISTS public.handle_essay_view_insert();

-- Fix record_essay_view to include NOT NULL created_by_profile_id / updated_by_profile_id
CREATE OR REPLACE FUNCTION public.record_essay_view(p_essay_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_profile_id uuid;
  v_author_id uuid;
begin
  select p.id into v_profile_id
  from public.profiles p
  join public.users u on u.id = p.user_id
  where u.auth_user_id = (select auth.uid())
  limit 1;

  if v_profile_id is null then
    return;
  end if;

  select author_profile_id into v_author_id
  from public.essays
  where id = p_essay_id;

  if v_author_id is null or v_author_id = v_profile_id then
    return;
  end if;

  insert into public.essay_views (essay_id, viewer_profile_id, created_by_profile_id, updated_by_profile_id)
  values (p_essay_id, v_profile_id, v_profile_id, v_profile_id)
  on conflict (essay_id, viewer_profile_id)
  do update set last_viewed_at = now(), updated_by_profile_id = v_profile_id;
end;
$$;
