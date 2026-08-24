DO $$
DECLARE
  legacy_function record;
BEGIN
  FOR legacy_function IN
    SELECT p.oid::regprocedure AS identity
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND (
         p.proname LIKE 'birth_giving_%'
         OR p.proname = 'can_view_birth_giving_event_organizers'
       )
  LOOP
    EXECUTE format(
      'DROP FUNCTION IF EXISTS %s CASCADE',
      legacy_function.identity
    );
  END LOOP;
END
$$;
