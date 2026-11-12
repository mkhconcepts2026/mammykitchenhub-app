-- MKH employee LGA completion.
-- Assign Kosofe LGA to the five user-identified legacy employees and
-- reassert the earlier Jude Elegbede + Declan Rice assignments.
-- Apply ONLY to the intended MKH TEST Supabase project.
-- Exact employee number + name + email matching is used as a guard.
-- One transaction: any mismatch or remaining NULL LGA rolls back all updates.

BEGIN;

DO $$
DECLARE
    v_kosofe_count integer;
    v_kosofe_id uuid;
    v_kosofe_state_id uuid;
    v_expected_match_count integer;
    v_updated_count integer;
    v_missing_count integer;
    v_named_count integer;
    v_constraint_exists boolean;
BEGIN
    -- Resolve exactly one Kosofe LGA in Lagos State.
    SELECT count(*)
      INTO v_kosofe_count
      FROM public.local_governments lg
      JOIN public.states s ON s.id = lg.state_id
     WHERE lower(btrim(lg.name)) IN ('kosofe', 'kosofe lga')
       AND lower(btrim(s.name)) = 'lagos';

    IF v_kosofe_count <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one Kosofe LGA in Lagos State; found %. No employee records changed.',
            v_kosofe_count;
    END IF;

    SELECT lg.id, lg.state_id
      INTO v_kosofe_id, v_kosofe_state_id
      FROM public.local_governments lg
      JOIN public.states s ON s.id = lg.state_id
     WHERE lower(btrim(lg.name)) IN ('kosofe', 'kosofe lga')
       AND lower(btrim(s.name)) = 'lagos';

    -- Verify the five employees by their supplied employee number, name and email.
    WITH expected(employee_number, first_name, last_name, email) AS (
        VALUES
        ('MKH-2026-624133', 'Lizzy', 'Briggs', 'lizzy.briggs@mammykitchenhub.com'),
        ('MKH-2026-660777', 'Onyeisi', 'Nkwo', 'onyeisi.nkwo@mammykitchenhub.com'),
        ('MKH-2026-523469', 'Phil', 'Nkwo', 'phil.nkwo@mammykitchenhub.com'),
        ('MKH-2026-308396', 'susan', 'brown', 'susan.brown@mammykitchenhub.com'),
        ('MKH-2026-904871', 'Tom', 'Onodu', 'tom.onodu1@mammykitchenhub.com')
    )
    SELECT count(*)
      INTO v_expected_match_count
      FROM expected x
      JOIN public.employees e
        ON e.employee_number = x.employee_number
       AND lower(btrim(e.first_name)) = lower(x.first_name)
       AND lower(btrim(e.last_name)) = lower(x.last_name)
       AND lower(btrim(e.email)) = lower(x.email);

    IF v_expected_match_count <> 5 THEN
        RAISE EXCEPTION
            'Only % of the 5 supplied employee identities matched employee number, name and email. No employee records changed.',
            v_expected_match_count;
    END IF;

    -- Do not silently overwrite a conflicting non-null State.
    IF EXISTS (
        WITH expected(employee_number) AS (
            VALUES
            ('MKH-2026-624133'),
            ('MKH-2026-660777'),
            ('MKH-2026-523469'),
            ('MKH-2026-308396'),
            ('MKH-2026-904871')
        )
        SELECT 1
          FROM public.employees e
          JOIN expected x ON x.employee_number = e.employee_number
         WHERE e.state_id IS NOT NULL
           AND e.state_id <> v_kosofe_state_id
    ) THEN
        RAISE EXCEPTION
            'At least one of the five employees has a State that conflicts with Kosofe LGA. No employee records changed.';
    END IF;

    -- Update the five supplied employee records.
    WITH expected(employee_number, first_name, last_name, email) AS (
        VALUES
        ('MKH-2026-624133', 'Lizzy', 'Briggs', 'lizzy.briggs@mammykitchenhub.com'),
        ('MKH-2026-660777', 'Onyeisi', 'Nkwo', 'onyeisi.nkwo@mammykitchenhub.com'),
        ('MKH-2026-523469', 'Phil', 'Nkwo', 'phil.nkwo@mammykitchenhub.com'),
        ('MKH-2026-308396', 'susan', 'brown', 'susan.brown@mammykitchenhub.com'),
        ('MKH-2026-904871', 'Tom', 'Onodu', 'tom.onodu1@mammykitchenhub.com')
    )
    UPDATE public.employees e
       SET lga_id = v_kosofe_id,
           state_id = v_kosofe_state_id,
           updated_at = now()
      FROM expected x
     WHERE e.employee_number = x.employee_number
       AND lower(btrim(e.first_name)) = lower(x.first_name)
       AND lower(btrim(e.last_name)) = lower(x.last_name)
       AND lower(btrim(e.email)) = lower(x.email);
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count <> 5 THEN
        RAISE EXCEPTION
            'Expected to update 5 supplied employees; updated %. Transaction will roll back.',
            v_updated_count;
    END IF;

    -- Reassert the two earlier requested assignments: exactly one of each name.
    SELECT count(*)
      INTO v_named_count
      FROM public.employees
     WHERE (lower(btrim(first_name)) = 'jude' AND lower(btrim(last_name)) = 'elegbede')
        OR (lower(btrim(first_name)) = 'declan' AND lower(btrim(last_name)) = 'rice');

    IF v_named_count <> 2 THEN
        RAISE EXCEPTION
            'Expected exactly one Jude Elegbede and one Declan Rice; found % combined. Transaction will roll back.',
            v_named_count;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM public.employees
         WHERE (
                 (lower(btrim(first_name)) = 'jude' AND lower(btrim(last_name)) = 'elegbede')
              OR (lower(btrim(first_name)) = 'declan' AND lower(btrim(last_name)) = 'rice')
         )
           AND state_id IS NOT NULL
           AND state_id <> v_kosofe_state_id
    ) THEN
        RAISE EXCEPTION
            'Jude Elegbede or Declan Rice has a conflicting State. Transaction will roll back.';
    END IF;

    UPDATE public.employees
       SET lga_id = v_kosofe_id,
           state_id = v_kosofe_state_id,
           updated_at = now()
     WHERE (lower(btrim(first_name)) = 'jude' AND lower(btrim(last_name)) = 'elegbede')
        OR (lower(btrim(first_name)) = 'declan' AND lower(btrim(last_name)) = 'rice');

    -- Require every employee row to have an LGA before committing.
    SELECT count(*)
      INTO v_missing_count
      FROM public.employees
     WHERE lga_id IS NULL;

    IF v_missing_count <> 0 THEN
        RAISE EXCEPTION
            '% employee rows still have no LGA after the requested updates. Transaction will roll back.',
            v_missing_count;
    END IF;

    -- Ensure the mandatory-LGA constraint exists, then validate all historical rows.
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

    ALTER TABLE public.employees
        VALIDATE CONSTRAINT employees_lga_id_required_check;
END;
$$;

COMMIT;

-- Result 1: the seven requested employees should show Lagos / Kosofe.
SELECT
    e.employee_number,
    e.first_name,
    e.last_name,
    e.email,
    s.name AS state,
    lg.name AS lga,
    e.lga_id
FROM public.employees e
LEFT JOIN public.states s ON s.id = e.state_id
LEFT JOIN public.local_governments lg ON lg.id = e.lga_id
WHERE e.employee_number IN (
    'MKH-2026-624133',
    'MKH-2026-660777',
    'MKH-2026-523469',
    'MKH-2026-308396',
    'MKH-2026-904871'
)
   OR (lower(btrim(e.first_name)) = 'jude' AND lower(btrim(e.last_name)) = 'elegbede')
   OR (lower(btrim(e.first_name)) = 'declan' AND lower(btrim(e.last_name)) = 'rice')
ORDER BY e.last_name, e.first_name;

-- Result 2: must return zero. The constraint above is now validated.
SELECT count(*) AS existing_employee_rows_still_missing_lga
FROM public.employees
WHERE lga_id IS NULL;
