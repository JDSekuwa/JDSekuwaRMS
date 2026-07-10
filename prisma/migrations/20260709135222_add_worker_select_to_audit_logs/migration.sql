-- Create RLS SELECT policy on audit_logs for WORKER role
CREATE POLICY worker_select ON public.audit_logs
  FOR SELECT
  USING (get_current_role() = 'WORKER' AND user_id = get_current_user_id());