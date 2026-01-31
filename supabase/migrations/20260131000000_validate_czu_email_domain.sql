-- Migration: Server-side CZU email domain validation
-- Purpose: Ensures that email addresses being changed must end with @pef.czu.cz or @studenti.czu.cz
-- This uses SECURITY DEFINER to create a trigger on auth.users table for true server-side enforcement
-- The trigger runs at the database level and cannot be bypassed by client-side code

-- Create validation trigger function with SECURITY DEFINER
-- SECURITY DEFINER allows the function to access auth.users table even when called by regular users
-- This provides true server-side enforcement at the Supabase database level
create or replace function public.validate_czu_email_domain_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_email_change text;
  v_domain text;
begin
  -- Only validate on UPDATE (email changes), not INSERT (OAuth signups)
  -- OAuth signups can have any email domain (e.g., Google emails)
  if tg_op != 'UPDATE' then
    return NEW;
  end if;

  -- Validate email field if it changed
  if OLD.email is distinct from NEW.email then
    v_email := NEW.email;
    
    -- Skip validation if email is null or empty
    if v_email is not null and v_email != '' then
      -- Extract domain from email (everything after @)
      v_domain := lower(split_part(v_email, '@', 2));
      
      -- Validate domain is one of the allowed CZU domains
      if v_domain not in ('pef.czu.cz', 'studenti.czu.cz') then
        raise exception 'Email must end with @pef.czu.cz or @studenti.czu.cz. Provided domain: %', v_domain;
      end if;
    end if;
  end if;

  -- Validate email_change field (where Supabase stores new email during change process)
  if OLD.email_change is distinct from NEW.email_change then
    v_email_change := NEW.email_change;
    
    -- Skip validation if email_change is null or empty
    if v_email_change is not null and v_email_change != '' then
      -- Extract domain from email_change (everything after @)
      v_domain := lower(split_part(v_email_change, '@', 2));
      
      -- Validate domain is one of the allowed CZU domains
      if v_domain not in ('pef.czu.cz', 'studenti.czu.cz') then
        raise exception 'Email must end with @pef.czu.cz or @studenti.czu.cz. Provided domain: %', v_domain;
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

-- Grant execute permission to authenticated and anonymous roles
-- This allows the trigger to execute when users update their email
grant execute on function public.validate_czu_email_domain_trigger() to authenticated;
grant execute on function public.validate_czu_email_domain_trigger() to anon;

-- Create trigger on auth.users table
-- This fires BEFORE any update to email or email_change columns
-- The trigger cannot be bypassed - it runs at the database level
drop trigger if exists validate_czu_email_domain_trigger on auth.users;

create trigger validate_czu_email_domain_trigger
before update of email, email_change on auth.users
for each row
execute function public.validate_czu_email_domain_trigger();

-- Add comment explaining the security model
comment on function public.validate_czu_email_domain_trigger() is 
'Server-side trigger function that validates email domains at the database level. Uses SECURITY DEFINER to access auth.users table. Cannot be bypassed by client-side code.';
