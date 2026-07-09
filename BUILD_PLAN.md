# JD Sekuwa House — RMS Build Playbook (v2)
### Layered build: Database → Backend → Frontend → Testing → Deployment

## Why this structure

Odoo builds every module the same way regardless of feature: **model (schema + constraints) → business logic methods on the model → thin controller/view on top**. Business logic never lives in the controller. SAP Fiori follows the same discipline: the OData service layer owns all business rules; the Fiori UI is a thin consumer that never contains logic of its own. This playbook follows that same discipline, mapped onto Next.js:

- **Database layer** = Prisma schema + migrations + RLS policies. The single source of truth for what data *can* look like.
- **Backend layer** = a `services/` directory of plain functions containing all business rules (stock deduction, credit math, optimistic locking, role checks). Route handlers are thin — they validate input, call one service function, return a response. No business logic in a route handler, ever.
- **Frontend layer** = UI components that call the backend through a typed client. No direct DB access, no business logic duplicated in the browser.
- **Testing layer** = unit tests on services, integration tests on route handlers, run headlessly via a test runner. No browser automation — you're doing manual UI verification yourself, so the agent never opens a browser.
- **Deployment layer** = the last stage, once everything above is verified.

Every stage prompt below ends with the same instruction: **append to a running `DOCUMENTATION.md`** describing what was built and why, so you always have a readable record of the project's history without digging through commit logs.

---

## 0. Updated stack decisions

| Concern | Decision |
|---|---|
| ORM | **Prisma** (swapped per your prior experience + Prisma 7 removed the Rust engine, closing the old cold-start gap — see our earlier discussion) |
| Local DB | Supabase CLI (`supabase start`) — local Postgres/Auth/Realtime that mirrors production |
| Fonts | **Roboto** only (400/500/700), in the spirit of Odoo (which ships Roboto by default) and SAP Fiori's neutral enterprise sans-serif. One family, differentiated by weight and size — no second "display" typeface. Numeric stat figures use `font-variant-numeric: tabular-nums` so columns of numbers align cleanly, same trick SAP Fiori tables use. |
| Business logic location | `/services` directory, plain TypeScript functions, framework-agnostic where possible — this is your "Odoo model methods" layer |
| Testing | Vitest for unit tests (services) + integration tests against route handlers using a local test database — no Playwright/Cypress, no browser automation |
| Scaffolding | You run the actual `npx`/`npm` commands yourself (below); the agent only touches files, never installs tooling |

---

## PART A — Commands you run yourself

Run these directly in your terminal in the project folder. Once each block finishes, paste the relevant output/config file back to the agent when a stage prompt asks for it — this keeps the agent from ever needing to invoke installers itself.

**A.1 — Project init**
```
npx create-next-app@latest jd-sekuwa-rms --typescript --tailwind --app --src-dir --import-alias "@/*"
cd jd-sekuwa-rms
```

**A.2 — Core dependencies**
```
npm install @prisma/client zod @tanstack/react-query resend @supabase/supabase-js @supabase/ssr
npm install -D prisma vitest @vitejs/plugin-react
```

**A.3 — UI tooling**
```
npx shadcn@latest init
npm install lucide-react recharts
```

**A.4 — Prisma init**
```
npx prisma init
```
This creates `/prisma/schema.prisma` and a `.env` — paste me the generated file structure once done.

**A.5 — Supabase CLI + local stack**
```
npm install -g supabase
supabase init
supabase start
```
This prints your local API URL, anon key, service role key, and local DB connection string — paste that output to the agent when Stage D-1 asks for it (redact nothing locally, these are dev-only throwaway keys).

**A.6 — Google Fonts**
No install needed — Roboto is pulled via `next/font/google` inside the code, which the agent will wire up in Stage F-1.

Once A.1–A.5 are done, hand the outputs to the agent and start with Stage D-1.

---

## PART B — Database Layer

### STAGE D-1 — Prisma schema, migrations, RLS

