DO $$
DECLARE
  target_table text;
  fk_record record;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['reservas', 'inscripciones']
  LOOP
    IF to_regclass(format('public.%I', target_table)) IS NULL THEN
      CONTINUE;
    END IF;

    FOR fk_record IN
      SELECT
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
       AND tc.table_schema = rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu
        ON rc.unique_constraint_name = ccu.constraint_name
       AND rc.unique_constraint_schema = ccu.constraint_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = target_table
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'clase_id'
        AND ccu.table_name = 'clases'
        AND ccu.column_name = 'id'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', target_table, fk_record.constraint_name);
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (clase_id) REFERENCES public.clases(id) ON DELETE CASCADE',
        target_table,
        fk_record.constraint_name
      );
    END LOOP;
  END LOOP;
END $$;
