DO $$
DECLARE
  routine_ids text[];
  routine_id text;
BEGIN
  -- Materialize the full list as canonical text first so a CASCADE from an
  -- earlier DROP cannot leave a stale regprocedure OID behind.
  SELECT array_agg(p.oid::regprocedure::text)
    INTO routine_ids
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prokind = 'f'
     AND (
       substring(p.proname for 12) = 'birth_giving'
       OR p.proname = 'can_view_birth_giving_event_organizers'
     );

  FOREACH routine_id IN ARRAY routine_ids
  LOOP
    EXECUTE format(
      'DROP FUNCTION IF EXISTS %s CASCADE',
      routine_id
    );
  END LOOP;
END
$$;