```
Context: I've already run `create-next-app`, installed Prisma, and run `supabase start`
locally. Here is the output of my local Supabase stack: [paste your local API URL,
anon key, service role key, and DB connection string here]. Here is my generated
prisma/schema.prisma starter: [paste file].

Do NOT run any npm/npx install commands yourself — all packages are already installed.
Only create/edit files.

1. Wire prisma/schema.prisma to use the local Supabase Postgres connection string via
   DATABASE_URL in .env, with a separate DIRECT_URL for migrations (Supabase requires
   this split when using connection pooling).

2. Model the full schema in Prisma, matching our requirements document exactly:
   - Profile (role enum: SUPER_ADMIN/ADMIN/WORKER, linked to Supabase auth user id)
   - MenuCategory (isKitchen boolean), MenuItem
   - RawItem (unit enum: KG/LITRE/PIECE, currentStock, minThreshold, costPrice)
   - Recipe + RecipeLine (raw item + qtyPerUnit)
   - RestaurantTable (status enum: VACANT/OCCUPIED/RESERVED, currentTag, version Int
     for optimistic locking)
   - TableOrder (status, openedBy, openedAt, closedAt, version Int)
   - OrderItem (belongs to TableOrder or QuickSale, qty, unitPrice, rawQtyOverride,
     isVoid, voidedBy, voidedAt)
   - QuickSale (paymentType enum: CASH/CREDIT/CARD, subtotal, discount, total)
   - Room (nightlyRate, status enum: VACANT/OCCUPIED)
   - RoomStay (guestName, phone, idProof, numGuests, checkIn, expectedCheckOut,
     actualCheckOut, numNights, status)
   - CreditLedger (customerName, phone, source enum: TABLE_SALE/QUICK_SELL/ROOM_STAY,
     sourceId, amount, givenDate, dueDate, status enum: PENDING/PARTIAL/PAID/WRITTEN_OFF)
   - CreditPayment (creditLedgerId, amount, paidAt, recordedBy)
   - Purchase (rawItemId, qty, unitCost, totalCost, supplierName, purchasedAt, recordedBy)
   - StockAdjustment (rawItemId, qtyDelta, reason, adjustedBy, adjustedAt)
   - AuditLog (userId, action, entityType, entityId, meta Json, createdAt)
   Use proper Prisma relations, indexes on frequently-queried columns (phone on
   CreditLedger, status on TableOrder/RoomStay, dueDate on CreditLedger), and
   @@map to snake_case table names since we're on Postgres.

3. Generate the migration: this stage's output should be the schema.prisma file plus
   the exact `npx prisma migrate dev --name init` command for me to run myself (do not
   attempt to run it) — give me the command and tell me what output to expect.

4. Prisma does not manage Postgres RLS. Write a second, hand-authored raw SQL file
   at prisma/migrations/<timestamp>_rls_policies/migration.sql (following Prisma's
   convention for hand-written migrations so it slots into migration history
   correctly) containing:
   - RLS enabled on every table
   - Worker role: full read/write on their own table orders / quick sales / room
     stays; read-only on menu/inventory; explicitly no SELECT on cost_price or any
     profit-bearing column (create a Postgres view `raw_items_worker_view` excluding
     those columns for worker-facing reads)
   - Admin role: full read/write except profile management and system settings
   - Super Admin: unrestricted
   Also give me the exact command to apply this migration.

5. Write a prisma/seed.ts seed script: 8 tables (Table 1-8), 2 rooms, ~6 menu
   categories (Sekuwa/Starters/Rice-Roti = kitchen, Drinks/Cigarettes = non-kitchen),
   ~15 menu items with realistic NPR pricing, and one full recipe example (Sekuwa
   plate -> pork + spice mix) matching our requirements doc's worked example. Give
   me the command to run it.

6. Create DOCUMENTATION.md at the project root if it doesn't exist, and add a
   "## Database Layer" section describing: the full schema decisions made, why RLS
   is enforced at the Postgres level rather than only in application code, and the
   exact migration commands I need to run. Every future stage will append its own
   section to this same file — do not overwrite earlier sections.

Do not touch any frontend or API route files in this stage — schema and migrations
only. Give me back the schema.prisma content and the exact terminal commands I need
to run (migrate, apply RLS migration, seed) — I will run them and paste you the output.
```

