-- Current-state reference for all app-owned Postgres functions.
-- NOT applied automatically. To change a function:
--   1. Edit it here.
--   2. pnpm db:generate:custom  (creates an empty migration)
--   3. Paste the changed CREATE OR REPLACE FUNCTION into that migration.
-- Extracted from the live schema on 2026-06-12.

CREATE OR REPLACE FUNCTION public.before_user_created_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_provider text;
  v_encrypted_password text;
  v_app_metadata jsonb;
  v_identity jsonb;
  v_has_google_identity boolean := false;
begin
  v_encrypted_password := event->'user'->>'encrypted_password';
  
  if v_encrypted_password is not null then
    raise exception 'Password-based signups are not allowed. Please use Google OAuth to sign in.';
  end if;
  
  v_provider := event->'user'->'raw_user_meta_data'->>'provider';
  v_app_metadata := event->'user'->'app_metadata';
  if v_provider is null and v_app_metadata is not null then
    v_provider := v_app_metadata->>'provider';
  end if;
  
  if event->'user'->'identities' is not null then
    for v_identity in 
      select value from jsonb_array_elements(event->'user'->'identities')
    loop
      if v_identity->>'provider' = 'google' then
        v_has_google_identity := true;
        exit;
      end if;
    end loop;
  end if;
  
  if v_provider = 'google' or v_has_google_identity then
    return event;
  end if;
  
  raise exception 'Only Google OAuth signups are allowed. Please use Google to sign in.';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.broadcast_profile_link_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_auth_user_id uuid;
  v_old_user_id uuid;
  v_new_user_id uuid;
begin
  -- Only proceed if user_id actually changed from null to a value
  -- This means the profile was just linked (admin approved)
  if old.user_id is not null then
    -- Profile was already linked, not a new link event
    return new;
  end if;

  if new.user_id is null then
    -- Profile still not linked
    return new;
  end if;

  -- Get the new user_id
  v_new_user_id := new.user_id;

  -- Get the auth_user_id for this user record
  select auth_user_id into v_auth_user_id
  from public.users
  where id = v_new_user_id;

  -- If no auth_user_id found, cannot broadcast
  if v_auth_user_id is null then
    return new;
  end if;

  -- Broadcast to user-specific channel: user:{auth_user_id}:profile
  -- This allows all devices for this user to receive the notification
  -- Function signature: realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true)
  perform realtime.send(
    jsonb_build_object(
      'auth_user_id', v_auth_user_id,
      'user_id', v_new_user_id,
      'profile_id', new.id,
      'profile_name', new.name,
      'profile_role', new.role,
      'work_email', new.work_email,
      'linked_at', now(),
      'timestamp', now()
    ),
    'profile_linked',
    'user:' || v_auth_user_id::text || ':profile',
    true -- private channel
  );

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.broadcast_verified_work_email_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
declare
  v_user_id uuid;
  v_old_email text;
  v_new_email text;
begin
  -- Only proceed if verified_work_email actually changed
  if old.verified_work_email is not distinct from new.verified_work_email then
    return new;
  end if;

  -- Get the auth_user_id for this user record
  v_user_id := new.auth_user_id;

  -- If no auth_user_id, cannot broadcast
  if v_user_id is null then
    return new;
  end if;

  -- Get old and new email values
  v_old_email := old.verified_work_email;
  v_new_email := new.verified_work_email;

  -- Broadcast to user-specific channel: user:{auth_user_id}:verification
  -- This allows all devices for this user to receive the notification
  -- Function signature: realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true)
  perform realtime.send(
    jsonb_build_object(
      'user_id', v_user_id,
      'old_email', v_old_email,
      'new_email', v_new_email,
      'verified_at', new.verified_work_email_at,
      'timestamp', now()
    ),
    'verified_work_email_changed',
    'user:' || v_user_id::text || ':verification',
    true -- private channel
  );

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.coach_can_review_essay(p_essay_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select public.is_coach_or_admin()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.essays e
        join public.profiles author on author.id = e.author_profile_id
        join public.profiles caller on caller.id = public.current_profile_id()
        where e.id = p_essay_id
          and author.team_id is not null
          and author.team_id = caller.team_id
      )
    );
$function$
;

