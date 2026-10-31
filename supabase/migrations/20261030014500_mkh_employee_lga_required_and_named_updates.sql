-- MKH: make Employee LGA mandatory and set Jude Elegbede + Declan Rice to Kosofe LGA.
-- Apply only to the intended MKH TEST Supabase project first.
-- Existing rows with NULL lga_id are preserved by the NOT VALID constraint,
-- but every new or updated employee row must have an LGA.

BEGIN;

DO $$
DECLARE
    v_kosofe_count integer;
    v_kosofe_id uuid;
    v_kosofe_state_id uuid;
    v_jude_count integer;
    v_declan_count integer;
    v_rows integer;
    v_constraint_exists boolean;
BEGIN
    -- Resolve exactly one Kosofe LGA within Lagos State.
    SELECT count(*)
      INTO v_kosofe_count
      FROM public.local_governments lg
      JOIN public.states s ON s.id = lg.state_id
     WHERE lower(btrim(lg.name)) IN ('kosofe', 'kosofe lga')
       AND lower(btrim(s.name)) = 'lagos';

    IF v_kosofe_count <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one Kosofe LGA in Lagos State; found %.',
            v_kosofe_count;
    END IF;

    SELECT lg.id, lg.state_id
      INTO v_kosofe_id, v_kosofe_state_id
      FROM public.local_governments lg
      JOIN public.states s ON s.id = lg.state_id
     WHERE lower(btrim(lg.name)) IN ('kosofe', 'kosofe lga')
       AND lower(btrim(s.name)) = 'lagos';

    -- Require one unambiguous employee record for each requested name.
    SELECT count(*)
      INTO v_jude_count
      FROM public.employees
     WHERE lower(btrim(first_name)) = 'jude'
       AND lower(btrim(last_name)) = 'elegbede';

    IF v_jude_count <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one employee named Jude Elegbede; found %.',
            v_jude_count;
    END IF;

    SELECT count(*)
      INTO v_declan_count
      FROM public.employees
     WHERE lower(btrim(first_name)) = 'declan'
       AND lower(btrim(last_name)) = 'rice';

    IF v_declan_count <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one employee named Declan Rice; found %.',
            v_declan_count;
    END IF;

    -- Do not silently overwrite a conflicting State assignment.
    IF EXISTS (
        SELECT 1
          FROM public.employees
         WHERE (
                 (lower(btrim(first_name)) = 'jude'
                  AND lower(btrim(last_name)) = 'elegbede')
              OR (lower(btrim(first_name)) = 'declan'
                  AND lower(btrim(last_name)) = 'rice')
         )
           AND state_id IS NOT NULL
           AND state_id <> v_kosofe_state_id
    ) THEN
        RAISE EXCEPTION
            'Jude Elegbede or Declan Rice has a State that conflicts with Kosofe LGA. No employee records were changed.';
    END IF;

    UPDATE public.employees
       SET lga_id = v_kosofe_id,
           state_id = COALESCE(state_id, v_kosofe_state_id),
           updated_at = now()
     WHERE lower(btrim(first_name)) = 'jude'
       AND lower(btrim(last_name)) = 'elegbede';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Jude Elegbede update affected % rows; expected 1.', v_rows;
    END IF;

    UPDATE public.employees
       SET lga_id = v_kosofe_id,
           state_id = COALESCE(state_id, v_kosofe_state_id),
           updated_at = now()
     WHERE lower(btrim(first_name)) = 'declan'
       AND lower(btrim(last_name)) = 'rice';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Declan Rice update affected % rows; expected 1.', v_rows;
    END IF;

    -- NOT VALID preserves any pre-existing legacy NULL rows while enforcing
    -- the rule for every INSERT and UPDATE from this point forward.
    SELECT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conrelid = 'public.employees'::regclass
           AND conname = 'employees_lga_id_required_check'
    ) INTO v_constraint_exists;

    IF NOT v_constraint_exists THEN
        ALTER TABLE public.employees
            ADD CONSTRAINT employees_lga_id_required_check
            CHECK (lga_id IS NOT NULL) NOT VALID;
    END IF;
END;
$$;

COMMIT;

-- Result: confirm both requested employee assignments and reveal any legacy
-- employee rows still awaiting an individually verified LGA assignment.
SELECT
    e.first_name,
    e.last_name,
    s.name AS state,
    lg.name AS lga,
    e.lga_id
FROM public.employees e
LEFT JOIN public.states s ON s.id = e.state_id
LEFT JOIN public.local_governments lg ON lg.id = e.lga_id
WHERE (lower(btrim(e.first_name)) = 'jude' AND lower(btrim(e.last_name)) = 'elegbede')
   OR (lower(btrim(e.first_name)) = 'declan' AND lower(btrim(e.last_name)) = 'rice')
ORDER BY e.last_name, e.first_name;

SELECT count(*) AS existing_employee_rows_still_missing_lga
FROM public.employees
WHERE lga_id IS NULL;
