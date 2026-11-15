-- MKH Task 1: additive columns for operational assignments.
-- Does not change employee role creation, access assignments, or existing vendor-zone links.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS zone_id uuid NULL REFERENCES public.zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_vendor_id uuid NULL REFERENCES public.vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS employees_zone_id_idx
  ON public.employees(zone_id) WHERE zone_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS employees_assigned_vendor_id_idx
  ON public.employees(assigned_vendor_id) WHERE assigned_vendor_id IS NOT NULL;