CREATE OR REPLACE FUNCTION public.current_profile_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select p.id
  from public.profiles p
  join public.users u on u.id = p.user_id
  where u.auth_user_id = (select auth.uid())
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_best_books_per_category(top_n integer DEFAULT 3)
 RETURNS TABLE(tag text, id uuid, title text, author text, cover_path text, description text, preview_link text, tags text[], book_points integer, essay_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  WITH ranked AS (
    SELECT
      t.tag,
      b.id, b.title, b.author, b.cover_path, b.description, b.preview_link,
      b.tags, b.book_points, b.essay_count,
      ROW_NUMBER() OVER (
        PARTITION BY t.tag
        ORDER BY (b.essay_count * 3 + b.book_points) DESC, b.created_at DESC
      ) AS rn
    FROM public.books_with_essay_count b
    CROSS JOIN LATERAL unnest(b.tags) AS t(tag)
    WHERE b.status = 'approved'
  )
  SELECT tag, id, title, author, cover_path, description, preview_link, tags, book_points, essay_count
  FROM ranked
  WHERE rn <= top_n
  ORDER BY tag, rn;
$function$
;

CREATE OR REPLACE FUNCTION public.get_teams_with_member_stats()
 RETURNS TABLE(team_id uuid, team_name text, profile_id uuid, profile_name text, profile_picture text, essay_count bigint, book_points bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  WITH member_essays AS (
    SELECT author_profile_id, COUNT(id) AS essay_count
    FROM public.essays
    WHERE published = true
    GROUP BY author_profile_id
  ),
  member_points AS (
    SELECT sub.author_profile_id, COALESCE(SUM(b.book_points), 0) AS book_points
    FROM (
      SELECT DISTINCT e.author_profile_id, e.book_id
      FROM public.essays e
      WHERE e.book_id IS NOT NULL AND e.published = true
    ) sub
    JOIN public.books b ON b.id = sub.book_id AND b.status = 'approved'
    GROUP BY sub.author_profile_id
  )
  SELECT
    t.id          AS team_id,
    t.name        AS team_name,
    p.id          AS profile_id,
    p.name        AS profile_name,
    p.picture     AS profile_picture,
    COALESCE(me.essay_count, 0)  AS essay_count,
    COALESCE(mp.book_points, 0)  AS book_points
  FROM public.teams t
  JOIN public.profiles p ON p.team_id = t.id AND p.removed_access IS NULL
  LEFT JOIN member_essays me ON me.author_profile_id = p.id
  LEFT JOIN member_points mp ON mp.author_profile_id = p.id
  ORDER BY t.name, COALESCE(mp.book_points, 0) DESC, p.name;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_essay_view_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  update public.essays
    set view_count = view_count + 1
    where id = new.essay_id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_essay_vote_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    update public.essays set vote_count = vote_count + 1 where id = new.essay_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.essays set vote_count = greatest(0, vote_count - 1) where id = old.essay_id;
    return old;
  end if;
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_google_email text;
  v_google_full_name text;
  v_google_profile_picture text;
  v_raw_meta_data jsonb;
begin
  v_raw_meta_data := new.raw_user_meta_data;
  v_google_email := coalesce(new.email, v_raw_meta_data->>'email');
  v_google_full_name := v_raw_meta_data->>'full_name';
  v_google_profile_picture := coalesce(
    v_raw_meta_data->>'avatar_url',
    v_raw_meta_data->>'picture'
  );
  
  insert into public.users (
    auth_user_id,
    google_email,
    google_full_name,
    google_profile_picture
  )
  values (
    new.id,
    v_google_email,
    v_google_full_name,
    v_google_profile_picture
  )
  on conflict (auth_user_id) do update set
    google_email = coalesce(excluded.google_email, public.users.google_email),
    google_full_name = coalesce(excluded.google_full_name, public.users.google_full_name),
    google_profile_picture = coalesce(excluded.google_profile_picture, public.users.google_profile_picture);
  
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_user_update_restriction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
declare
  -- Whitelist: fields that users are allowed to modify
  v_allowed_fields text[] := array['suggested_work_email'];
  
  -- System fields: can be updated by trigger functions (SECURITY DEFINER), not by users
  v_system_fields text[] := array['verified_work_email', 'verified_work_email_at'];
  
  -- Fields with special handling logic (not reset from OLD)
  v_special_fields text[] := array['last_otp_sent_at', 'updated_at'];
  
  -- JSONB representations of OLD and NEW records
  v_old_jsonb jsonb;
  v_new_jsonb jsonb;
  v_result_jsonb jsonb;
  
  -- Column name for iteration
  v_column_name text;
begin
  -- Convert records to jsonb for dynamic manipulation (must be first)
  v_old_jsonb := to_jsonb(old);
  v_new_jsonb := to_jsonb(new);
  
  -- Start with OLD values (protected state)
  v_result_jsonb := v_old_jsonb;
  
  -- Allow only whitelisted fields from NEW to override OLD values
  foreach v_column_name in array v_allowed_fields
  loop
    if v_new_jsonb ? v_column_name then
      v_result_jsonb := jsonb_set(v_result_jsonb, array[v_column_name], v_new_jsonb->v_column_name);
    end if;
  end loop;
  
  -- Allow system fields to be updated by trigger functions
  -- When verified_work_email is being set/changed, this indicates a system trigger update
  -- Users cannot directly set verified_work_email due to RLS and application logic
  if v_new_jsonb ? 'verified_work_email' and (v_old_jsonb->>'verified_work_email') is distinct from (v_new_jsonb->>'verified_work_email') then
    -- This is a system update setting verified_work_email, allow both system fields
    foreach v_column_name in array v_system_fields
    loop
      if v_new_jsonb ? v_column_name then
        v_result_jsonb := jsonb_set(v_result_jsonb, array[v_column_name], v_new_jsonb->v_column_name);
      end if;
    end loop;
  end if;
  
  -- Handle special field: last_otp_sent_at
  -- Automatically update when suggested_work_email changes
  if (v_old_jsonb->>'suggested_work_email') is distinct from (v_new_jsonb->>'suggested_work_email') then
    v_result_jsonb := jsonb_set(v_result_jsonb, array['last_otp_sent_at'], to_jsonb(now()));
  else
    -- Keep existing last_otp_sent_at if suggested_work_email hasn't changed
    v_result_jsonb := jsonb_set(v_result_jsonb, array['last_otp_sent_at'], v_old_jsonb->'last_otp_sent_at');
  end if;
  
  -- Preserve updated_at from NEW (will be set by handle_updated_at() trigger)
  -- But we include it here to ensure it's not reset
  if v_new_jsonb ? 'updated_at' then
    v_result_jsonb := jsonb_set(v_result_jsonb, array['updated_at'], v_new_jsonb->'updated_at');
  end if;
  
  -- Convert jsonb back to record type using jsonb_populate_record
  -- This preserves proper type casting for all columns
  new := jsonb_populate_record(null::public.users, v_result_jsonb);
  
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.profiles p
    join public.users u on u.id = p.user_id
    where u.auth_user_id = (select auth.uid())
      and p.role = 'admin'::public.profile_role
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_coach_or_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.profiles p
    join public.users u on u.id = p.user_id
    where u.auth_user_id = (select auth.uid())
      and p.role = any(array['coach'::public.profile_role, 'admin'::public.profile_role])
  );
$function$
;

CREATE OR REPLACE FUNCTION public.link_user_to_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_user_id uuid;
  v_auth_email text;
begin
  -- Get the email from auth.users (use NEW.email after update)
  v_auth_email := new.email;
  
  -- Only proceed if email is not null and has changed
  if v_auth_email is null or v_auth_email = '' then
    return new;
  end if;
  
  -- Find the public.users row that matches this auth.users.id
  select id into v_user_id
  from public.users
  where auth_user_id = new.id;
  
  -- If no matching public.users row found, return early
  if v_user_id is null then
    return new;
  end if;
  
  -- Link profile to user if work_email matches auth.users.email
  -- Only update if profile exists and is not already linked to a different user
  -- Normalize both sides of comparison to handle case/whitespace differences
  update public.profiles
  set user_id = v_user_id
  where lower(trim(work_email)) = lower(trim(v_auth_email))
    and (user_id is null or user_id = v_user_id);
  
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.protect_approved_book()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if old.status = 'approved'::public.book_status then
    if new.status is distinct from old.status
       or new.book_points is distinct from old.book_points then
      raise exception 'Approved books are immutable; status and book_points cannot change.';
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_essay_view(p_essay_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  insert into public.essay_views (essay_id, viewer_profile_id)
  values (p_essay_id, v_profile_id)
  on conflict (essay_id, viewer_profile_id)
  do update set last_viewed_at = now();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_verified_work_email_on_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_user_id uuid;
  v_email text;
  v_domain text;
begin
  -- Determine which email to use: prefer new.email, fall back to email_change if email didn't change
  -- When email_change is verified, Supabase typically:
  -- 1. Sets email_change to the new email (temporary)
  -- 2. Verifies OTP
  -- 3. Moves email_change to email and clears email_change
  -- So we need to check both fields
  
  -- Check if email changed
  if old.email is distinct from new.email then
    v_email := new.email;
  -- Check if email_change was cleared (moved to email)
  elsif old.email_change is distinct from new.email_change and (new.email_change is null or new.email_change = '') then
    -- email_change was cleared, use the current email
    v_email := new.email;
  else
    -- No relevant change
    return new;
  end if;
  
  -- Only proceed if email is not null and not empty
  if v_email is null or v_email = '' then
    return new;
  end if;
  
  -- Extract domain from email
  v_domain := lower(split_part(v_email, '@', 2));
  
  -- Only update verified_work_email if domain is a CZU domain
  if v_domain not in ('pef.czu.cz', 'studenti.czu.cz') then
    return new;
  end if;
  
  -- Find the public.users row that matches this auth.users.id
  select id into v_user_id
  from public.users
  where auth_user_id = new.id;
  
  -- If no matching public.users row found, return early
  if v_user_id is null then
    return new;
  end if;
  
  -- Update verified_work_email and verified_work_email_at
  -- This happens after OTP verification succeeds, so the email is verified
  -- Only update if the email is different from what's already stored (or not set)
  update public.users
  set verified_work_email = v_email,
      verified_work_email_at = now()
  where id = v_user_id
    and (verified_work_email is null or verified_work_email != v_email);
  
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_czu_email_domain_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_email text;
  v_email_change text;
  v_domain text;
  v_user_id uuid;
  v_has_linked_profile boolean;
begin
  if tg_op != 'UPDATE' then
    return NEW;
  end if;

  -- Check if user has a linked profile before allowing email changes
  -- Find the public.users row that matches this auth.users.id
  select id into v_user_id
  from public.users
  where auth_user_id = new.id;

  -- If user exists, check if they have a linked profile
  if v_user_id is not null then
    select exists (
      select 1
      from public.profiles
      where user_id = v_user_id
    ) into v_has_linked_profile;

    -- If user has a linked profile, prevent email changes
    if v_has_linked_profile then
      if OLD.email is distinct from NEW.email then
        raise exception 'Cannot change email address once linked to a profile. Your email is used to maintain your profile connection.';
      end if;
      
      if OLD.email_change is distinct from NEW.email_change then
        raise exception 'Cannot change email address once linked to a profile. Your email is used to maintain your profile connection.';
      end if;
    end if;
  end if;

  -- Continue with existing domain validation for email_change
  if OLD.email_change is distinct from NEW.email_change then
    v_email_change := NEW.email_change;
    
    if v_email_change is not null and v_email_change != '' then
      v_domain := lower(split_part(v_email_change, '@', 2));
      
      if v_domain not in ('pef.czu.cz', 'studenti.czu.cz') then
        raise exception 'Email must end with @pef.czu.cz or @studenti.czu.cz. Provided domain: %', v_domain;
      end if;
    end if;
  end if;

  -- Continue with existing domain validation for email
  if OLD.email is distinct from NEW.email then
    v_email := NEW.email;
    
    if v_email is not null and v_email != '' then
      v_domain := lower(split_part(v_email, '@', 2));
      
      if v_domain not in ('pef.czu.cz', 'studenti.czu.cz') then
        raise exception 'Email must end with @pef.czu.cz or @studenti.czu.cz. Provided domain: %', v_domain;
      end if;
    end if;
  end if;

  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_picture_only_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_db_role text := current_setting('role', true);
  v_jwt_role text := current_setting('request.jwt.claim.role', true);
begin
  -- bypass restriction for trusted database/system sessions (sql editor, migrations, admin flows)
  if
    session_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
    or current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
    or v_db_role in ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin')
    or v_jwt_role = 'service_role'
  then
    return new;
  end if;

  -- allow user_id-only changes that are performed by trusted database workflows
  -- (for example profile linking or fk cascade to null)
  if old.user_id is distinct from new.user_id then
    if (
      old.id is not distinct from new.id
      and old.name is not distinct from new.name
      and old.work_email is not distinct from new.work_email
      and old.role is not distinct from new.role
      and old.team_id is not distinct from new.team_id
      and old.phone_number is not distinct from new.phone_number
      and old.personal_email is not distinct from new.personal_email
      and old.date_of_birth is not distinct from new.date_of_birth
      and old.removed_access is not distinct from new.removed_access
      and old.removed_access_by is not distinct from new.removed_access_by
      and old.created_at is not distinct from new.created_at
    ) then
      return new;
    end if;
  end if;

  -- for regular users, block changes to every field except picture (and updated_at handled elsewhere)
  if (
    old.id is distinct from new.id
    or old.name is distinct from new.name
    or old.user_id is distinct from new.user_id
    or old.work_email is distinct from new.work_email
    or old.role is distinct from new.role
    or old.team_id is distinct from new.team_id
    or old.phone_number is distinct from new.phone_number
    or old.personal_email is distinct from new.personal_email
    or old.date_of_birth is distinct from new.date_of_birth
    or old.removed_access is distinct from new.removed_access
    or old.removed_access_by is distinct from new.removed_access_by
    or old.created_at is distinct from new.created_at
  ) then
    raise exception 'Only picture column can be updated by users';
  end if;

  return new;
end;
$function$
;