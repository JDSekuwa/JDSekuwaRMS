-- Create helper functions to read session variables
CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_current_role() RETURNS VARCHAR AS $$
  SELECT COALESCE(NULLIF(current_setting('app.current_role', true), ''), 'SUPER_ADMIN')::VARCHAR;
$$ LANGUAGE sql STABLE;

-- Create raw_items view for workers (excludes cost_price)
CREATE OR REPLACE VIEW raw_items_worker_view AS
  SELECT id, name, unit, current_stock, min_threshold, created_at, updated_at
  FROM raw_items;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories FORCE ROW LEVEL SECURITY;

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items FORCE ROW LEVEL SECURITY;

ALTER TABLE raw_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_items FORCE ROW LEVEL SECURITY;

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes FORCE ROW LEVEL SECURITY;

ALTER TABLE recipe_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_lines FORCE ROW LEVEL SECURITY;

ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables FORCE ROW LEVEL SECURITY;

ALTER TABLE table_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_orders FORCE ROW LEVEL SECURITY;

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;

ALTER TABLE quick_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_sales FORCE ROW LEVEL SECURITY;

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms FORCE ROW LEVEL SECURITY;

ALTER TABLE room_stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_stays FORCE ROW LEVEL SECURITY;

ALTER TABLE credit_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledgers FORCE ROW LEVEL SECURITY;

ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments FORCE ROW LEVEL SECURITY;

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases FORCE ROW LEVEL SECURITY;

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-------------------------------------------------------------------------------
-- 1. Profiles Policies
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON profiles FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_select ON profiles FOR SELECT USING (get_current_role() = 'ADMIN');
CREATE POLICY worker_select ON profiles FOR SELECT USING (get_current_role() = 'WORKER');

-------------------------------------------------------------------------------
-- 2. Menu Categories Policies
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON menu_categories FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_all ON menu_categories FOR ALL USING (get_current_role() = 'ADMIN');
CREATE POLICY worker_select ON menu_categories FOR SELECT USING (get_current_role() = 'WORKER');

-------------------------------------------------------------------------------
-- 3. Menu Items Policies
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON menu_items FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_all ON menu_items FOR ALL USING (get_current_role() = 'ADMIN');
CREATE POLICY worker_select ON menu_items FOR SELECT USING (get_current_role() = 'WORKER');

-------------------------------------------------------------------------------
-- 4. Raw Items Policies (Workers explicitly denied Direct SELECT/WRITE)
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON raw_items FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_all ON raw_items FOR ALL USING (get_current_role() = 'ADMIN');

-------------------------------------------------------------------------------
-- 5. Recipes Policies
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON recipes FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_all ON recipes FOR ALL USING (get_current_role() = 'ADMIN');
CREATE POLICY worker_select ON recipes FOR SELECT USING (get_current_role() = 'WORKER');

-------------------------------------------------------------------------------
-- 6. Recipe Lines Policies
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON recipe_lines FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_all ON recipe_lines FOR ALL USING (get_current_role() = 'ADMIN');
CREATE POLICY worker_select ON recipe_lines FOR SELECT USING (get_current_role() = 'WORKER');

-------------------------------------------------------------------------------
-- 7. Restaurant Tables Policies
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON restaurant_tables FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_all ON restaurant_tables FOR ALL USING (get_current_role() = 'ADMIN');
CREATE POLICY worker_select ON restaurant_tables FOR SELECT USING (get_current_role() = 'WORKER');
CREATE POLICY worker_update ON restaurant_tables FOR UPDATE USING (get_current_role() = 'WORKER') WITH CHECK (get_current_role() = 'WORKER');

-------------------------------------------------------------------------------
-- 8. Table Orders Policies (Workers only read/write their own orders)
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON table_orders FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_all ON table_orders FOR ALL USING (get_current_role() = 'ADMIN');
CREATE POLICY worker_select ON table_orders FOR SELECT USING (get_current_role() = 'WORKER' AND opened_by_id = get_current_user_id());
CREATE POLICY worker_insert ON table_orders FOR INSERT WITH CHECK (get_current_role() = 'WORKER' AND opened_by_id = get_current_user_id());
CREATE POLICY worker_update ON table_orders FOR UPDATE USING (get_current_role() = 'WORKER' AND opened_by_id = get_current_user_id()) WITH CHECK (get_current_role() = 'WORKER' AND opened_by_id = get_current_user_id());

