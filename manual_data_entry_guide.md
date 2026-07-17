# Himalayan Sekuwa Ghar — Comprehensive Manual Testing & Data Entry Guide

This guide provides a structured, step-by-step walk-through to manually test and populate the **JD Sekuwa RMS** (Restaurant & Lodging Management System) with a completely fresh mock dataset. Use this to verify every single feature, backend calculation, and role permission.

---

## 🗂️ Table of Contents
1. [💡 How Images are Handled](#-how-images-are-handled)
2. [⚙️ Step 1: Initial Settings & Brand Profile](#️-step-1-initial-settings--brand-profile)
3. [👥 Step 2: User Access & Role Permissions Validation](#-step-2-user-access--role-permissions-validation)
4. [📦 Step 3: Raw Materials Inventory Setup](#-step-3-raw-materials-inventory-setup)
5. [🔧 Step 4: Inventory Stock Adjustments (Manual Audit)](#-step-4-inventory-stock-adjustments-manual-audit)
6. [🚛 Step 5: Recording Restocking Purchases](#-step-5-recording-restocking-purchases)
7. [🏷️ Step 6: Menu Categories Configuration](#️-step-6-menu-categories-configuration)
8. [🍳 Step 7: Menu Items & Recipe Formulation](#-step-7-menu-items--recipe-formulation)
9. [🚪 Step 8: Tables & Lodging Rooms Setup](#-step-8-tables--lodging-rooms-setup)
10. [🍽️ Step 9: Operation Scenario 1 (Table Dining, KOT & Credit Billing)](#️-step-9-operation-scenario-1-table-dining-kot--credit-billing)
11. [🛍️ Step 10: Operation Scenario 2 (Quick POS Cashier Sale & Item Voiding)](#️-step-10-operation-scenario-2-quick-pos-cashier-sale--item-voiding)
12. [🏨 Step 11: Operation Scenario 3 (Hotel Lodging, Room Service & Dynamic Checkout)](#-step-11-operation-scenario-3-hotel-lodging-room-service--dynamic-checkout)
13. [💳 Step 12: Operation Scenario 4 (Customer Debt Settle & Repayment Ledger)](#-step-12-operation-scenario-4-customer-debt-settle--repayment-ledger)
14. [📈 Step 13: Financial Reports & Margin Analytics Audit](#-step-13-financial-reports--margin-analytics-audit)
15. [🧹 Step 14: System Cleanup & Reset Verification](#-step-14-system-cleanup--reset-verification)

---

## 💡 How Images are Handled
* **Local Storage**: When you upload an image for a Menu Item, Room, or Table, it is saved under the project's filesystem at `public/uploads/` with a unique timestamp prefix.
* **Database Link**: The relative path (e.g., `/uploads/17842848-Pork.jpg`) is saved in the database, allowing Next.js to serve it statically. No third-party bucket is needed.

---

## ⚙️ Step 1: Initial Settings & Brand Profile
Configure the basic branding details for receipts and system billing.

1. Log in as `SUPER_ADMIN`.
2. Navigate to **Settings** in the left sidebar.
3. In the **Receipt Configuration** section, enter:
   * **Restaurant Name**: `Himalayan Sekuwa Ghar`
   * **Contact Phone**: `+977-1-4432109`
4. Click **Save Settings** in the top right.
5. **Verify**: A green toast notification appears stating *"Terminal printer and receipt configurations saved successfully!"*

---

## 👥 Step 2: User Access & Role Permissions Validation
Test the user creation flow and role constraints (`SUPER_ADMIN`, `ADMIN`, `WORKER`).

1. Navigate to **Users Config** in the sidebar.
2. Click **Create Profile** in the top right:
   * **Email**: `worker.test@sekuwa.com`
   * **Full Name**: `Deepak Thapa`
   * **System Role**: `WORKER` (Waiters, Cashiers)
   * **Password**: `WorkerPass123`
3. Click **Create User**.
4. Log out of your current session, and log in with email `worker.test@sekuwa.com` and password `WorkerPass123`.
5. **Verify Permission Shields**:
   * Navigate to **Settings** or **Users Config**. The system should block you with a *"Forbidden"* error screen or restrict access, verifying role security.
   * Log back out, and log back in as `SUPER_ADMIN` or your default `ADMIN` to continue setup.

---

## 📦 Step 3: Raw Materials Inventory Setup
Establish the raw food stocks used in the recipes.

Navigate to **Inventory** in the sidebar. Click **Add Raw Item** in the top right and enter these items:

| Ingredient Name | Measurement Unit | Initial Stock | Min Safety Threshold | Cost Price (NPR) |
| :--- | :---: | :---: | :---: | :---: |
| `Chicken Boneless` | `KG` | `0.000` | `6.000` | `550.00` |
| `Buff Meat` | `KG` | `0.000` | `8.000` | `400.00` |
| `Basmati Rice` | `KG` | `0.000` | `10.000` | `180.00` |
| `Sekuwa Masala` | `KG` | `0.000` | `3.000` | `450.00` |
| `Fanta Bottle` | `PCS` | `0.000` | `15.000` | `60.00` |
| `Cooking Oil` | `LTR` | `0.000` | `5.000` | `220.00` |

* **Checkpoint**: Review the Inventory table. All items must show `0.000` Current Stock and a red **"Low Stock"** badge because the stock is below the safety threshold.

---

## 🔧 Step 4: Inventory Stock Adjustments (Manual Audit)
Simulate manually correcting stock counts (e.g. following a physical audit, or recording a donation).

1. In the **Inventory** panel, click **Adjust Stock** on `Cooking Oil`.
2. Input:
   * **Adjustment Type**: `ADD`
   * **Quantity**: `8`
   * **Reason / Note**: `Physical inventory audit surplus`
3. Click **Confirm Adjustment**.
4. **Verify**: The stock updates immediately to `8.000 LTR` and the badge turns green **"Vacant"** (Normal Stock).
5. Go to **Settings** -> check the audit logs or dashboard to confirm the manual adjustment log is recorded under system actions.

---

## 🚛 Step 5: Recording Restocking Purchases
Simulate receiving incoming shipments from wholesale suppliers.

Navigate to **Purchases** in the sidebar. Click **Record Purchase** and record these three invoices:

1. **Chicken Meat Cargo**:
   * **Raw Item**: `Chicken Boneless`
   * **Quantity**: `15`
   * **Unit Cost (NPR)**: `500.00` (wholesale discount)
   * **Supplier**: `Newa Fresh Cold Store`
2. **Biryani Rice Cargo**:
   * **Raw Item**: `Basmati Rice`
   * **Quantity**: `30`
   * **Unit Cost (NPR)**: `160.00`
   * **Supplier**: `Salt Trading Corp`
3. **Special Masala Cargo**:
   * **Raw Item**: `Sekuwa Masala`
   * **Quantity**: `5`
   * **Unit Cost (NPR)**: `400.00`
   * **Supplier**: `Kathmandu Spice Hub`

* **Checkpoint 1**: Return to **Inventory**. Confirm stock updates: `Chicken Boneless` (`15.000 KG`), `Basmati Rice` (`30.000 KG`), `Sekuwa Masala` (`5.000 KG`). Red warnings should be replaced by green badges.
* **Checkpoint 2**: Go to **Reports** -> **Purchases Report** and check that the total recorded purchase amount reads `Rs. 14,300.00` (i.e. `7,500 + 4,800 + 2,000`).

---

## 🏷️ Step 6: Menu Categories Configuration
Group items for printing and orders.

Navigate to **Menu & Recipes** -> **Categories** tab. Click **Add Category** and create:

1. **Flame Grilled**:
   * Name: `Flame Grilled`
   * Is Kitchen Order?: `Yes` (Will print KOT tickets)
2. **Rice & Curries**:
   * Name: `Rice & Curries`
   * Is Kitchen Order?: `Yes`
3. **Beverages**:
   * Name: `Beverages`
   * Is Kitchen Order?: `No` (Saves time by not sending soda to kitchen printer)

---

## 🍳 Step 7: Menu Items & Recipe Formulation
Create portion-specific sellable items and map their ingredient deduction recipes.

### 1. Add the Menu Products
Navigate to the **Menu Items** tab under **Menu & Recipes**. Click **Add Menu Item**:
* **Product A**: `Chicken Sekuwa (Full)` | Category: `Flame Grilled` | Price: `Rs. 550.00`
* **Product B**: `Buff Sekuwa (Full)` | Category: `Flame Grilled` | Price: `Rs. 480.00`
* **Product C**: `Himalayan Biryani` | Category: `Rice & Curries` | Price: `Rs. 380.00`
* **Product D**: `Cold Fanta` | Category: `Beverages` | Price: `Rs. 100.00`

### 2. Formulate Recipes (For automatic stock depletion)
Go to **Inventory** -> click **Recipe Builder** in the top right.

* **Recipe for `Chicken Sekuwa (Full)`**:
  * Select `Chicken Sekuwa (Full)` from the dropdown list.
  * Add Line -> Raw Item: `Chicken Boneless`, Quantity: `0.350` KG
  * Add Line -> Raw Item: `Sekuwa Masala`, Quantity: `0.040` KG
  * Click **Save Recipe**. (Gross Margin percentage will compute automatically).
* **Recipe for `Himalayan Biryani`**:
  * Select `Himalayan Biryani` from the dropdown list.
  * Add Line -> Raw Item: `Basmati Rice`, Quantity: `0.180` KG
  * Add Line -> Raw Item: `Chicken Boneless`, Quantity: `0.050` KG
  * Click **Save Recipe**.

---

## 🚪 Step 8: Tables & Lodging Rooms Setup
Configure dining cabins and hotel stay rooms.

1. Navigate to **Table Sales** and click **Add Table**:
   * **Table Name**: `Cabin A`
   * **Table Name**: `Cabin B`
2. Navigate to **Rooms Lodging** and click **Add Room**:
   * **Room Name**: `Suite 301` | **Daily Rate (NPR)**: `4500.00`
   * **Room Name**: `Suite 302` | **Daily Rate (NPR)**: `5000.00`

---

## 🍽️ Step 9: Operation Scenario 1 (Table Dining, KOT & Credit Billing)
Simulate a full dine-in restaurant order, kitchen ticket print, and settling to credit ledger.

1. Go to **Table Sales**.
2. Click **Cabin A** -> click **Open Table**.
   * Enter Tag: `Family Gathering` -> click **Open Table**. (Table status indicator turns red **Occupied**).
3. Click **Add/Manage Items** on Cabin A.
   * Select `Chicken Sekuwa (Full)` x `2`
   * Select `Himalayan Biryani` x `1`
   * **Crucial Action**: Click **`Send to Kitchen (KOT)`** (located in the bottom right **footer** of the modal).
4. Click **Close Table & Bill**:
   * Select Payment Method: **CREDIT**.
   * Enter Guest Name: `Anil Adhikari` | Phone: `9841223344`.
   * Click **Settle Bill**.
5. **Verify**:
   * Cabin A resets to green **Vacant**.
   * Check **Inventory**: `Chicken Boneless` stock is depleted by `0.750 KG` (2 x 0.350 + 0.050) -> reads `14.250 KG`.
   * Check **Inventory**: `Basmati Rice` stock is depleted by `0.180 KG` -> reads `29.820 KG`.

---

## 🛍️ Step 10: Operation Scenario 2 (Quick POS Cashier Sale & Item Voiding)
Simulate a walk-in counter customer paying immediately with cash, demonstrating real-time transaction voids.

1. Navigate to **POS Quick Sell** in the sidebar.
2. Add items to the cart in the right pane:
   * Select `Himalayan Biryani` x `2`
   * Select `Cold Fanta` x `3`
3. Click **Pay & Settle** at the bottom:
   * Select Payment Method: **CASH**.
   * Enter Paid Amount: `1100` (Subtotal `1060`, Change `40`).
   * Click **Confirm & Print**.
4. **Void Test**: On the receipt popup, test your cashier overrides:
   * Locate `Cold Fanta` x3 in the item list.
   * Click the red **Void (X)** icon next to it.
   * Confirm the void.
   * **Verify**: The Fanta lines disappear, and the total updates. Check **Inventory**: `Fanta Bottle` stock remains at `0.000` because the item was voided.

---

## 🏨 Step 11: Operation Scenario 3 (Hotel Lodging, Room Service & Dynamic Checkout)
Simulate checking in a guest without knowing their checkout date in advance, posting room service, and letting the system calculate nights dynamically.

1. Navigate to **Rooms Lodging** in the sidebar.
2. Click **Suite 301** -> click **Check In Guest**:
   * **Guest Name**: `Anil Adhikari`
   * **Phone**: `9841223344` (MUST match the credit account phone number in Step 9!)
   * **ID Proof Document**: `PASSPORT-N77665`
   * **Number of Guests**: `2`
   * **Expected Check-out Date**: (Leave completely empty to test dynamic calculation!)
   * Click **Register Guest**. (Suite status turns red **Occupied**).
3. While active, click **Service Charge** on Suite 301:
   * Select `Buff Sekuwa (Full)` x `1`
   * Select `Cold Fanta` x `2`
   * Click **Post to Stay Room Service**.
4. Click **Check Out** on Suite 301:
   * **Verify dynamic nights**: The duration reads **1 Night** (default fallback) and Lodging Charge shows **Rs. 4,500.00** (`1 x 4500`).
   * **Verify stay total**: The total shows **Rs. 5,180.00** (Lodging `4,500` + Service `680`).
   * Select Payment Method: **CREDIT** (to merge with his existing restaurant dining tab).
   * Click **Settle & Checkout**. (Suite 301 reverts to green **Vacant**).

---

## 💳 Step 12: Operation Scenario 4 (Customer Debt Settle & Repayment Ledger)
Consolidate restaurant and lodging bills, and record a payment.

1. Navigate to **Credit Ledger** in the sidebar.
2. Find `Anil Adhikari` (`9841223344`).
   * **Verify Outstanding Balance**: The total debt reads exactly **Rs. 6,660.00** (Table order `1,480` + Lodging stay `5,180`).
3. Click **Record Payment**:
   * **Amount Paid (NPR)**: `4000.00`
   * **Method**: `CASH`
   * Click **Save Payment**.
4. **Verify**: Anil's outstanding balance immediately updates to **Rs. 2,660.00**.

---

## 📈 Step 13: Financial Reports & Margin Analytics Audit
Confirm accounting accuracy across all transactions.

1. Navigate to the **Dashboard**:
   * **Gross Sales**: Displays `Rs. 6,660.00` (Consolidated sales).
   * **Active Credit Outstanding**: Displays `Rs. 2,660.00`.
   * **Profit Summary**: Correctly factors in ingredients cost prices against menu prices.
2. Go to **Reports** -> select **Profit & Loss**:
   * Review sales figures and see that cost of goods sold (COGS) is deducted correctly.

---

## 🧹 Step 14: System Cleanup & Reset Verification
Verify that the database can be reset back to absolute zero for new tests.

1. Navigate to **Settings** in the sidebar.
2. Scroll to **Reset System Database Tables** at the bottom.
3. Click **Reset Database** and confirm the popup warning dialogue.
4. **Verify**:
   * The database is completely cleared.
   * Navigate back to **Inventory**, **Table Sales**, **Rooms Lodging**, and **Credit Ledger**. All tables and cards should be empty (no seeded or manually added data is preserved).
   * The system is back in a clean state, ready for your next validation run!
