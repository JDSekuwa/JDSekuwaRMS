-- ============================================================
-- JD SEKUWA RMS — DATA RESTORATION SQL
-- Run this in Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 0: DIAGNOSTIC — See what data currently exists       │
-- │  Run these SELECT queries first to understand current state │
-- └─────────────────────────────────────────────────────────────┘

-- Check how many restaurant tables exist (should be 8+, if 0 → wiped)
SELECT 'restaurant_tables' AS "table", COUNT(*) AS "row_count" FROM restaurant_tables
UNION ALL
SELECT 'purchases', COUNT(*) FROM purchases
UNION ALL
SELECT 'table_orders', COUNT(*) FROM table_orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL
SELECT 'quick_sales', COUNT(*) FROM quick_sales
UNION ALL
SELECT 'raw_items', COUNT(*) FROM raw_items
UNION ALL
SELECT 'menu_items', COUNT(*) FROM menu_items
UNION ALL
SELECT 'menu_categories', COUNT(*) FROM menu_categories
UNION ALL
SELECT 'recipes', COUNT(*) FROM recipes
UNION ALL
SELECT 'recipe_lines', COUNT(*) FROM recipe_lines
UNION ALL
SELECT 'rooms', COUNT(*) FROM rooms
UNION ALL
SELECT 'room_stays', COUNT(*) FROM room_stays
UNION ALL
SELECT 'credit_ledgers', COUNT(*) FROM credit_ledgers
UNION ALL
SELECT 'stock_adjustments', COUNT(*) FROM stock_adjustments
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 1: RESTORE RESTAURANT TABLES                         │
-- │  Your Dashboard showed "NO ALL TABLES RIGHT NOW" = 0 rows  │
-- │  This re-creates Tables 1 through 8 as VACANT              │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO restaurant_tables (id, name, status, version, created_at, updated_at)
SELECT gen_random_uuid(), t.name, 'VACANT', 1, NOW(), NOW()
FROM (VALUES
  ('Table 1'), ('Table 2'), ('Table 3'), ('Table 4'),
  ('Table 5'), ('Table 6'), ('Table 7'), ('Table 8')
) AS t(name)
WHERE NOT EXISTS (
  SELECT 1 FROM restaurant_tables rt WHERE rt.name = t.name
);

-- Verify tables were restored:
SELECT id, name, status, version FROM restaurant_tables ORDER BY name;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 2: CHECK PURCHASE DATA                               │
-- │  Purchases page showed "No purchase records"               │
-- │  Check if any purchase rows survived                       │
-- └─────────────────────────────────────────────────────────────┘

SELECT
  p.id,
  ri.name AS ingredient,
  p.qty,
  p.unit_cost,
  p.total_cost,
  p.supplier_name,
  p.purchased_at
FROM purchases p
JOIN raw_items ri ON ri.id = p.raw_item_id
ORDER BY p.purchased_at DESC
LIMIT 50;

-- If the above returns 0 rows, purchases were wiped by the test suite.
-- Unfortunately, deleted rows cannot be recovered without Supabase PITR backup.
-- You can check if Supabase PITR is enabled:
--   Supabase Dashboard → Project Settings → Database → Point-in-Time Recovery
--
-- If PITR is enabled, you can restore to a point BEFORE the test run
-- (before 2026-07-29T16:12:00 UTC approximately).


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 3: UPDATE COST PRICES ON RAW ITEMS                   │
-- │  Your inventory showed Rs. 1.00 for items that should have │
-- │  higher prices based on purchases                          │
-- │                                                            │
-- │  3a: If purchases still exist (PITR restored), run this    │
-- │      to auto-set cost_price = MAX(cost_price, unit_cost)   │
-- └─────────────────────────────────────────────────────────────┘

-- 3a: Auto-update cost_price from surviving purchase records (only raises, never lowers)
UPDATE raw_items ri
SET
  cost_price = sub.max_unit_cost,
  updated_at = NOW()
FROM (
  SELECT
    raw_item_id,
    MAX(unit_cost) AS max_unit_cost
  FROM purchases
  GROUP BY raw_item_id
) sub
WHERE ri.id = sub.raw_item_id
  AND sub.max_unit_cost > ri.cost_price;

-- Verify updated cost prices:
SELECT name, unit, current_stock, cost_price FROM raw_items ORDER BY name;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  3b: MANUAL COST PRICE OVERRIDE (if purchases are gone)    │
-- │  If no purchase records survived, manually set known        │
-- │  cost prices here. Uncomment and adjust values as needed.   │
-- └─────────────────────────────────────────────────────────────┘

-- UPDATE raw_items SET cost_price = 120.00, updated_at = NOW() WHERE name = 'Chatpate Masala';
-- UPDATE raw_items SET cost_price = 85.00,  updated_at = NOW() WHERE name = 'Chana';
-- UPDATE raw_items SET cost_price = 650.00, updated_at = NOW() WHERE name = 'Pork Meat';
-- UPDATE raw_items SET cost_price = 450.00, updated_at = NOW() WHERE name = 'Chicken Meat';
-- UPDATE raw_items SET cost_price = 1100.00, updated_at = NOW() WHERE name = 'Mutton Meat';
-- UPDATE raw_items SET cost_price = 400.00, updated_at = NOW() WHERE name = 'House Sekuwa Spice Mix';
-- UPDATE raw_items SET cost_price = 220.00, updated_at = NOW() WHERE name = 'Raw Peanuts';
-- UPDATE raw_items SET cost_price = 60.00,  updated_at = NOW() WHERE name = 'Potatoes';


-- ┌─────────────────────────────────────────────────────────────┐
-- │  STEP 4: CHECK OTHER CRITICAL DATA                         │
-- │  Verify menu categories, menu items, recipes survived      │
-- └─────────────────────────────────────────────────────────────┘

-- Menu categories (should have 6+):
SELECT id, name, is_kitchen FROM menu_categories ORDER BY name;

-- Menu items (should have 15+):
SELECT mi.name, mi.price, mc.name AS category
FROM menu_items mi
JOIN menu_categories mc ON mc.id = mi.category_id
ORDER BY mc.name, mi.name;

-- Recipes:
SELECT mi.name AS menu_item, ri.name AS ingredient, rl.qty_per_unit
FROM recipe_lines rl
JOIN recipes r ON r.id = rl.recipe_id
JOIN menu_items mi ON mi.id = r.menu_item_id
JOIN raw_items ri ON ri.id = rl.raw_item_id
ORDER BY mi.name;

-- Rooms (should have 2+):
SELECT id, name, nightly_rate, status FROM rooms ORDER BY name;

-- Profiles (should have 1+ Super Admin):
SELECT id, role, created_at FROM profiles ORDER BY role;