-------------------------------------------------------------------------------
-- 9. Order Items Policies (Workers access items on their own orders/sales/stays)
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON order_items FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_all ON order_items FOR ALL USING (get_current_role() = 'ADMIN');
CREATE POLICY worker_all ON order_items FOR ALL USING (
  get_current_role() = 'WORKER' AND (
    (table_order_id IS NOT NULL AND EXISTS (SELECT 1 FROM table_orders WHERE id = table_order_id AND opened_by_id = get_current_user_id())) OR
    (quick_sale_id IS NOT NULL AND EXISTS (SELECT 1 FROM quick_sales WHERE id = quick_sale_id AND cashier_id = get_current_user_id())) OR
    (room_stay_id IS NOT NULL AND EXISTS (SELECT 1 FROM room_stays WHERE id = room_stay_id AND created_by_id = get_current_user_id()))
  )
);

-------------------------------------------------------------------------------
-- 10. Quick Sales Policies (Workers only read/write their own sales)
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON quick_sales FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_all ON quick_sales FOR ALL USING (get_current_role() = 'ADMIN');
CREATE POLICY worker_select ON quick_sales FOR SELECT USING (get_current_role() = 'WORKER' AND cashier_id = get_current_user_id());
CREATE POLICY worker_insert ON quick_sales FOR INSERT WITH CHECK (get_current_role() = 'WORKER' AND cashier_id = get_current_user_id());
CREATE POLICY worker_update ON quick_sales FOR UPDATE USING (get_current_role() = 'WORKER' AND cashier_id = get_current_user_id()) WITH CHECK (get_current_role() = 'WORKER' AND cashier_id = get_current_user_id());

-------------------------------------------------------------------------------
-- 11. Rooms Policies
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON rooms FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_all ON rooms FOR ALL USING (get_current_role() = 'ADMIN');
CREATE POLICY worker_select ON rooms FOR SELECT USING (get_current_role() = 'WORKER');
CREATE POLICY worker_update ON rooms FOR UPDATE USING (get_current_role() = 'WORKER') WITH CHECK (get_current_role() = 'WORKER');

-------------------------------------------------------------------------------
-- 12. Room Stays Policies (Workers only read/write their own stays)
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON room_stays FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_all ON room_stays FOR ALL USING (get_current_role() = 'ADMIN');
CREATE POLICY worker_select ON room_stays FOR SELECT USING (get_current_role() = 'WORKER' AND created_by_id = get_current_user_id());
CREATE POLICY worker_insert ON room_stays FOR INSERT WITH CHECK (get_current_role() = 'WORKER' AND created_by_id = get_current_user_id());
CREATE POLICY worker_update ON room_stays FOR UPDATE USING (get_current_role() = 'WORKER' AND created_by_id = get_current_user_id()) WITH CHECK (get_current_role() = 'WORKER' AND created_by_id = get_current_user_id());

-------------------------------------------------------------------------------
-- 13. Credit Ledgers Policies
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON credit_ledgers FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_all ON credit_ledgers FOR ALL USING (get_current_role() = 'ADMIN');
CREATE POLICY worker_select ON credit_ledgers FOR SELECT USING (get_current_role() = 'WORKER');
CREATE POLICY worker_insert ON credit_ledgers FOR INSERT WITH CHECK (get_current_role() = 'WORKER');

-------------------------------------------------------------------------------
-- 14. Credit Payments Policies
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON credit_payments FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_all ON credit_payments FOR ALL USING (get_current_role() = 'ADMIN');
CREATE POLICY worker_select ON credit_payments FOR SELECT USING (get_current_role() = 'WORKER');

-------------------------------------------------------------------------------
-- 15. Purchases Policies (Workers denied entirely)
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON purchases FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_all ON purchases FOR ALL USING (get_current_role() = 'ADMIN');

-------------------------------------------------------------------------------
-- 16. Stock Adjustments Policies (Workers denied entirely)
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON stock_adjustments FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_all ON stock_adjustments FOR ALL USING (get_current_role() = 'ADMIN');

-------------------------------------------------------------------------------
-- 17. Audit Logs Policies (Workers can only insert)
-------------------------------------------------------------------------------
CREATE POLICY super_admin_all ON audit_logs FOR ALL USING (get_current_role() = 'SUPER_ADMIN');
CREATE POLICY admin_select ON audit_logs FOR SELECT USING (get_current_role() = 'ADMIN');
CREATE POLICY admin_insert ON audit_logs FOR INSERT WITH CHECK (get_current_role() = 'ADMIN');
CREATE POLICY worker_insert ON audit_logs FOR INSERT WITH CHECK (get_current_role() = 'WORKER');