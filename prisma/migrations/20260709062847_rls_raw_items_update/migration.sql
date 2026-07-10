-- Revoke table-level SELECT and UPDATE privileges on raw_items from app_user
REVOKE SELECT, UPDATE ON public.raw_items FROM app_user;

-- Grant column-level SELECT on non-sensitive columns of raw_items to app_user
GRANT SELECT (id, name, unit, current_stock, min_threshold, created_at, updated_at) ON public.raw_items TO app_user;

-- Grant column-level UPDATE on current_stock of raw_items to app_user
GRANT UPDATE (current_stock) ON public.raw_items TO app_user;

-- Add RLS SELECT and UPDATE policies on raw_items permitting the WORKER role
CREATE POLICY worker_select ON public.raw_items
  FOR SELECT
  TO app_user
  USING (get_current_role() = 'WORKER');

CREATE POLICY worker_update_stock ON public.raw_items
  FOR UPDATE
  TO app_user
  USING (get_current_role() = 'WORKER')
  WITH CHECK (get_current_role() = 'WORKER');