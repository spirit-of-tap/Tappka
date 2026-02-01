
supabase/migrations/20260131120000_restrict_user_updates.sql (2)
19-35: Hardcoded field list creates maintenance risk.

If new columns are added to public.users in future migrations, this trigger won't automatically protect them from modification. A developer might forget to update this function, creating an unintended security gap.

Consider adding a comment warning about this, or document the pattern clearly:

  -- IMPORTANT: When adding new columns to public.users, 
  -- update this trigger to reset them from OLD values
  new.id := old.id;
  -- ... etc
Alternatively, consider a more dynamic approach using hstore or documenting which columns are allowed to change (whitelist) rather than listing protected columns.




Do a more dynamic approach

---