-- Migration: Validate CZU email domain on email changes
-- Purpose: Ensures that email addresses being changed must end with @pef.czu.cz or @studenti.czu.cz
-- This provides server-side validation as a security measure in addition to client-side validation

-- Create function to validate CZU email domain
-- This function checks if an email ends with an allowed CZU domain
-- Only validates on email changes (UPDATE), not initial OAuth signups (INSERT)
-- Validates both 'email' and 'email_change' fields since Supabase stores new email in 'email_change' during change process
create or replace function auth.validate_czu_email_domain()
returns trigger
language plpgsql
security invoker
set search_path = ''
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

  -- Validate email_change field if it changed (this is where Supabase stores new email during change process)
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

-- Create function to validate CZU email domain for identities
-- This validates email identities (provider = 'email') when they are created
create or replace function auth.validate_czu_email_identity_domain()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_email text;
  v_domain text;
begin
  -- Only validate email identities, not OAuth providers (google, etc.)
  if NEW.provider != 'email' then
    return NEW;
  end if;

  -- Get the email being set
  v_email := NEW.email;

  -- Skip validation if email is null or empty
  if v_email is null or v_email = '' then
    return NEW;
  end if;

  -- Extract domain from email (everything after @)
  v_domain := lower(split_part(v_email, '@', 2));

  -- Validate domain is one of the allowed CZU domains
  if v_domain not in ('pef.czu.cz', 'studenti.czu.cz') then
    raise exception 'Email must end with @pef.czu.cz or @studenti.czu.cz. Provided domain: %', v_domain;
  end if;

  return NEW;
end;
$$;

-- Create trigger on auth.users table to validate email domain before update
-- This ensures server-side validation of email domains when users change their email
-- Validates both 'email' and 'email_change' fields
-- Note: INSERT is not included to allow OAuth signups with any email domain
create trigger validate_czu_email_domain_trigger
before update of email, email_change on auth.users
for each row
execute function auth.validate_czu_email_domain();

-- Create trigger on auth.identities table to validate email domain when email identities are created
-- This catches email identities created via updateUser() flow
create trigger validate_czu_email_identity_domain_trigger
before insert on auth.identities
for each row
execute function auth.validate_czu_email_identity_domain();
