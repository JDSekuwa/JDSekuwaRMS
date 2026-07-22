# JD Sekuwa RMS — Master System Testing & Data Entry Verification Guide

This guide is a step-by-step master verification manual for the **JD Sekuwa Restaurant & Lodging Management System (RMS)**. It provides a complete, mathematically balanced mock dataset designed to populate, audit, and verify every single subsystem, permission rule, database state, RLS policy, inventory deduction, multi-section credit synchronization, and financial ledger calculation.

---

## 🗂️ Table of Contents
1. [⚙️ System Pre-requisites & Supabase Storage](#-system-pre-requisites--supabase-storage)
2. [👥 Component 1: Staff Provisioning & Role Gating (Users Config)](#-component-1-staff-provisioning--role-gating-users-config)
3. [⚙️ Component 2: Global Receipt & Brand Styling (Settings)](#-component-2-global-receipt--brand-styling-settings)
4. [📦 Component 3: Raw Materials & Safety Alerts (Inventory)](#-component-3-raw-materials--safety-alerts-inventory)
5. [🚛 Component 4: Bulk Supplier Invoices (Purchases & Restocking)](#-component-4-bulk-supplier-invoices-purchases--restocking)
6. [🔧 Component 5: Manual Stock Correction (Audit Adjustments)](#-component-5-manual-stock-correction-audit-adjustments)
7. [🏷️ Component 6: Food Categories & KOT Routing (Categories)](#-component-6-food-categories--kot-routing-categories)
8. [🍳 Component 7: Menu Items & Recipe Margins (Recipe Builder)](#-component-7-menu-items--recipe-margins-recipe-builder)
9. [🚪 Component 8: Floor Tables & Stay Lodgings (Tables & Rooms Setup)](#-component-8-floor-tables--stay-lodgings-tables--rooms-setup)
10. [🍽️ Component 9: Dine-in Table Sales, KOT & Vacate / Status Reset](#-component-9-dine-in-table-sales-kot--vacate--status-reset)
11. [🛍️ Component 10: Counter POS Billing & Line Voids (Quick Sell)](#-component-10-counter-pos-billing--line-voids-quick-sell)
12. [🏨 Component 11: Hotel Check-ins & Service Charges (Rooms Stay)](#-component-11-hotel-check-ins--service-charges-rooms-stay)
13. [💳 Component 12: Customer Credit Sync, Settle & Write-offs (Credit Ledger)](#-component-12-customer-credit-sync-settle--write-offs-credit-ledger)
14. [📈 Component 13: Financial Analytics, COGS & Margins (Reports)](#-component-13-financial-analytics-cogs--margins-reports)
15. [🧹 Component 14: System Reset & Profile Preservation (Database Purge)](#-component-14-system-reset--profile-preservation-database-purge)

---

## ⚙️ System Pre-requisites & Supabase Storage

The system integrates directly with **Supabase Storage** for user avatars, item photographs, and room/table plans:
* **Upload Bucket**: Named `uploads` (configured as a public bucket in your Supabase console).
* **Zero Local-disk Cache**: Uploads stream via buffer directly to Supabase storage to bypass Vercel serverless read-only restrictions.
* **Database mapping**: Images are stored as full public URL strings (e.g. `https://[supabase-project]/storage/v1/object/public/uploads/[filename]`).

---

## 👥 Component 1: Staff Provisioning & Role Gating (Users Config)

Validate Supabase Auth provisioning, Postgres Profile sync, and role permissions.

### 1. Admin/Super-Admin Cleanup of Stale Accounts
Stale or orphan profiles (e.g. from previous manual database wipes) show up as `unknown@example.com` under **Users Config**:
1. Log in as `SUPER_ADMIN`.
2. Go to **Users Config** on the left menu.
3. Locate any rows with email `unknown@example.com`.
4. Click **Delete** and confirm.
5. **Assertion**: Stale profile is deleted from Postgres instantly without throwing Supabase Auth user exceptions.

### 2. Staff Account Setup
Click **Provision Staff** and create:
* **Store Manager (Admin)**:
  * **Display Name**: `Hari Khadka`
  * **Email**: `hari.admin@sekuwahouse.com`
  * **Password**: `AdminSecure99`
  * **Permissions Role**: `Admin (Cashiers/Store Manager)`
* **Floor Server (Worker)**:
  * **Display Name**: `Sujata Sen`
  * **Email**: `sujata.worker@sekuwahouse.com`
  * **Password**: `WorkerPass77`
  * **Permissions Role**: `Worker (Waiters/Floor staff)`

### 3. Role Authorization Gates Test
1. Log out, then log in as `sujata.worker@sekuwahouse.com` (`WorkerPass77`).
2. Try clicking **Users Config** or **Settings** in the sidebar.
3. **Assertion**: The interface blocks navigation and shows an **Access Restricted** page, confirming that page-level authorization guards are active.
4. Log out, then log back in as `SUPER_ADMIN` (or `hari.admin@sekuwahouse.com`).

---

## ⚙️ Component 2: Global Receipt & Brand Styling (Settings)

Setup brand identity details printed on guest bills, KOT tickets, and hotel folios.

1. Go to **Settings** in the left sidebar.
2. Under **Receipt Configuration**, fill in:
   * **Restaurant Name**: `JD Sekuwa House`
   * **Contact Phone**: `+977-1-4467389`
3. Click **Save Settings** (top right).
4. **Assertion**: Success alert banner reads: *"Terminal printer and receipt configurations saved successfully!"*

---

## 📦 Component 3: Raw Materials & Safety Alerts (Inventory)

Define raw ingredients and items tracked for inventory alert thresholds.

Go to **Inventory** in the sidebar. Click **Add Raw Item** to register these six raw materials:

| Ingredient Name | Measurement Unit | Initial Stock | Safety Threshold | Cost Price (NPR) |
| :--- | :---: | :---: | :---: | :---: |
| `Chicken Breast` | `KG` | `0.000` | `5.000` | `Rs. 500.00` |
| `Buff Tenderloin` | `KG` | `0.000` | `8.000` | `Rs. 450.00` |
| `Local Basmati Rice` | `KG` | `0.000` | `10.000` | `Rs. 150.00` |
| `Sekuwa Masala Blend` | `KG` | `0.000` | `2.000` | `Rs. 800.00` |
| `Coca-Cola Can` | `PIECE` | `0.000` | `20.000` | `Rs. 50.00` |
| `Soy Sauce` | `LITRE` | `0.000` | `3.000` | `Rs. 300.00` |

* **Assertion**: All items appear in the inventory table with `0.000` current stock and a red **Low Stock** badge.

---

## 🚛 Component 4: Bulk Supplier Invoices (Purchases & Restocking)

Simulate incoming inventory restocks. JD Sekuwa RMS supports adding multiple purchase log lines for a single supplier in one invoice.

Go to **Purchases** -> Click **Record Purchase** -> Click **Add Line** to enter multiple items:

### Invoice 1: Himalayan Cold Store
* **Supplier**: `Himalayan Cold Store`
* **Purchase Lines**:
  1. `Chicken Breast` | Quantity: `20.000` | Cost: `500.00` (NPR)
  2. `Buff Tenderloin` | Quantity: `15.000` | Cost: `450.00` (NPR)
* Click **Record Purchase Logs**.

### Invoice 2: Valley Wholesale Spices
* **Supplier**: `Valley Wholesale Spices`
* **Purchase Lines**:
  1. `Sekuwa Masala Blend` | Quantity: `5.000` | Cost: `800.00` (NPR)
  2. `Local Basmati Rice` | Quantity: `25.000` | Cost: `150.00` (NPR)
* Click **Record Purchase Logs**.

### Invoice 3: Bottlers Nepal
* **Supplier**: `Bottlers Nepal`
* **Purchase Lines**:
  1. `Coca-Cola Can` | Quantity: `48.000` | Cost: `50.00` (NPR)
* Click **Record Purchase Logs**.

> [!NOTE]
> **Total Acquired Purchase Capital**: `(20 * 500) + (15 * 450) + (5 * 800) + (25 * 150) + (48 * 50)` = **Rs. 26,900.00**.

* **Assertion**: Return to **Inventory**. Verify quantities:
  - `Chicken Breast`: `20.000 KG` (Low stock alert cleared)
  - `Buff Tenderloin`: `15.000 KG` (Low stock alert cleared)
  - `Sekuwa Masala Blend`: `5.000 KG` (Low stock alert cleared)
  - `Local Basmati Rice`: `25.000 KG` (Low stock alert cleared)
  - `Coca-Cola Can`: `48.000 PIECE` (Low stock alert cleared)

---

## 🔧 Component 5: Manual Stock Correction (Audit Adjustments)

Test physical stock adjustments and audits.

1. Go to **Inventory** -> Locate `Soy Sauce` in the list.
2. Click the **Adjust** button on the right.
3. Fill in the adjustment parameters:
   * **Adjustment Delta**: `5` (Increments the stock level)
   * **Reason Description**: `Opening store audit stock validation`
4. Click **Submit Adjustment**.
5. **Assertion**: `Soy Sauce` stock updates to `5.000 LITRE` and its Low Stock warning displays green normal.

---

## 🏷️ Component 6: Food Categories & KOT Routing (Categories)

Verify menu categorization and Kitchen Order Ticket (KOT) routing.

Go to **Menu & Recipes** -> **Categories** tab. Click **Add Category**:
1. Name: `Sekuwa Specialties` | **Is Kitchen Order (KOT)?**: **Yes**
2. Name: `Himalayan Delights` | **Is Kitchen Order (KOT)?**: **Yes**
3. Name: `Soft Beverages` | **Is Kitchen Order (KOT)?**: **No** (Direct cash register pickup)

---

## 🍳 Component 7: Menu Items & Recipe Margins (Recipe Builder)

Configure sellable products and build their raw ingredient recipes. This dictates margins and auto-deducts stock.

### 1. Add Menu Items
Under **Menu Items** tab of **Menu & Recipes**, click **Add Menu Item**:
* **Product A**:
  * **Name**: `Premium Chicken Sekuwa (Full)`
  * **Retail Price**: `Rs. 600.00`
  * **Category**: `Sekuwa Specialties`
* **Product B**:
  * **Name**: `Buff Chhoila Sekuwa (Full)`
  * **Retail Price**: `Rs. 520.00`
  * **Category**: `Sekuwa Specialties`
* **Product C**:
  * **Name**: `Special Chicken Biryani`
  * **Retail Price**: `Rs. 450.00`
  * **Category**: `Himalayan Delights`
* **Product D**:
  * **Name**: `Canned Coca-Cola`
  * **Retail Price**: `Rs. 120.00`
  * **Category**: `Soft Beverages`

---

### 2. Formulate Recipes & Check Margins
Open the **Recipe Builder** modal (top right of **Inventory** page or menu items screen). Assign raw items to menu items:

#### Recipe A: `Premium Chicken Sekuwa (Full)`
* **Ingredient Lines**:
  * `Chicken Breast` | Quantity: `0.300` KG (Portion Cost: `0.3 * 500` = `Rs. 150.00`)
  * `Sekuwa Masala Blend` | Quantity: `0.030` KG (Portion Cost: `0.03 * 800` = `Rs. 24.00`)
* **Assertion**: Verify live calculations:
  * Portion Cost: `Rs. 174.00`
  * Gross Margin: `(600 - 174) / 600` = `71.00%`
* Click **Save Recipe**.

#### Recipe B: `Buff Chhoila Sekuwa (Full)`
* **Ingredient Lines**:
  * `Buff Tenderloin` | Quantity: `0.320` KG (Portion Cost: `0.32 * 450` = `Rs. 144.00`)
  * `Sekuwa Masala Blend` | Quantity: `0.025` KG (Portion Cost: `0.025 * 800` = `Rs. 20.00`)
* **Assertion**: Verify live calculations:
  * Portion Cost: `Rs. 164.00`
  * Gross Margin: `(520 - 164) / 520` = `68.46%`
* Click **Save Recipe**.

#### Recipe C: `Special Chicken Biryani`
* **Ingredient Lines**:
  * `Local Basmati Rice` | Quantity: `0.200` KG (Portion Cost: `0.2 * 150` = `Rs. 30.00`)
  * `Chicken Breast` | Quantity: `0.100` KG (Portion Cost: `0.1 * 500` = `Rs. 50.00`)
* **Assertion**: Verify live calculations:
  * Portion Cost: `Rs. 80.00`
  * Gross Margin: `(450 - 80) / 450` = `82.22%`
* Click **Save Recipe**.

---

## 🚪 Component 8: Floor Tables & Stay Lodgings (Tables & Rooms Setup)

Verify room statuses and table layouts.

1. Go to **Table Sales** -> Click **Manage Floor Plan** -> **Add Table**:
   * **Table Name**: `Table 101 (Open Terrace)`
   * **Table Name**: `Table 102 (Family Cabin)`
2. Go to **Rooms Lodging** -> Click **Manage Rooms** -> **Add Room**:
   * **Room Name**: `Deluxe Room 201` | Nightly Rate: `3500.00` (NPR)
   * **Room Name**: `Executive Suite 401` | Nightly Rate: `6000.00` (NPR)

---

## 🍽️ Component 9: Dine-in Table Sales, KOT & Vacate / Status Reset

Test table ordering, KOT generation, bill settlement, AND empty table status vacate/reset actions when customers leave without ordering.

### Test Case 9A: Empty Table Vacate / Customer Left Without Ordering
1. Go to **Table Sales** dashboard.
2. Click **Table 101 (Open Terrace)** -> Enter Tag: `Waiting for Guests` -> Click **Open Dine-in Order**.
3. **Assertion 1**: Table 101 status turns red **Occupied**.
4. Open the side drawer for **Table 101 (Open Terrace)** without adding any menu items.
5. **Assertion 2**: Notice the dedicated green button **"Make Table Vacant Again"** and footer action **"Make Table Vacant (No Orders Made)"**.
6. Click **Make Table Vacant Again**.
7. **Assertion 3**: Table 101 status immediately returns to green **Vacant**, and tag is reset to `null`.

### Test Case 9B: Active Table Order & Credit Settle
1. Click **Table 102 (Family Cabin)** -> Tag: `Anniversary Event` -> Click **Open Dine-in Order**.
2. Click **Add Items**:
   * Select `Premium Chicken Sekuwa (Full)` x `2`
   * Select `Special Chicken Biryani` x `1`
   * Select `Canned Coca-Cola` x `3`
   * Click **Send to Kitchen (KOT)**.
3. Click **Checkout & Settle**:
   * **Billing Total**: `(2 * 600) + (1 * 450) + (3 * 120)` = **Rs. 2,010.00**.
   * **Payment Method**: Select **CREDIT**.
   * **Customer Details**:
     * **Phone Number**: Type `9851000222`
     * **Guest Name**: Type `Rabin Shrestha`
   * **Assertion 4**: Live `CustomerCreditSyncWidget` queries customer profile.
   * Click **Settle Bill**.

### Inventory Stock Verification
Go to **Inventory** and verify raw stock levels:
* `Chicken Breast` reads **19.300 KG** (`20.000 - (2 * 0.300 + 1 * 0.100)`)
* `Sekuwa Masala Blend` reads **4.940 KG** (`5.000 - (2 * 0.030)`)
* `Local Basmati Rice` reads **24.800 KG** (`25.000 - (1 * 0.200)`)
* `Coca-Cola Can` reads **45.000 PIECE** (`48.000 - 3`)

---

## 🛍️ Component 10: Counter POS Billing & Line Voids (Quick Sell)

Verify walk-in Quick POS orders, live credit sync, and line voids.

1. Go to **POS Quick Sell** in sidebar.
2. Add items to cart:
   * `Buff Chhoila Sekuwa (Full)` x `2` (Rs. 1,040.00)
   * `Canned Coca-Cola` x `2` (Rs. 240.00)
   * Subtotal: **Rs. 1,280.00**.
3. Select **CREDIT** payment method:
   * Type Phone Number: `9851000222`
   * **Assertion 1**: `CustomerCreditSyncWidget` automatically identifies `Rabin Shrestha`, displays accumulated total debt **Rs. 2,010.00** (from Tables section), and auto-fills Guest Name `Rabin Shrestha`!
4. Change Payment Method to **CASH**:
   * Paid Amount: `1300`. (Change: `Rs. 20.00`).
   * Click **Settle & Checkout**.
5. **Audit Void Test**:
   * On the post-settlement receipt modal, click **Void** next to `Canned Coca-Cola`.
   * **Assertion 2**: Receipt updates total to **Rs. 1,040.00**.
   * **Assertion 3**: Go to **Inventory**. `Coca-Cola Can` stock remains at **45.000 PIECES** (void action successfully reversed stock deduction!).
   * **Assertion 4**: `Buff Tenderloin` stock reads **14.360 KG** (`15.000 - (2 * 0.320)`). `Sekuwa Masala Blend` reads **4.890 KG** (`4.940 - (2 * 0.025)`).

---

## 🏨 Component 11: Hotel Check-ins & Service Charges (Rooms Stay)

Verify hotel check-in registration, customer credit sync, room service charges, and checkout billing.

### Test Case 11A: No-Show Room Vacate (Phone Booking Reset)
1. Go to **Rooms Lodging** in the sidebar.
2. Click **Executive Suite 401** -> Click **Check In Guest**:
   * Phone Number: `9844444444` | Guest Name: `Phone Booking Guest` | ID: `CITIZENSHIP-000`
   * Click **Register Guest** (Room status changes to red **Occupied**).
3. Post a service charge to Suite 401 (`Canned Coca-Cola` x `1`).
4. Customer fails to arrive / cancels booking:
   * Click yellow **Vacate** button on Executive Suite 401 card.
   * Confirm **Make Room Vacant (No-Show)** dialog with reason *"Phone booking cancelled - Guest did not arrive"*.
5. **Assertion 1**: Executive Suite 401 status instantly returns to green **VACANT** with 0 billing.
6. **Assertion 2**: `Coca-Cola Can` raw inventory stock is automatically restored.

---

### Test Case 11B: Standard Hotel Stay & Checkout
1. Click **Deluxe Room 201** -> Click **Check In Guest**:
   * **Phone Number**: Type `9851000222`
   * **Assertion 3**: `CustomerCreditSyncWidget` displays `Rabin Shrestha` with active credit balance `Rs. 2,010.00` and auto-populates Guest Name `Rabin Shrestha`.
   * **ID Proof**: `CITIZENSHIP-8876`
   * Click **Register Guest** (Room status changes to Occupied).
2. **Post Room Service**:
   * Click **Service Charge** on Deluxe Room 201.
   * Select `Premium Chicken Sekuwa (Full)` x `1` (Rs. 600.00)
   * Select `Canned Coca-Cola` x `2` (Rs. 240.00)
   * Click **Save Charges**.
   * **Assertion 4**: Inventory updates:
     * `Chicken Breast` reads **19.000 KG** (`19.300 - 0.300`)
     * `Coca-Cola Can` reads **43.000 PIECE** (`45.000 - 2`)
3. **Guest Checkout**:
   * Click **Check Out** on Deluxe Room 201.
   * **Assertion 5**: Room charges: **Rs. 3,500.00** (1 night). Service charges: **Rs. 840.00**. Total Invoice: **Rs. 4,340.00**.
   * **Settlement Method**: Select **CREDIT**.
   * **Assertion 6**: Live credit sync displays existing Table credit of **Rs. 2,010.00**.
   * Click **Settle & Checkout** (Room 201 turns green Vacant).

---

## 💳 Component 12: Customer Credit Sync, Settle & Write-offs (Credit Ledger)

Verify multi-section customer credit aggregation, passbook itemized breakdown, repayments, and write-offs.

1. Go to **Credit Ledger** in the sidebar.
2. Select **Rabin Shrestha (9851000222)** from the customer list.
3. **Assertion 1**:
   - **Total Phone Balance** reads **Rs. 6,350.00** (`2,010.00` table bill + `4,340.00` room checkout bill).
   - Live section breakdown chips display: **Tables: Rs. 2,010.00** | **Rooms: Rs. 4,340.00**.
4. **Record Master Lump-Sum Account Repayment (FIFO Waterfall)**:
   * Notice the primary **Settle Account (Rs. 6,350.00)** button in the header action bar.
   * Click **Settle Account**.
   * Enter Payment Amount: `4000.00` (Lump-sum partial settlement).
   * Click **Settle Lump-Sum Account**.
   * **Assertion 2**:
     - The oldest invoice (Table Sale: `Rs. 2,010.00`) is automatically paid off in full (`PAID`).
     - The remainder (`Rs. 1,990.00`) is applied to the Room Stay invoice (`PARTIAL`, remaining balance `Rs. 2,350.00`).
     - Total Phone Balance updates cleanly to **Rs. 2,350.00**.
5. **Write Off Bad Debt Test**:
   * Click **Record Payment** on the remaining open invoice.
   * Click **Write Off Bad Debt** (bottom left of modal). Confirm warning dialog.
   * **Assertion 3**: Remaining due of **Rs. 2,350.00** is written off. Rabin's total outstanding balance updates to **Rs. 0.00**.

---

## 📈 Component 13: Financial Analytics, COGS & Margins (Reports)

Audit P&L Income statement, Cost of Goods Sold (COGS), and section margins.

Go to **Reports** module:

### 1. COGS Report Tab
Select **COGS** tab and audit quantities:

| Menu Item Sold | Quantity Sold | Unit Recipe Cost (NPR) | Subtotal COGS (NPR) |
| :--- | :---: | :---: | :---: |
| `Premium Chicken Sekuwa` | `3` | `174.00` | `Rs. 522.00` |
| `Buff Chhoila Sekuwa` | `2` | `164.00` | `Rs. 328.00` |
| `Special Chicken Biryani` | `1` | `80.00` | `Rs. 80.00` |

* **Assertion**: **Total Cost of Goods Sold (COGS)** StatCard reads **Rs. 930.00**.

---

### 2. Profit Summary Tab (P&L Income Statement Ledger)
Select **Profit Summary** tab and verify calculations:

* **StatCard Totals**:
  * **Total Revenue**: `Rs. 7,390.00` (`1,040.00` POS + `2,010.00` Table + `4,340.00` Room Stay)
  * **Cost of Goods Sold**: `Rs. 930.00`
  * **Gross Profit**: `Rs. 6,460.00` (Gross Margin: **87.42%**)
  * **Net Profit**: `Rs. 4,110.00` (Net Margin: **55.62%**)

* **Income Statement Ledger Grid**:
  * **Gross Operating Revenue** (PL-REV): `Rs. 7,390.00`
  * **Cost of Goods Sold (COGS)** (PL-COGS): `- Rs. 930.00`
  * **Gross Operating Profit** (PL-GPROFIT): `Rs. 6,460.00`
  * **Gross Margin (%)** (PL-GMARGIN): `87.42%`
  * **Operating Losses (Write-offs)** (PL-LOSS): `- Rs. 2,350.00`
  * **Net Profit** (PL-NPROFIT): `Rs. 4,110.00`
  * **Net Margin (%)** (PL-NMARGIN): `55.62%`

---

## 🧹 Component 14: System Reset & Profile Preservation (Database Purge)

Test database purges, cascading constraints, and Super-Admin session preservation.

1. Go to **Settings** -> Scroll to **Reset System Database Tables**.
2. Click **Reset Database** -> Confirm popup warning dialog.
3. **Security Assertion 1**: Your current `SUPER_ADMIN` session remains active (user profile is preserved).
4. **Security Assertion 2**: Go to **Inventory**, **Table Sales**, **Rooms Lodging**, or **Credit Ledger**. All lists display clean empty states, verifying database cascading delete operations worked cleanly.
