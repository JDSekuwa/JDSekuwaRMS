-- Create RLS policies for credit payments and credit ledgers updates by workers
CREATE POLICY worker_insert ON public.credit_payments FOR INSERT WITH CHECK (get_current_role() = 'WORKER');
CREATE POLICY worker_update ON public.credit_ledgers FOR UPDATE USING (get_current_role() = 'WORKER') WITH CHECK (get_current_role() = 'WORKER');
