-- The grouped-checkout table is written only inside its SECURITY DEFINER
-- database RPC. The service_role may execute that RPC but has no direct table
-- mutation privileges, preventing direct DELETE/TRUNCATE or bypass writes.

BEGIN;

REVOKE ALL ON TABLE public.customer_checkout_groups
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.mkh_create_customer_group_order_from_quotes(
  uuid, jsonb, text, text, text, text, jsonb, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mkh_create_customer_group_order_from_quotes(
  uuid, jsonb, text, text, text, text, jsonb, text, text, text
) TO service_role;

COMMIT;