---

## PART C — Backend Layer (services + API routes)

> Each prompt below builds one module's **service layer first** (pure business logic, unit-testable, no HTTP concerns), then a **thin API route** on top of it. This mirrors Odoo's model-method pattern — logic lives in `/services`, routes just marshal request/response.

### STAGE B-1 — Auth & role enforcement (backend only)

```
Build the backend auth and authorization layer. No UI in this stage.

1. Create /src/services/auth.service.ts: getCurrentProfile(), requireRole(allowedRoles[])
   helper that throws a typed ForbiddenError if the current user's role isn't allowed,
   and a hasRole() check usable elsewhere.

2. Create Next.js middleware.ts that reads the Supabase session, attaches the resolved
   role to the request context, and blocks unauthenticated requests to any route
   under /api and /(app) except /login and /api/auth/*.

3. Create /src/services/audit.service.ts: logAction(userId, action, entityType,
   entityId, meta) writing to AuditLog — every other service in later stages will
   call this on writes.

4. Build API routes: POST /api/auth/login, POST /api/auth/logout,
   POST /api/auth/forgot-password (stub the actual email send for now — return a
   TODO marker, we wire Resend in Stage B-9).

5. Write a seed script addition (or separate script) that creates the 5 real
   Profile rows (1 super_admin, 2 admin, 2 worker) with placeholder emails —
   give me the exact command, do not run it yourself.

6. Append a "## Backend Layer — Auth" section to DOCUMENTATION.md: what
   requireRole() enforces, where middleware blocks requests, and the full list of
   role-to-route restrictions per our requirements doc (Section 2).

No pages, no components, no browser-facing anything in this stage.
```

### STAGE B-2 — Inventory & recipe costing service

```
Build /src/services/inventory.service.ts — the core stock/costing engine.

1. getInventoryList(role): returns raw items; strips cost_price and any profit
   field entirely from the returned object (not just omitted in a type — actually
   absent from the query) when role is WORKER, by querying the raw_items_worker_view
   from Stage D-1 instead of the base table.

2. adjustStock(rawItemId, qtyDelta, reason, userId): writes a StockAdjustment row,
   updates RawItem.currentStock, logs to audit. Wrap in a Prisma $transaction so
   partial writes can't happen.

3. upsertRecipe(menuItemId, lines[]): create/update Recipe + RecipeLine rows.
   computeCostPerUnit(menuItemId): sums (rawItem.costPrice * qtyPerUnit) across
   recipe lines, only callable server-side / by Admin+.

4. deductForSale(menuItemId, qty, overrideRawQty?): the function every sale flow
   will call. Looks up the recipe (if one exists), computes actual raw quantity
   to deduct (override if given, else recipe qty * sold qty), decrements each
   RawItem.currentStock in one transaction, throws a typed InsufficientStockError
   if any raw item would go negative (do not silently allow negative stock).

5. restoreForVoid(orderItemId): reverses the exact deduction that was made for
   that specific order item (store the deducted raw quantities on OrderItem at
   sale time so restoration is exact even if the recipe changes later).

6. Write Vitest unit tests for deductForSale and restoreForVoid using our seeded
   Sekuwa recipe (1kg pork + spice batch -> 3 plates) — assert the exact stock
   math from our requirements doc's worked example, and assert
   InsufficientStockError fires correctly when stock is too low.

7. Thin API routes: GET /api/inventory, POST /api/inventory/:id/adjust,
   GET|PUT /api/menu-items/:id/recipe — each route just validates input with Zod,
   checks role via requireRole, and calls the service function. No business logic
   in the route file itself.

8. Append "## Backend Layer — Inventory & Recipes" to DOCUMENTATION.md: the
   deduction/restoration logic, why cost data never reaches Worker-role responses,
   and how to run the new Vitest suite (give me the command).
```

