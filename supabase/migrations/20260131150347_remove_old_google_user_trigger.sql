-- Migration: Remove old handle_new_google_user function and trigger
-- Purpose: Removes the broken handle_new_google_user() function that tries to access new.identities
-- The new handle_new_auth_user() function replaces this functionality
-- Affected tables: auth.users (trigger removal)
-- Special considerations: Old function was causing errors because auth.users doesn't have an identities column

-- Drop the old trigger that calls the broken function
drop trigger if exists on_auth_user_created_populate_users on auth.users;

-- Drop the old function that was causing errors
-- This function tried to access new.identities which doesn't exist on auth.users
drop function if exists public.handle_new_google_user();

comment on migration is 'Removed old handle_new_google_user() function and trigger that was causing errors. Replaced by handle_new_auth_user() function which correctly accesses auth.users data.';
