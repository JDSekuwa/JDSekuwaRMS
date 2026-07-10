# JD Sekuwa House — RMS Documentation

## Database Layer

### Schema Decisions
The database schema is modeled using Prisma for robust type safety and PostgreSQL as the underlying relational database. Key decisions include:
- **UUID Keys:** All models use UUIDs (`@db.Uuid`) for primary and foreign keys, with the exception of `Profile` which maps directly to Supabase Auth's user UUID.
- **Precision Currency & Quantities:** Financial values (e.g. `price`, `costPrice`, `nightlyRate`, `amount`) use the `Decimal` type mapped to PostgreSQL `numeric(10,2)`. Stock quantities use `Decimal` mapped to `numeric(10,3)` to handle fractional items (like 0.353 kg of meat).
- **Enums for Strict Classification:** Crucial workflows like role management, table orders, rooms, and payments are strictly typed using PostgreSQL enums (e.g. `Role`, `Unit`, `TableStatus`, `PaymentType`).
- **Optimistic Locking:** Both `RestaurantTable` and `TableOrder` include a `version Int @default(1)` column to prevent race conditions during concurrent orders.
- **Indexes:** Added indexes on frequently queried columns (`phone` and `dueDate` on `CreditLedger`, `status` on `TableOrder` and `RoomStay`) to optimize query performance.
- **Snake Case Mapping:** All database tables and columns are mapped to `snake_case` using Prisma's `@@map` and `@map` directives to keep PostgreSQL conventions clean.