### STAGE B-3 — Sales service (Quick Sell + Table Sale shared core)

```
Build /src/services/sales.service.ts — shared logic behind both POS and Table Sale.

1. createQuickSale(cashierId, items[], paymentType, discount?, customerInfo?):
   validates discount is only non-zero if caller role is ADMIN+ (re-check server-side
   even though the frontend will also gate this), calls deductForSale per line
   item, writes QuickSale + OrderItems, creates/updates a CreditLedger entry if
   paymentType is CREDIT (matched by phone), all inside one Prisma $transaction so
   a sale is atomic: if inventory deduction fails, nothing is written.

2. voidOrderItem(orderItemId, userId): marks isVoid, calls restoreForVoid, adjusts
   the parent sale's total, logs to audit with who/what/when — allowed for any
   authenticated role per our confirmed decisions.

3. openTableOrder(tableId, tag?, userId): optimistic-locked update — reads the
   table's current `version`, attempts an UPDATE ... WHERE version = $current,
   increments version; if zero rows affected, throw a typed TableConflictError
   so the caller knows another device won the race.

4. addItemsToTableOrder / removeItemFromTableOrder / moveTableOrder / mergeTableOrders:
   same optimistic-locking pattern on TableOrder.version for every mutating action.

5. closeTableOrder(tableOrderId, paymentType, discount?, customerInfo?): final bill,
   reuses the deduction + credit logic from createQuickSale, clears the table's tag,
   frees the table to VACANT, all in one transaction.

6. Vitest unit + integration tests: assert two concurrent openTableOrder calls on
   the same table result in exactly one success and one TableConflictError; assert
   a closeTableOrder correctly deducts inventory and creates a credit entry when
   paid on credit.

7. Thin API routes under /api/pos and /api/tables/[id]/* calling these services.

8. Append "## Backend Layer — Sales & Tables" to DOCUMENTATION.md: the atomicity
   guarantees, the optimistic locking mechanism and what a TableConflictError
   means for the caller, and the test command to run.
```

### STAGE B-4 — Room management service

```
Build /src/services/rooms.service.ts.

1. checkIn(roomId, guestDetails): creates RoomStay, flips Room.status to OCCUPIED
   (optimistic-locked like tables), logs audit.

2. addRoomServiceCharge(roomStayId, menuItemId, qty): reuses deductForSale, appends
   to that stay's running charges.

3. checkOut(roomStayId, paymentType): computes nights * nightlyRate + all charged
   items, writes final total, if CREDIT merges into the same CreditLedger entry
   as any existing food credit under that phone number (matching logic shared
   with sales.service — extract a shared `upsertCreditEntry` helper used by both).

4. Allow direct edits to expectedCheckOut/numNights on an open stay before checkout
   (no special recalculation logic, per our confirmed scope).

5. Unit tests: full check-in -> add charge -> check-out-with-credit flow, asserting
   the combined credit ledger entry is correct.

6. Thin routes under /api/rooms/*.

7. Append "## Backend Layer — Rooms" to DOCUMENTATION.md.
```

### STAGE B-5 — Credit ledger service

```
Build /src/services/credit.service.ts.

1. listCreditCustomers(): grouped by phone, with total outstanding, overdue flag
   (dueDate < now AND status != PAID/WRITTEN_OFF), sorted overdue-first then by
   amount desc.

2. getCustomerLedger(phone): full transaction + payment history, oldest first.

3. recordPayment(creditLedgerId, amount, recordedBy): appends CreditPayment, recomputes
   status (PENDING -> PARTIAL -> PAID) based on remaining balance, all in a transaction.

4. writeOff(creditLedgerId, userId): requireRole([ADMIN, SUPER_ADMIN]) only, sets
   status WRITTEN_OFF, logs audit — entry stays visible in history but excluded
   from pending/overdue aggregates.

5. Unit tests: overdue flagging with a backdated dueDate, partial-payment status
   transitions, write-off permission enforcement (assert WORKER role is rejected).

6. Thin routes under /api/credit/*.

7. Append "## Backend Layer — Credit Ledger" to DOCUMENTATION.md.
```

