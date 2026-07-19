# Himalayan Sekuwa Ghar — Comprehensive Manual Testing & Data Entry Guide

This guide is a step-by-step handbook to manually test, populate, and audit the **Himalayan Sekuwa Ghar Restaurant & Lodging Management System (JD Sekuwa RMS)**. It contains a completely fresh, mathematically aligned mock dataset designed to validate every single module, database calculation, cloud storage asset upload, user role access level, and financial reporting metric.

---

## 🗂️ Table of Contents
1. [⚙️ System Architecture & Image Uploads](#-system-architecture--image-uploads)
2. [👥 Step 1: User Provisioning & Access Gating Validation](#-step-1-user-provisioning--access-gating-validation)
3. [⚙️ Step 2: Global Receipt & Brand Configuration](#-step-2-global-receipt--brand-configuration)
4. [📦 Step 3: Raw Materials Directory Setup](#-step-3-raw-materials-directory-setup)
5. [🚛 Step 4: Restocking Purchase Invoices (Incoming Stock)](#-step-4-restocking-purchase-invoices-incoming-stock)
6. [🔧 Step 5: Manual Stock Correction (Audit Adjustments)](#-step-5-manual-stock-correction-audit-adjustments)
7. [🏷️ Step 6: Menu Categories Configuration](#-step-6-menu-categories-configuration)
8. [🍳 Step 7: Menu Items & Recipe Formulations (Live Margins)](#-step-7-menu-items--recipe-formulations-live-margins)
9. [🚪 Step 8: Dining Tables & Lodging Rooms Setup](#-step-8-dining-tables--lodging-rooms-setup)
10. [🍽️ Step 9: Operation Scenario 1 — Table Dining & Credit Settle (KOT Flow)](#-step-9-operation-scenario-1--table-dining--credit-settle-kot-flow)
11. [🛍️ Step 10: Operation Scenario 2 — POS Counter Sale & Voiding (Cash Flow)](#-step-10-operation-scenario-2--pos-counter-sale--voiding-cash-flow)
12. [🏨 Step 11: Operation Scenario 3 — Room Lodging & Service Posted (Stay Flow)](#-step-11-operation-scenario-3--room-lodging--service-posted-stay-flow)
13. [💳 Step 12: Operation Scenario 4 — Credit Repayments & Bad Debt Write-offs](#-step-12-operation-scenario-4--credit-repayments--bad-debt-write-offs)
14. [📈 Step 13: Financial Reports, COGS & Margins Audit](#-step-13-financial-reports-cogs--margins-audit)
15. [🧹 Step 14: System Reset & Database Purge Validation](#-step-14-system-reset--database-purge-validation)

---

## ⚙️ System Architecture & Image Uploads

* **Cloud Image Hosting**: The application uploads all media files (Staff avatars, Menu item dish photos, Table plans, Room pictures) directly to the **Supabase Storage** public bucket named `uploads`. 
* **Zero Local-Disk Writing**: The local filesystem is never written to during uploads. This prevents Vercel serverless functions from encountering `EROFS: read-only file system` crashes.
* **Database Mapping**: Files are saved in the database with their public URL (e.g. `https://[project-id].supabase.co/storage/v1/object/public/uploads/[filename]`), which Next.js resolves dynamically on client pages.

---

## 👥 Step 1: User Provisioning & Access Gating Validation
Validate employee authorization levels: `SUPER_ADMIN` (owner), `ADMIN` (cashiers/managers), and `WORKER` (waiters).

### 1. Identify and Clean Up Orphan Profiles
If previous database resets left stale profiles in Postgres without corresponding user credentials in Supabase Auth, they appear as **Staff** with email `unknown@example.com` in your list.
1. Log in as `SUPER_ADMIN`.
2. Navigate to the **Users Config** page.
3. Locate the row with email `unknown@example.com`.
4. Click **Delete** and confirm.
5. **Verify**: The system bypasses any missing Auth user exceptions, deletes the row from the database, and updates the list instantly.

### 2. Provision New Accounts
Click **Provision Staff** in the top right and create:
* **Account A (Manager)**:
  * **Display Name**: `Hari Khadka`
  * **Email**: `hari.admin@sekuwahouse.com`
  * **Password**: `AdminSecure99`
  * **Permissions Role**: `Admin (Cashiers/Store Manager)`
* **Account B (Server)**:
  * **Display Name**: `Sujata Sen`
  * **Email**: `sujata.worker@sekuwahouse.com`
  * **Password**: `WorkerPass77`
  * **Permissions Role**: `Worker (Waiters/Floor staff)`

### 3. Validate Permission Gates
1. Log out, and log back in as `sujata.worker@sekuwahouse.com` (`WorkerPass77`).
2. Try clicking **Users Config** or **Settings** in the sidebar.
3. **Verify**: The interface blocks navigation or prompts an **Access Restricted** screen with red warning shields, confirming role permissions are active.
4. Log out, and log back in as `SUPER_ADMIN` (or `hari.admin@sekuwahouse.com`) to continue data entry.

---

## ⚙️ Step 2: Global Receipt & Brand Configuration
Establish the merchant details that print on customer receipts and guest invoices.

1. Navigate to **Settings** in the left sidebar.
2. Under **Receipt Configuration**, enter:
   * **Restaurant Name**: `Himalayan Sekuwa Ghar`
   * **Contact Phone**: `+977-1-4467389`
3. Click **Save Settings** in the top right.
4. **Verify**: A success banner displays: *"Terminal printer and receipt configurations saved successfully!"*

---

## 📦 Step 3: Raw Materials Directory Setup
Define the base raw ingredients that form recipes and are tracked for safety alerts.

Navigate to **Inventory** in the sidebar. Click **Add Raw Item** to register these six materials:

| Ingredient Name | Measurement Unit | Initial Stock | Min Safety Threshold | Cost Price per Unit (NPR) |
| :--- | :---: | :---: | :---: | :---: |
| `Chicken Breast` | `KG` | `0.000` | `5.000` | `Rs. 500.00` |
| `Buff Tenderloin` | `KG` | `0.000` | `8.000` | `Rs. 450.00` |
| `Local Basmati Rice` | `KG` | `0.000` | `10.000` | `Rs. 150.00` |
| `Sekuwa Masala Blend` | `KG` | `0.000` | `2.000` | `Rs. 800.00` |
| `Coca-Cola Can` | `PIECE` | `0.000` | `20.000` | `Rs. 50.00` |
| `Soy Sauce` | `LITRE` | `0.000` | `3.000` | `Rs. 300.00` |

* **Verify**: The inventory list displays all items with **Current Stock** at `0.000` and a red **Low Stock** alert status.

---

## 🚛 Step 4: Restocking Purchase Invoices (Incoming Stock)
Simulate receiving supply deliveries from wholesale cold stores.

Navigate to **Purchases** in the sidebar. Click **Record Purchase** to submit these three supplier invoices:

### Invoice 1: Himalayan Cold Store
* **Raw Item**: `Chicken Breast` | **Quantity**: `20` | **Unit Cost (NPR)**: `500.00`
* **Raw Item**: `Buff Tenderloin` | **Quantity**: `15` | **Unit Cost (NPR)**: `450.00`
* **Supplier**: `Himalayan Cold Store`

### Invoice 2: Valley Wholesale Spices
* **Raw Item**: `Sekuwa Masala Blend` | **Quantity**: `5` | **Unit Cost (NPR)**: `800.00`
* **Raw Item**: `Local Basmati Rice` | **Quantity**: `25` | **Unit Cost (NPR)**: `150.00`
* **Supplier**: `Valley Wholesale Spices`

### Invoice 3: Bottlers Nepal
* **Raw Item**: `Coca-Cola Can` | **Quantity**: `48` | **Unit Cost (NPR)**: `50.00`
* **Supplier**: `Bottlers Nepal`

> [!NOTE]
> **Total Purchases Capital Outlay**: `(20 * 500) + (15 * 450) + (5 * 800) + (25 * 150) + (48 * 50)` = **Rs. 26,900.00**.

* **Verify Inventory Levels**: Return to **Inventory**. Confirm stock updates: `Chicken Breast` (`20.000 KG`), `Buff Tenderloin` (`15.000 KG`), `Sekuwa Masala Blend` (`5.000 KG`), `Local Basmati Rice` (`25.000 KG`), and `Coca-Cola Can` (`48.000 PIECE`). The warning badges should update to normal status.

---

## 🔧 Step 5: Manual Stock Correction (Audit Adjustments)
Simulate manual adjustment (e.g., following a physical store room audit).

1. In the **Inventory** list, click the **Adjust** button next to `Soy Sauce`.
2. Fill in the adjustment parameters:
   * **Adjustment Quantity Delta**: `5` (positive number to increase stock)
   * **Reason Description**: `Opening stock audit correction`
3. Click **Submit Adjustment**.
4. **Verify**: `Soy Sauce` stock updates to `5.000 LITRE` and its safety alert status changes to green normal status.

---

## 🏷️ Step 6: Menu Categories Configuration
Organize products for order routing.

Navigate to the **Menu & Recipes** module -> **Categories** tab. Click **Add Category** to create:

1. **Sekuwa Specialties**
   * Name: `Sekuwa Specialties`
   * Is Kitchen Order (KOT)?: **Yes** (Will route order tickets to the kitchen)
2. **Himalayan Delights**
   * Name: `Himalayan Delights`
   * Is Kitchen Order (KOT)?: **Yes**
3. **Soft Beverages**
   * Name: `Soft Beverages`
   * Is Kitchen Order (KOT)?: **No** (Direct cash register pickup)

---

## 🍳 Step 7: Menu Items & Recipe Formulations (Live Margins)
Register sellable menu items and define their raw ingredient recipes to automate stock deductions and margin analytics.

### 1. Register Menu Items
Under the **Menu Items** tab of **Menu & Recipes**, click **Add Menu Item**:
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

### 2. Formulate Ingredient Recipes
Open the **Recipe Builder** modal (click **Recipe Builder** on the top right of the Inventory page). Select your menu items and assign their raw ingredient measurements:

#### Recipe A: `Premium Chicken Sekuwa (Full)`
* Add Line -> Raw Item: `Chicken Breast` | Quantity: `0.300` KG (Portion cost: `0.3 * 500` = `Rs. 150`)
* Add Line -> Raw Item: `Sekuwa Masala Blend` | Quantity: `0.030` KG (Portion cost: `0.03 * 800` = `Rs. 24`)
* **Verify live calculations**: 
  * Portion Cost: `Rs. 174.00`
  * Sell Price: `Rs. 600.00`
  * Gross Profit Margin: **Rs. 426.00** (`71.00%` Profitability)
* Click **Save Recipe**.

#### Recipe B: `Buff Chhoila Sekuwa (Full)`
* Add Line -> Raw Item: `Buff Tenderloin` | Quantity: `0.320` KG (Portion cost: `0.32 * 450` = `Rs. 144`)
* Add Line -> Raw Item: `Sekuwa Masala Blend` | Quantity: `0.025` KG (Portion cost: `0.025 * 800` = `Rs. 20`)
* **Verify live calculations**:
  * Portion Cost: `Rs. 164.00`
  * Sell Price: `Rs. 520.00`
  * Gross Profit Margin: **Rs. 356.00** (`68.46%` Profitability)
* Click **Save Recipe**.

#### Recipe C: `Special Chicken Biryani`
* Add Line -> Raw Item: `Local Basmati Rice` | Quantity: `0.200` KG (Portion cost: `0.2 * 150` = `Rs. 30`)
* Add Line -> Raw Item: `Chicken Breast` | Quantity: `0.100` KG (Portion cost: `0.1 * 500` = `Rs. 50`)
* **Verify live calculations**:
  * Portion Cost: `Rs. 80.00`
  * Sell Price: `Rs. 450.00`
  * Gross Profit Margin: **Rs. 370.00** (`82.22%` Profitability)
* Click **Save Recipe**.

*(Note: Canned Coca-Cola does not require a recipe formulation, as it is a direct retail item).*

---

## 🚪 Step 8: Dining Tables & Lodging Rooms Setup
Configure your restaurant floor plan and lodging rooms.

1. Navigate to **Table Sales** and click **Add Table**:
   * **Table Name**: `Table 101 (Open Terrace)`
   * **Table Name**: `Table 102 (Family Cabin)`
2. Navigate to **Rooms Lodging** and click **Add Room**:
   * **Room Name**: `Deluxe Room 201` | **Nightly Rate (NPR)**: `3500.00`
   * **Room Name**: `Executive Suite 401` | **Nightly Rate (NPR)**: `6000.00`

---

## 🍽️ Step 9: Operation Scenario 1 — Table Dining & Credit Settle (KOT Flow)
Simulate a table order, send items to the kitchen, and settle the invoice as credit.

1. Navigate to the **Table Sales** dashboard.
2. Click **Table 102 (Family Cabin)** and click **Open Table**.
   * **Enter Tag/Description**: `Anniversary Event`
   * Click **Open Table** (Table status changes to red **Occupied**).
3. Click **Add/Manage Items** on Table 102:
   * Select `Premium Chicken Sekuwa (Full)` x `2`
   * Select `Special Chicken Biryani` x `1`
   * Select `Canned Coca-Cola` x `3`
   * Click **Send to Kitchen (KOT)** at the bottom of the modal.
4. Click **Close Table & Bill**:
   * **Subtotal**: `(2 * 600) + 450 + (3 * 120)` = **Rs. 2,010.00**
   * **Payment Method**: Select **CREDIT**.
   * **Customer Search/Name**: `Rabin Shrestha`
   * **Customer Phone**: `9851000222`
   * Click **Settle Bill**.

### Database & Inventory Assertions:
* Table 102 (Family Cabin) resets to green **Vacant**.
* Check **Inventory**:
  * `Chicken Breast`: Depleted by `0.700 KG` (`2 * 0.300 + 0.100`) -> reads **19.300 KG**.
  * `Sekuwa Masala Blend`: Depleted by `0.060 KG` (`2 * 0.030`) -> reads **4.940 KG**.
  * `Local Basmati Rice`: Depleted by `0.200 KG` (`1 * 0.200`) -> reads **24.800 KG**.
  * `Coca-Cola Can`: Depleted by `3` -> reads **45.000 PIECES**.

---

## 🛍️ Step 10: Operation Scenario 2 — POS Counter Sale & Voiding (Cash Flow)
Simulate a walk-in counter order paid with cash, including transaction voids.

1. Navigate to **POS Quick Sell** in the sidebar.
2. Click menu items to add them to the cart in the right pane:
   * Select `Buff Chhoila Sekuwa (Full)` x `2` (Price: `Rs. 1,040.00`)
   * Select `Canned Coca-Cola` x `2` (Price: `Rs. 240.00`)
   * **Subtotal**: `1040 + 240` = **Rs. 1,280.00**.
3. Click **Pay & Settle** at the bottom:
   * **Payment Method**: Select **CASH**.
   * **Paid Amount**: Enter `1300`.
   * **Change due**: Displays `Rs. 20.00`.
   * Click **Confirm & Print**.
4. **Audit Void Test**: 
   * On the receipt review screen, click the **Void** button next to the `Canned Coca-Cola` row.
   * Confirm the void override in the popup.
   * **Verify**: The Coca-Cola lines are voided, the invoice subtotal updates to **Rs. 1,040.00**, and a reverse entry is logged.
   * Check **Inventory**: `Coca-Cola Can` stock remains at **45.000 PIECES** (since the sale was voided).
   * Check **Inventory**: `Buff Tenderloin` stock is depleted by `0.640 KG` (`2 * 0.320`) -> reads **14.360 KG**.
   * Check **Inventory**: `Sekuwa Masala Blend` stock is depleted by `0.050` KG (`2 * 0.025`) -> reads **4.890 KG**.

---

## 🏨 Step 11: Operation Scenario 3 — Room Lodging & Service Posted (Stay Flow)
Simulate checking in a hotel guest without pre-determining checkout dates, posting room service to the room tab, and executing check out.

1. Go to **Rooms Lodging** in the sidebar.
2. Click **Deluxe Room 201** and click **Check In Guest**:
   * **Guest Name**: `Rabin Shrestha`
   * **Phone**: `9851000222` *(Must match the credit account phone number in Step 9)*
   * **ID Document Proof**: `CITIZENSHIP-8876`
   * **Expected Check-out Date**: *(Leave empty to test dynamic calculations)*
   * Click **Register Guest** (Room status changes to red **Occupied**).
3. Post Room Service to Room 201:
   * Click **Service Charge** on Deluxe Room 201.
   * Select `Premium Chicken Sekuwa (Full)` x `1` (Price: `Rs. 600.00`)
   * Select `Canned Coca-Cola` x `2` (Price: `Rs. 240.00`)
   * Click **Post to Stay Room Service**.
   * Check **Inventory**: `Chicken Breast` depletes to **19.000 KG** (`19.300 - 0.300`); `Coca-Cola Can` depletes to **43.000 PIECES** (`45.000 - 2`).
4. Execute checkout:
   * Click **Check Out** on Deluxe Room 201.
   * **Verify dynamic nights calculation**: The system calculates the stay duration as **1 Night** (default fallback) and calculates the Lodging Charge as **Rs. 3,500.00**.
   * **Verify subtotal calculations**: The invoice displays a total of **Rs. 4,340.00** (`Lodging 3,500 + Room Service 840`).
   * **Payment Method**: Select **CREDIT** to add this invoice to the guest's credit account.
   * Click **Settle & Checkout** (Room 201 resets to green **Vacant**).

---

## 💳 Step 12: Operation Scenario 4 — Credit Repayments & Bad Debt Write-offs
Consolidate invoices and process a partial repayment and bad debt write-off.

1. Navigate to **Credit Ledger** in the sidebar.
2. Click `Rabin Shrestha` (`9851000222`) in the outstanding accounts list.
3. **Verify Outstanding Balance**:
   * Dining invoice: `Rs. 2,010.00`
   * Room Stay invoice: `Rs. 4,340.00`
   * Rabin's total outstanding balance reads exactly **Rs. 6,350.00**.
4. **Record Payment**:
   * Click **Record Payment**.
   * **Repayment Amount (NPR)**: Enter `4000`.
   * Click **Settle Payment**.
   * **Verify**: Rabin's outstanding balance immediately updates to **Rs. 2,350.00**.
5. **Write off remaining debt**:
   * Assume the remaining `Rs. 2,350.00` balance is written off (e.g., due to a customer dispute).
   * Click the **Write-Off (Trash)** button next to the remaining invoice.
   * Click OK on the warning dialog.
   * **Verify**: The outstanding balance updates to **Rs. 0.00** and the status changes to `WRITTEN_OFF`.

---

## 📈 Step 13: Financial Reports, COGS & Margins Audit
Audit the financial reports and profit calculations.

Navigate to the **Reports** page. Select the **Profit & Loss** report and verify the following figures:

### 1. Revenue Assertions
* **POS Sales (Cash)**: **Rs. 1,040.00** *(Quick POS cashier sale after Coca-Cola void)*
* **Table Sales (Credit)**: **Rs. 2,010.00** *(Anniversary event dine-in billing)*
* **Room Stay Sales (Credit)**: **Rs. 4,340.00** *(Lodging checkout invoice)*
* **Total Gross Revenue**: `1040 + 2010 + 4340` = **Rs. 7,390.00**.

### 2. Cost of Goods Sold (COGS) Assertions
COGS measures the raw ingredient purchase costs configured in our recipes:
* **Premium Chicken Sekuwa** (x3 sold: 2 dine-in + 1 room service):
  * Portion Recipe Cost: `Rs. 174.00` | Subtotal COGS: `3 * 174` = **Rs. 522.00**
* **Buff Chhoila Sekuwa** (x2 sold on counter):
  * Portion Recipe Cost: `Rs. 164.00` | Subtotal COGS: `2 * 164` = **Rs. 328.00**
* **Special Chicken Biryani** (x1 sold dine-in):
  * Portion Recipe Cost: `Rs. 80.00` | Subtotal COGS: `1 * 80` = **Rs. 80.00**
* **Total COGS**: `522 + 328 + 80` = **Rs. 930.00**.

### 3. Profit Margin Assertions
* **Gross Profit**: `Revenue - COGS` = `7390.00 - 930.00` = **Rs. 6,460.00** (`87.41%` Gross Margin)
* **Operating Losses (Write-offs)**: **Rs. 2,350.00** *(The written-off bad debt from Step 12)*
* **Net Profit**: `Gross Profit - Losses` = `6460.00 - 2350.00` = **Rs. 4,110.00** (`55.61%` Net Margin)

* **Verify**: The values displayed on the **Dashboard** and **Profit & Loss** report match these figures exactly.

---

## 🧹 Step 14: System Reset & Database Purge Validation
Verify the database reset logic.

1. Navigate to **Settings** in the sidebar.
2. Scroll down to **Reset System Database Tables**.
3. Click **Reset Database** and confirm the popup warning dialogue.
4. **Verify**:
   * The database is completely cleared.
   * The dashboard charts display zero.
   * Tables, Rooms, Inventory, and Credit Ledger pages are clear of all manually entered records.
   * **Security Assertion**: Your `SUPER_ADMIN` profile remains intact and you are not logged out, confirming the active user profile was preserved.
