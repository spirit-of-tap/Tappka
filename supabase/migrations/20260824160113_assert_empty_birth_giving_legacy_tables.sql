DO $$
DECLARE
  legacy_table text;
  has_rows boolean;
BEGIN
  FOREACH legacy_table IN ARRAY ARRAY[
    'birth_giving_assignments',
    'birth_giving_email_deliveries',
    'birth_giving_event_organizers',
    'birth_giving_events',
    'birth_giving_looking_for_team',
    'birth_giving_reflections',
    'birth_giving_storage_cleanup_claims',
    'birth_giving_team_members',
    'birth_giving_team_proposals',
    'birth_giving_team_result_files',
    'birth_giving_teams'
  ]
  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I LIMIT 1)',
      legacy_table
    ) INTO has_rows;

    IF has_rows THEN
      RAISE EXCEPTION
        'Birth Giving simplification requires empty legacy tables; %.% contains data',
        'public',
        legacy_table;
    END IF;
  END LOOP;
END
$$;