### STAGE B-6 — Purchase service

```
Build /src/services/purchase.service.ts.

1. recordPurchase(rawItemId, qty, unitCost, supplierName?, recordedBy): computes
   totalCost, increases RawItem.currentStock, logs audit, all in a transaction.

2. listPurchases(filters: {dateRange?, rawItemId?}): filterable history,
   requireRole([ADMIN, SUPER_ADMIN]) — Workers get no access to this service at all.

3. Unit tests: purchase correctly increases stock and that a WORKER-role caller
   is rejected.

4. Thin routes under /api/purchases/*.

5. Append "## Backend Layer — Purchases" to DOCUMENTATION.md.
```

### STAGE B-7 — Reports service

```
Build /src/services/reports.service.ts.

1. getDailySalesSummary(), getSalesTrend(range), getItemWiseSales(range)
   (best/slow sellers), getPurchaseCostReport(range), getCreditOutstandingReport(),
   getRoomOccupancyReport(range), getProfitSummary(range) — the last one
   requireRole([SUPER_ADMIN]) only, computing sales total minus purchase cost total.

2. Each function returns plain serializable data shaped for a chart or stat card —
   no formatting/presentation logic here, that belongs to the frontend layer.

3. Unit tests against seeded data for at least getDailySalesSummary and
   getProfitSummary, asserting the arithmetic is correct and that a non-Super-Admin
   caller is rejected from getProfitSummary.

4. Thin routes under /api/reports/*.

5. Append "## Backend Layer — Reports" to DOCUMENTATION.md.
```

### STAGE B-8 — Dashboard aggregation service

```
Build /src/services/dashboard.service.ts, composing the services already built
rather than re-implementing logic:

1. getDashboardData(role): daily sales (from reports.service), stock alerts
   (raw items below minThreshold, from inventory.service), credit reminders
   (top 5 overdue-first, from credit.service), room status (from rooms.service),
   table status (from sales.service). Strip financial fields entirely for WORKER
   role at the service layer, not the frontend.

2. Unit test asserting a WORKER-role call returns no sales/credit figures at all
   and an ADMIN-role call does.

3. Thin route GET /api/dashboard.

4. Append "## Backend Layer — Dashboard" to DOCUMENTATION.md.
```

### STAGE B-9 — Printing bridge + Resend email (backend)

```
1. Build /src/services/print.service.ts: buildKotPayload(tableOrderId) — kitchen-
   category items only, no prices; buildReceiptPayload(saleId | tableOrderId) —
   full itemized bill with prices. These return structured data only; actual QZ
   Tray communication happens client-side in the frontend stage, since QZ Tray
   connects over the browser to localhost — the backend's job is just to shape
   the correct payload per printer.

2. Build /src/services/email.service.ts wired to Resend: sendPasswordResetEmail(),
   sendLowStockDigest(), sendOverdueCreditDigest(). Use plain, readable HTML
   templates (white background, single accent-color button) — no external email
   framework needed for this volume.

3. Wire the Stage B-1 forgot-password route to actually call sendPasswordResetEmail
   now that this service exists.

4. Unit test the payload-shaping functions (assert non-kitchen items never appear
   in a KOT payload; assert prices never appear in a KOT payload).

5. Append "## Backend Layer — Printing & Email" to DOCUMENTATION.md, and note that
   I will supply the RESEND_API_KEY into .env myself before this can send real email.

Do not attempt to install or configure QZ Tray itself in this stage — that's a
frontend + local-machine concern, covered in Stage F-9.
```

---

## PART D — Frontend Layer

> Every stage in this part consumes an already-working, already-tested backend route. No new business logic gets written here — if a screen needs a calculation the service layer doesn't already provide, that's a sign a backend stage was incomplete, not something to patch in a component.

### STAGE F-1 — Design system & app shell