### Enforcing Row Level Security (RLS) at the Postgres Level
RLS is enforced directly at the PostgreSQL level rather than only in the application layer for defense-in-depth:
1. **Security Coexistence:** In a Supabase setup, the database can be accessed through multiple paths (Next.js backend service, direct API calls, Supabase Realtime, and potential third-party integrations). Centralizing authorization rules in Postgres prevents bypasses from any client.
2. **Strict Data Hiding (cost_price):** The `cost_price` of raw inventory items is sensitive commercial data. By denying `SELECT` on the `raw_items` table to workers and forcing reads through the `raw_items_worker_view` (which completely excludes the `cost_price` column), it is physically impossible for the client to retrieve cost or profit data.
3. **Data Isolation:** RLS policies ensure workers can only read and write their own orders and sales based on their Supabase Auth session, providing absolute isolation.
4. **Dedicated Non-Superuser Runtime Role:** Because database superusers (like `postgres`) bypass RLS entirely by default under PostgreSQL, in Stage B-1 (Auth & Role Enforcement) we will configure a dedicated, non-superuser database role (e.g. `app_user` or Supabase's built-in `authenticated` role) with standard table privileges. The running Next.js application Client will connect using this role, while migrations and system scripts will continue to use the `postgres` superuser. This ensures RLS is active and enforced at runtime.


### Prisma 7 Client Initialization & Connection
Prisma 7 has moved away from the legacy monolithic Rust-based query engines (`library` and `binary`) to a lightweight JavaScript-based query compiler. As a result:
- **Driver Adapters are Mandatory:** At runtime, the client requires an explicit driver adapter to bridge the gap between `PrismaClient` and the database driver (such as `pg`).
- **Centralized Instantiation (`src/lib/prisma.ts`):** To avoid duplicating pool instantiation, connection creation, and hot-reloading bugs in Next.js development, we configure a single global instance of `PrismaClient` in [src/lib/prisma.ts](file:///home/rabin/Documents/JDSekuwaRMS/jd-sekuwa-rms/src/lib/prisma.ts):
  ```typescript
  import { PrismaClient } from "../generated/prisma/client";
  import { PrismaPg } from "@prisma/adapter-pg";
  import { Pool } from "pg";

  const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

  let prismaInstance: PrismaClient;

  if (process.env.NODE_ENV === "production") {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prismaInstance = new PrismaClient({ adapter });
  } else {
    if (!globalForPrisma.prisma) {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const adapter = new PrismaPg(pool);
      globalForPrisma.prisma = new PrismaClient({ adapter });
    }
    prismaInstance = globalForPrisma.prisma;
  }

  export const prisma = prismaInstance;
  ```
- **Service & Script Usage:** For database operations (including the seed script or backend services), always import the shared `prisma` client directly:
  ```typescript
  import { prisma } from "../src/lib/prisma";
  ```

### Commands to Run
Run these commands in order from your terminal at the project root:

1. **Initialize Base Tables:**
   ```bash
   npx prisma migrate dev --name init
   ```

2. **Generate Empty RLS Migration Folder:**
   ```bash
   npx prisma migrate dev --create-only --name rls_policies
   ```
   *Note: After running this, paste the generated folder name back to the agent. The agent will write the RLS SQL to that folder. Then apply it with:*
   ```bash
   npx prisma migrate dev
   ```

3. **Seed Database:**
   ```bash
   npx prisma db seed
   ```

## Backend Layer — Auth

### Connection String Split
To guarantee that Row Level Security (RLS) is active and enforced at runtime:
1. **Superuser (`DATABASE_URL`)**: Points to the PostgreSQL database connecting as the `postgres` superuser. This URL is used exclusively by Prisma migrations (`npx prisma migrate dev`), CLI commands, and database seeding scripts (like `seed-profiles.ts`) to allow administrative operations.
2. **App User (`APP_DATABASE_URL`)**: Points to the PostgreSQL database connecting as the restricted `app_user` login role. This role only has standard grants (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on existing schemas, and is used by the Next.js running application in [src/lib/prisma.ts](file:///home/rabin/Documents/JDSekuwaRMS/jd-sekuwa-rms/src/lib/prisma.ts) for query execution. Connecting under this non-superuser role forces PostgreSQL to actively evaluate Row Level Security policies.

### Postgres Session Context (`setSessionContext`)
Row Level Security policies in PostgreSQL are triggered based on the session parameters `app.current_role` and `app.current_user_id`.
- **Transaction Binding**: Because Prisma pools database connections and does not guarantee that subsequent queries reuse the same physical TCP connection, we **must** set these parameters inside a Prisma transaction (`$transaction`).
- **Functionality**: The `setSessionContext(tx, role, userId)` helper uses PostgreSQL's secure parameter function:
  ```typescript
  await tx.$executeRaw`SELECT set_config('app.current_role', ${role}, true);`;
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true);`;
  ```
  Specifying `true` as the third parameter bounds the configuration life to the local transaction, preventing parameter leakage between requests sharing the connection pool.

### Auth & Gating Gating Boundaries
- **Fast Routing Gating (Middleware)**: Next.js Middleware runs in the Edge Runtime and cannot query the database. For UX speed, it performs a fast pre-filter by inspecting the user's role from their Supabase Auth JWT token's `app_metadata.role` (e.g. `/api/*` and `/(app)/*` gating) in [src/middleware.ts](file:///home/rabin/Documents/JDSekuwaRMS/jd-sekuwa-rms/src/middleware.ts). Because `app_metadata` cannot be edited client-side, it is secure against self-escalation.
- **True Security Boundary (`requireRole` & RLS)**: The middleware is a UX route pre-filter and **not** the true security boundary. The real enforcement is executed server-side (Node.js runtime) at the database layer where:
  - `requireRole(allowedRoles)` queries the live `Profile` row in PostgreSQL.
  - PostgreSQL RLS filters records on connection queries directly.
  Both processes bypass JWT claims to ensure authentic, server-controlled authorization state.

### Role-to-Route Gating & Permissions
| Role | Page Route / API Prefix | Database Action Permissions |
| :--- | :--- | :--- |
| **SUPER_ADMIN** | All Routes | Unrestricted read/write bypass permissions on all tables. |
| **ADMIN** | All Routes except system configuration / Profile modifications | Read/write access to all tables except system settings and modifying roles/users. |
| **WORKER** | `/pos`, `/rooms`, `/tables`, `/api/pos/*`, `/api/rooms/*` | - Select/Update/Insert on own `table_orders`, `order_items`, `quick_sales`, `room_stays`. <br>- Select-only on `restaurant_tables`, `rooms`, `menu_categories`, `menu_items`, `recipes`, `recipe_lines`, `credit_ledgers`, `credit_payments`. <br>- **Denied entirely** on `raw_items` (queries must go through `raw_items_worker_view` to hide `cost_price`), `purchases`, `stock_adjustments`. <br>- Insert-only on `audit_logs` (no reads). |

### Additional Commands to Run

1. **Apply App Role Migration:**
   ```bash
   npx prisma migrate dev
   ```

2. **Seed Local Profiles:**
   ```bash
   npx tsx prisma/seed-profiles.ts
   ```

## Backend Layer — Inventory & Recipes

### Stock Deduction & Restoration Logic
- **Deduction (`deductForSale`)**: When a menu item is sold, the system queries the item's recipe (selecting only non-sensitive fields to comply with RLS column privileges) and decrements each `RawItem.currentStock` by the required amount (`qtyPerUnit * soldQty`). If any raw ingredient stock falls below zero, the transaction is aborted and a typed `InsufficientStockError` (400) is raised. It returns a snapshot array of the exact deductions made.
- **Restoration (`restoreForVoid`)**: When an order item is voided or cancelled, the system reads the snapshot stored on that specific `OrderItem` and increments the raw inventory stock levels back to their pre-sale state.

### OrderItem JSON Snapshot Dependency (B-3 Integration)
Because menu recipes and ingredient weights can change over time, resolving stock restorations by querying the *current* recipe would lead to drift.
- **`rawDeductions` Column**: We added a `rawDeductions Json?` column to the `OrderItem` model.
- **B-3 Obligation**: When implementing sale flows in Stage B-3, the developer **must** capture the deduction array returned by `deductForSale()` and save it directly to the `rawDeductions` field of the created `OrderItem` records:
  ```typescript
  // Example B-3 Sales logic:
  const deductions = await deductForSale(menuItemId, qty, overrideQty, tx);
  await tx.orderItem.create({
    data: {
      menuItemId,
      qty,
      unitPrice,
      rawDeductions: deductions, // SAVE SNAPSHOT HERE
      ...
    }
  });
  ```

### Commands to Run

1. **Apply OrderItem Schema Changes:**
   ```bash
   npx prisma migrate dev --name add_raw_deductions
   ```

2. **Generate and Apply RLS Stock Privilege Migration:**
   ```bash
   npx prisma migrate dev --create-only --name rls_raw_items_update
   # Paste privileges raw SQL to the migration file, then run:
   npx prisma migrate dev
   ```

3. **Run Inventory Unit Tests:**
   ```bash
   npx vitest run src/services/inventory.test.ts
   ```

## Backend Layer — Sales & Tables

### Atomicity & Settle-Time Deduction
- **Quick Sales**: POS Quick Sales execute immediate stock calculations, call `deductForSale`, write transaction receipts, and create customer credits in a single transaction.
- **Table Orders**: Adding or removing items on an open table order updates the items registry but **does not** deduct inventory. Deduction runs atomically inside the settle transaction when calling `closeTableOrder`. If any ingredient has insufficient stock, the entire transaction is rolled back.
- **Deduction Snapshot**: Every completed line item saves the resolved list of raw ingredient deductions on `OrderItem.rawDeductions`. Voids utilize this snapshot via `restoreForVoid` to increment stock levels back.

### Optimistic Locking & TableConflictError
- **Concurrency Safeguard**: Multiple devices can modify table states simultaneously. To prevent overwrites (e.g. two waiters opening the same vacant table or adding items simultaneously), the system tracks a `version` column on `RestaurantTable` and `TableOrder`.
- **Conflict Handling**: Every state mutation checks `WHERE version = current_version` and increments `version`. If the update affects 0 rows, a `TableConflictError` is raised. The client should trap HTTP 409 responses, fetch the fresh state, and retry.

### Commands to Run

1. **Apply TableOrder Payment Settle Schema Changes:**
   ```bash
   npx prisma migrate dev --name add_payment_fields_to_table_orders
   ```

2. **Run Sales Unit & Integration Tests:**
   ```bash
   npx vitest run src/services/sales.test.ts
   ```

## Backend Layer — Rooms

### Room Stay Lifecycle
- **Guest Check-in**: Reserves the selected vacant room by updating its status to `OCCUPIED` and creating an active `RoomStay` record containing the guest's profile, nights, and ID proof.
- **Service Charges**: Any food/drinks ordered during a guest stay are written as `OrderItem` records linked to the stay. Stock levels are calculated and decremented immediately during the transaction.
- **Date Updates**: Stays can have their check-out dates and stays duration adjusted directly prior to checkout without recalculating stock.
- **Stay Checkout**: Computes total billing as: `nights * nightly_rate` plus all associated food items. Voids the occupancy state of the room back to `VACANT` and marks the stay as `CHECKED_OUT`.

### Concurrency & Credit Merging
- **Optimistic Concurrency**: Uses manual version locking on `Room` and `RoomStay` to prevent multiple reception desks from booking the same room or settling checkout bills simultaneously. Mismatches raise `RoomConflictError` (HTTP 409).
- **Consolidated Credit Ledgers**: Guest checkout credit balances are automatically merged with any existing `PENDING` food credits under their phone number using a shared `upsertCreditEntry` helper, maintaining a single, clean ledger sheet.

### Commands to Run

1. **Apply Room Versioning Schema Changes:**
   ```bash
   npx prisma migrate dev --name add_room_version_fields
   ```

2. **Run Room Service Unit & Integration Tests:**
   ```bash
   npx vitest run src/services/rooms.test.ts
   ```

## Backend Layer — Credit Ledger

### Customer Summaries & Overdue Gating
- **Credit Summary**: Groups active unpaid ledger records by the customer's phone number, displaying consolidated outstanding balances. Paid or written-off entries are fully excluded from active lists.
- **Overdue Flagging**: Automatically marks a customer as `isOverdue` if any of their active credits exceed their set `dueDate`.
- **Payment Log & Status Transitions**: Recording a payment appends a `CreditPayment` line, recalculating the parent ledger status (`PENDING` -> `PARTIAL` -> `PAID`) based on the remaining total balance.
- **Write-Offs**: Restricts write-off capabilities exclusively to `ADMIN` and `SUPER_ADMIN` accounts, logging actions to the audit trail and removing the balance from outstanding aggregates.

### Commands to Run

1. **Run Credit Ledger Service Unit & Integration Tests:**
   ```bash
   npx vitest run src/services/credit.test.ts
   ```

## Backend Layer — Purchases

### Purchases Recording & Access Gating
- **Recording Purchases**: Multiplies `qty * unitCost` to log new incoming raw ingredients. Updates `RawItem.currentStock` values immediately and writes a comprehensive audit trail entry.
- **Admin-Only Gating**: Enforces role restrictions at the service level. Workers have zero access to listing or recording purchases (which matches database RLS rules that fully deny `WORKER` access to the `purchases` table).
- **History Filtering**: Allows Admins to view chronologically sorted logs filterable by date range and ingredient ID.

### Commands to Run

1. **Run Purchases Service Unit & Integration Tests:**
   ```bash
   npx vitest run src/services/purchase.test.ts
   ```

## Backend Layer — Reports

### Reports Computations & Gating
- **Daily Sales Summary**: Aggregates all quick sales, table closed bills, and room check-out totals (stay rates + food charges) for the calendar day.
- **Sales Trends & Item Analytics**: Groups daily revenues sequentially across date ranges, and tracks item volumes to display best and slow sellers.
- **Credit & Room Occupancies**: Displays credit exposure profiles (outstanding, overdue, and written-off) along with occupied rooms and nights sold revenue.
- **Profit Summary**: Subtracts total raw purchase costs from total gross sales. Strictly gated to `SUPER_ADMIN` callers; access is blocked for `ADMIN` and `WORKER` roles.

### Commands to Run

1. **Run Reports Service Unit & Integration Tests:**
   ```bash
   npx vitest run src/services/reports.test.ts
   ```

## Backend Layer — Dashboard

### Dashboard Aggregation & Role-Based Stripping
- **Composition Pattern**: The dashboard service composes data from `reports.service` (daily sales), `inventory.service` (stock alerts), `credit.service` (credit reminders), and direct Prisma queries (room/table statuses). No business logic is re-implemented.
- **Stock Alerts**: Filters raw inventory items where `currentStock < minThreshold`, surfacing low-stock warnings.
- **Credit Reminders**: Returns the top 5 overdue-first credit customer summaries for Admin/SuperAdmin callers.
- **Room & Table Status**: Returns current status of all rooms and tables, with open order running totals for tables.
- **Worker Financial Stripping**: At the service layer (not the frontend), all financial fields are stripped for `WORKER` callers:
  - `dailySales` → `null`
  - `creditReminders` → `[]`
  - `rooms[].nightlyRate` → `null`
  - `tables[].openOrderTotal` → `null`

### Commands to Run

1. **Run Dashboard Service Unit & Integration Tests:**
   ```bash
   npx vitest run src/services/dashboard.test.ts
   ```

## Backend Layer — Printing & Email

### Print Payload Shaping
- **Kitchen Order Tickets (KOT)**: The `buildKotPayload(tableOrderId)` service compiles order details containing kitchen-category items only. To align with standard kitchen preparation receipts, all pricing, subtotals, and totals are excluded from the shaped payload.
- **Receipt Bills**: The `buildReceiptPayload(id)` service processes both closed Table Orders and POS Quick Sales, resolving itemized listings of quantities, unit rates, item totals, discounts, taxes, and final totals. It converts decimal fields into numeric floats/integers for immediate client-side handling.

### Email Delivery via Resend
- **Mock Fallback**: In local/testing environments without a valid `RESEND_API_KEY`, the dispatch helper intercepts emails, logs the formatted HTML to the console, and returns a simulated success payload. This simplifies sandbox development.
- **Transactional Password Reset**: Uses the Supabase admin client to generate user password recovery links (`supabase.auth.admin.generateLink`) and mails a transactional reset email with a brand accent button (`#E8590C`).
- **Low Stock Digest**: Compiles a tabular digest reporting ingredients where the current stock has fallen below the safety threshold.
- **Overdue Credit Digest**: Compiles a tabular digest listing unpaid credit balances past their payment terms.

### Commands to Run

1. **Run Printing & Email Service Unit & Integration Tests:**
   ```bash
   npx vitest run src/services/print.test.ts src/services/email.test.ts
   ```

## Frontend Layer — Design System

### Custom Typography & Styling Tokens
- **Typography**: Wired Roboto via Google Fonts (`next/font/google`) as the single typeface family across the application. Structured metrics and data lists use `tabular-nums` formatting to align columns.
- **Tailwind Tokens**:
  - `background`: `#FFFFFF`
  - `surface-sunken`: `#F7F7F8`
  - `ink` (foreground): `#1A1A1A`
  - `ink-muted`: `#6B7280`
  - `primary` (brand accent): `#E8590C`
  - `primary-hover`: `#C94A08`
  - `success`: `#16A34A`
  - `warning`: `#D97706`
  - `danger`: `#DC2626`
  - `info`: `#2563EB`
  - `border`: `#E5E7EB`
  - `radius: card`: `12px`
  - `radius: control`: `8px`
- **Dark Mode Support**: Built fully responsive colors for dark mode (`.dark`) matching corresponding elements for modern aesthetic visual continuity.

### App Shell Routing & Navigation
- **Grouped Routing Layout**: Configured `/src/app/(app)/layout.tsx` to wrap all core operational sub-pages (Dashboard, POS, Tables, Rooms, Inventory, Purchases, Credit, Reports, Users, Settings) inside the responsive App Shell.
- **Sidebar Collapse**:
  - Desktop Mode (>= 1024px): Collapsible left sidebar containing full navigation labels, collapsing to icon-only.
  - Tablet Mode (< 1024px): Sidebar automatically collapses to icon-only.
  - Mobile Mode (< 640px): Sidebar is hidden; navigation is served through a modern sticky bottom navigation bar.
- **Topbar Control**: Displays the active page title, global search bar placeholder, notification bell, active role badge (Worker, Admin, Super Admin), and user sign-out trigger.

### Reusable UI Primitives
- **StatCard (`src/components/ui/stat-card.tsx`)**: Renders metric counts, labels, icons, and green/red positive/negative delta pills with clean `tabular-nums` formatting.
- **PageHeader (`src/components/ui/page-header.tsx`)**: Configures standard title, description, and action button alignment templates.
- **DataTable (`src/components/ui/data-table.tsx`)**: Implements high-density tables matching Odoo list views. Supports column alignment and sort triggers.
- **Modal & Sheet (`src/components/ui/modal-sheet.tsx`)**: Provides dialog overlay boxes and side sheet drawer templates.
- **StatusBadge (`src/components/ui/status-badge.tsx`)**: Maps standard database status enums (e.g. `VACANT`, `OCCUPIED`, `PAID`, `PENDING`, `OVERDUE`) to corresponding success, warning, info, and danger styling badges.

## Frontend Layer — Auth

### Authentication Pages
- **Sign In Page (`/login`)**: Built as a premium split-screen design. The left section details the charcoal grill branding with floating spark animations, and the right contains the white card credentials form. Supports sandbox autofills for immediate developer role testing.
- **Password Recovery Page (`/forgot-password`)**: Shares the centered white credentials card layout to prompt for staff emails.
- **Client-Side API Consumptions**: All user logic runs through our local `/api/auth/` backend endpoints (`/api/auth/login` and `/api/auth/forgot-password`) rather than calling Supabase client libraries directly inside pages. This preserves backend service validation rules as the single source of truth.

## Frontend Layer — Dashboard

### Live Operational Dashboard
- **TanStack Query Binding**: The dashboard utilizes React Query (`useQuery`) targeting the backend aggregations `/api/dashboard` (Stage B-8) endpoint, storing local cache queries.
- **Live Supabase Realtime**: Hooks up a single PostgreSQL state-change channel listener binding. The moment a database mutation registers (insert/update/delete) on `restaurant_tables`, `table_orders`, `rooms`, `room_stays`, `raw_items`, `quick_sales`, or `credit_ledgers`, React Query automatically invalidates the `"dashboard"` cache key, executing instant background refetches to refresh the interface across all terminal terminals.
- **Role-Appropriate Widget Gating**: In compliance with backend API role exclusions, workers only see operational grids for Rooms and Dine-in Tables (financial properties such as daily revenues, running orders pricing, nightly room rates, and credit summaries are dynamically omitted). Full stats cards and overdue balances show for `ADMIN` and `SUPER_ADMIN` staff roles.

## Frontend Layer — Inventory

### Inventory Listing & Cost Gating
- **Endpoint Gating**: Resolves the raw items list via `GET /api/inventory` (Stage B-2). The UI columns mapping dynamically detects whether `costPrice` is present inside the payload. If it is null (as gated in PostgreSQL for the `WORKER` role), the cost column is automatically omitted from the DataTable primitive without hardcoding front-end role parameters.
- **Live Stock Adjustments**: Staff can launch the "Adjust Stock" modal to submit restocks (positive delta values) or record wastage (negative delta values). Submitting fires a `POST` request to `/api/inventory/[id]/adjust` and invalidates query caches instantly.

### Recipe Costing Builder
- **Dynamic Recipe Modals**: Gated to `ADMIN` and `SUPER_ADMIN` accounts. Staff can configure raw ingredient lines (e.g. raw pork meat weight per plate of Pork Sekuwa) and execute a `PUT /api/menu-items/[id]/recipe` operation.
- **Margin Calculations**: Renders real-time sell pricing, calculated ingredient costs (`costPerUnit` returned by the recipe endpoint), and gross profitability columns. Costing breakdowns are hidden automatically if the user is unprivileged.

## Frontend Layer — POS

### Category Grid & Shopping Cart
- **Grid Menu Lists**: Retrieves active items and categories via `/api/pos/menu` (Stage B-3) populate tabs. Clicking items places them into the checkout cart.
- **Administrative Discount Gating**: In compliance with cashier rules, the discount entry input is fully disabled and visually locked for cashiers/waiters holding the `WORKER` role. Only `ADMIN` or `SUPER_ADMIN` staff can insert discount deductions.
- **Credit Customer Checkouts**: Collects guest information (Names, phone numbers) which is strictly validated if the payment type dropdown is set to `CREDIT`.

### On-screen Receipt & Void Controllers
- **Receipt Visualizer**: Upon checkout completion, the UI launches a modal displaying the exact receipt structure compiled by `/api/pos/receipt/[id]` (based on the backend's `buildReceiptPayload` method).
- **Line-item Voiding**: Privilege-locked line void keys are provided. When clicked, they trigger a `POST` request to `/api/order-items/[id]/void` to cancel the entry, automatically restoring raw ingredient safety levels in a database transaction and invalidating dashboard query caches.

## Frontend Layer — Rooms

### Lodging Overview & Gated Details
- **Privacy Gating**: Rooms data loads from `GET /api/rooms`. Under the `WORKER` role, nightly room rates and lodging aggregates are completely stripped from database queries, which is reflected in the UI (Workers only see occupied/vacant states and running food totals).

### Check-in & Service Charging
- **Registration**: Staff check guests in using the **Check In Guest** modal (Guest Name, Phone, ID Proof, Guest Count, expected checkout dates) which calls `POST /api/rooms/[id]/check-in`.
- **POS Service Charge Reuse**: The **Service Charge** modal implements the POS category menu-grid. Cashiers select raw ingredients or food items and post them atomically to `/api/rooms/stay/[id]/charge`.

### Settlement Check-out
- **Checkout Calculations**: Summarizes room stays and service charges. Staff choose settlement payment methods (Cash, Card, Credit) and submit checking out to `POST /api/rooms/stay/[id]/check-out`.

## Frontend Layer — Credit

### Outstanding Summaries List
- **Summaries Grid**: Queries `GET /api/credit/customers` (Stage B-5) to compile summaries. Lists customer names, phones, overdue indicators, and outstanding balances.

### Customer Passbook & Payments
- **Ledger passbooks**: Clicking a customer summary row opens their passbook sheet from `GET /api/credit/customer/[phone]`. Lists original credit lines, date given, and settlement statuses.
- **Payment Settlements**: Staff can trigger the **Record Repayment** modal to settle bad debt segments using `POST /api/credit/[id]/payment`.
- **Administrative Write-offs**: The write-off triggers are gated. Only `ADMIN` or `SUPER_ADMIN` accounts see or can invoke `POST /api/credit/[id]/write-off`.

## Frontend Layer — Purchases

### Administrative Access Control
- **Routing Protection**: In compliance with middleware configurations, the `/purchases` view and all API endpoints under `/api/purchases` are completely blocked to the `WORKER` role. Attempts to access this route will redirect to fallback pages.

### Purchase Logs & Search Filters
- **Filter Rails**: The purchase history is populated via `GET /api/purchases` (Stage B-6). Admins can filter logs based on start/end dates and raw ingredient types, automatically reloading query caches.
- **Acquisitions Entry**: Selecting raw ingredients and inputting quantities and unit costs via the **Record Purchase** modal updates stock limits atomically via `POST /api/purchases`, invalidating inventory and dashboard cached records.








