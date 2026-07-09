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