```
Build the design system and app shell. No feature pages with real data yet.

1. Wire Roboto via next/font/google (weights 400, 500, 700) as the only typeface
   in the app — no second display font. Apply font-variant-numeric: tabular-nums
   to any element carrying a numeric stat, so number columns align like an
   SAP Fiori or Odoo list view.

2. Tailwind theme tokens:
   - background #FFFFFF, surface-sunken #F7F7F8
   - ink #1A1A1A, ink-muted #6B7280
   - primary (brand accent) #E8590C, primary-hover #C94A08
   - success #16A34A, warning #D97706, danger #DC2626, info #2563EB
   - border #E5E7EB, radius: card 12px, control 8px

3. App shell: collapsible left sidebar (Dashboard, POS, Tables, Rooms, Inventory,
   Purchases, Credit, Reports, Users, Settings), collapsing to icon-only under
   1024px and a bottom nav under 640px. Top bar: page title, search, notification
   bell, role badge.

4. Reusable primitives: StatCard (large tabular-nums figure, label above, colored
   delta pill), PageHeader, DataTable wrapper (sortable columns, matches an
   Odoo-list-view density — compact rows, not oversized card-style rows), Modal/
   Sheet wrapper, StatusBadge (maps our status enums to the color tokens above).

5. Placeholder pages only for each nav item — no real data fetching in this stage.

6. Append "## Frontend Layer — Design System" to DOCUMENTATION.md describing the
   token choices and where each primitive lives.
```

### STAGE F-2 — Auth pages

```
Build /login and /forgot-password pages consuming the Stage B-1 routes. Centered
card layout, white background, primary-orange submit button, role badge shown in
the top bar post-login. Client-side calls the API — no direct Supabase calls from
components, always through our own /api routes so the service layer stays the
single source of truth. Append "## Frontend Layer — Auth" to DOCUMENTATION.md.
```

### STAGE F-3 — Dashboard UI

```
Build the real Dashboard, calling GET /api/dashboard (Stage B-8) via TanStack
Query, with a Supabase Realtime subscription that invalidates the query on any
relevant table change so the five widgets (Daily Sales, Stock Alert, Credit
Reminder, Room Status, Table Status) update live. Render role-appropriate widgets
only — Worker sees Table/Room status only, per what the backend already returns.
Append "## Frontend Layer — Dashboard" to DOCUMENTATION.md.
```

### STAGE F-4 — Inventory & Recipe UI

```
Build the Inventory list (calls GET /api/inventory — cost column simply won't be
present in the response for Worker role, so the UI never needs a role check to
hide it), add/edit/adjust-stock modals, and the recipe builder screen calling the
recipe routes from Stage B-2, showing live-computed cost/profit only when the
response actually contains those fields. Append "## Frontend Layer — Inventory"
to DOCUMENTATION.md.
```

### STAGE F-5 — Quick Sell POS UI

```
Build the POS screen: category-tabbed menu grid on the left/center, running order
rail on the right (qty steppers, discount line gated to Admin+ matching what the
backend already enforces, total). Calls /api/pos routes from Stage B-3. On-screen
receipt view renders from buildReceiptPayload's shape. Void action calls
voidOrderItem. Append "## Frontend Layer — POS" to DOCUMENTATION.md.
```

### STAGE F-6 — Table Booking UI

```
Build the Tables overview (live status grid via Realtime) and the open-table order
screen reusing the POS menu-grid component. Surface TableConflictError from the
backend as a clear "This table was just opened by someone else — refreshing"
message rather than retrying silently. Build move/merge UI calling the
corresponding backend routes. Append "## Frontend Layer — Tables" to
DOCUMENTATION.md.
```

### STAGE F-7 — Room Management UI

```
Build Rooms overview, check-in form, "charge to room" (reusing the POS menu-grid),
and check-out flow calling Stage B-4 routes. Append "## Frontend Layer — Rooms"
to DOCUMENTATION.md.
```

### STAGE F-8 — Credit Ledger UI

```
Build the Credit list, customer passbook-style ledger detail view, record-payment
form, and write-off action (button only rendered/enabled for Admin+, backend
already rejects it otherwise). Append "## Frontend Layer — Credit" to
DOCUMENTATION.md.
```

### STAGE F-9 — Purchases UI

```
Build the purchase entry form and filterable purchase history table, calling
Stage B-6 routes (Worker role won't reach this page at all per middleware).
Append "## Frontend Layer — Purchases" to DOCUMENTATION.md.
```

### STAGE F-10 — Reports UI

```
Build Reports pages consuming Stage B-7 routes: Recharts trend charts + StatCard
figures for each report type, Profit Summary rendered only when the API actually
returns it (Super Admin). Append "## Frontend Layer — Reports" to
DOCUMENTATION.md.
```

### STAGE F-11 — Printing UI (QZ Tray integration)

```
1. Add qz-tray.js client integration: a Settings screen (Admin+) to map logical
   "Kitchen Printer" / "Reception Printer" names to actual QZ Tray-visible printers.

2. Wire KOT firing: the moment a kitchen-category item is added to a POS/table
   order, call buildKotPayload and send it via QZ Tray to the mapped Kitchen
   printer. Wire the Reception receipt to fire once at final billing.

3. Fallback: if QZ Tray isn't connected, show the on-screen printable view instead
   of failing silently, with a visible "Printer bridge not connected" notice.

4. Add the WhatsApp/SMS shareable-receipt link as a secondary option.

5. Document in DOCUMENTATION.md under "## Frontend Layer — Printing" exactly what
   I need to install locally (QZ Tray) and how to map printer names, since this
   part I'll be testing against real hardware myself.
```

---

## PART E — Testing Layer

### STAGE T-1 — Consolidate and fill test coverage gaps

```
Do not open a browser or use any browser-automation tool for this stage — I will
do all UI verification manually myself.

1. Review every service in /src/services and confirm each has Vitest unit test
   coverage for: the happy path, at least one permission-rejection case (wrong
   role), and at least one edge case relevant to that service (insufficient
   stock, concurrent table open, overdue credit, etc.) — fill any gaps left from
   earlier stages.

2. Add integration tests for the API route layer: call route handlers directly
   (not over HTTP, not via a browser) against a disposable test database schema,
   asserting request validation (Zod) rejects malformed input and that each role
   restriction is enforced end-to-end from route to service.

3. Give me the exact command to run the full test suite, and a short coverage
   summary of what is and isn't covered.

4. Append "## Testing Layer" to DOCUMENTATION.md summarizing what's tested, what
   the known gaps are, and the command to run tests.
```

---

## PART F — Deployment Layer

### STAGE X-1 — Production Supabase + Prisma migration

```
1. Give me the exact steps to create a production Supabase project and the exact
   Prisma commands (prisma migrate deploy, and applying the hand-written RLS
   migration) to run against it myself — do not attempt to run these yourself.

2. List every environment variable the app needs in production (Supabase URL/keys,
   DATABASE_URL, DIRECT_URL, RESEND_API_KEY) so I can enter them into Vercel's
   dashboard myself.

3. Append "## Deployment Layer" to DOCUMENTATION.md with the full list of manual
   steps required to go live, including connecting the existing GitHub repo to
   Vercel yourself, and configuring jdsekuwahouse.com.np in Cloudflare (DNS
   records pointing to Vercel, SSL/TLS Full-strict) — walk me through the exact
   records to add and the order, to avoid downtime.

4. Give me a final pre-launch checklist: creating the 5 real user accounts,
   entering real menu items/prices, installing QZ Tray on the till PC(s) and
   mapping printer names, and confirming Realtime works in production, not just
   locally.

Do not push anything to GitHub yourself at any point — repo and deploy connections
are things I handle manually.
```

---

## Notes on how to run this

- Each stage prompt is self-contained — paste one, let it finish, review its `DOCUMENTATION.md` addition and its file diffs yourself, then move to the next.
- The agent never installs packages, runs migrations, seeds data, or pushes to GitHub — every command it would need is instead handed back to you to run and paste the output from.
- Backend stages (Part C) are fully unit-tested before any UI touches them, so by the time you reach Part D you're wiring screens to logic you already trust.