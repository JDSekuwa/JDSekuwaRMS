# JDSekuwaRMS: Developer Run & Troubleshooting Guide

This guide outlines how to reliably run, test, and troubleshoot the JDSekuwaRMS stack.

---

## 1. Daily Workflow (Recommended: Docker)

The application stack consists of three components:
1. **Local PostgreSQL** (`jdsekuwa_db` on host port `5433`)
2. **Supabase Services** (`supabase-envoy`, `supabase-auth`, etc. on host port `8000`)
3. **Next.js App** (`jdsekuwa_app` on host port `3000`)

### Quick Start
To start the entire stack:
```bash
# 1. Ensure Supabase services are running
docker start $(docker ps -a --filter "name=supabase" -q)

# 2. Start PostgreSQL, run migrations, and start the Next.js app
docker compose up -d app
```

### Check Stack Status
```bash
# View all running project containers
docker ps --filter "name=jdsekuwa" --filter "name=supabase"
```

### View Live App Logs
```bash
docker compose logs -f app
```

### Stop the App
```bash
docker compose down
```

---

## 2. Rebuilding After Code Changes

Whenever you modify server-side code, pages, or components that need to be reflected in Docker:

```bash
# Rebuild the app image (uses pinned Node 22 LTS in Docker)
docker compose build app

# Restart the app with the new build
docker compose up -d app
```

If changes do not reflect due to layer caching, force a clean rebuild:
```bash
docker compose build --no-cache app && docker compose up -d app
```

---

## 3. Running Locally on the Host (Without Docker)

If you prefer using `npm run dev` directly on your host machine:

### Prerequisites: Node.js 22 LTS
> **IMPORTANT:** Your host's default node version is `v26.13.0` (experimental). Next.js 16 CLI and native SWC addons fail with process exit / `SIGBUS (code 135)` on Node 26.
> Always switch to Node 22 before running local npm commands:

```bash
# Switch to Node 22 (already installed via nvm)
source ~/.nvm/nvm.sh
nvm use 22

# Ensure PostgreSQL and Supabase are running in Docker
docker start jdsekuwa_db
docker start $(docker ps -a --filter "name=supabase" -q)

# Start Next.js development server
npm run dev
```

---

## 4. Troubleshooting Cheatsheet

### Issue A: `ConnectTimeoutError: host.docker.internal:8000`
* **Symptom:** Login fails, reports fail, or console shows `[cause]: Connect Timeout Error (attempted address: host.docker.internal:8000)`.
* **Cause:** The Supabase container stack (specifically Envoy proxy on port 8000) is stopped.
* **Fix:**
  ```bash
  # Start all Supabase containers
  docker start $(docker ps -a --filter "name=supabase" -q)

  # Verify port 8000 responds
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/auth/v1/health
  # (Expected output: 401 or 200, confirming the proxy is listening)
  ```

---

### Issue B: `npm run dev` exits immediately after 2 seconds
* **Symptom:** Dev server prints `✓ Ready in 280ms` and returns to terminal prompt with exit code 0 or 135.
* **Cause:** Host environment is running experimental Node `v26.13.0`.
* **Fix:**
  ```bash
  source ~/.nvm/nvm.sh
  nvm use 22
  npm run dev
  ```

---

### Issue C: Prisma connection errors during test scripts
* **Symptom:** `Can't reach database server at localhost:5432`.
* **Cause:** Host PostgreSQL is exposed on port **`5433`** (not 5432) to avoid clashing with standard system databases.
* **Fix:** When running CLI scripts with `tsx`, supply `--env-file=.env` so Prisma uses `DIRECT_URL` / `DATABASE_URL` pointing to 5433:
  ```bash
  npx tsx --env-file=.env scripts/test-sales-report.ts
  ```

---

## 5. Running Automated Tests

To test the newly created Monthly Sales Report domain logic, batched queries, and role security:

```bash
npx tsx --env-file=.env scripts/test-sales-report.ts
```

All 5 test suites (1-day, 7-day, 30-day, breakdown sums, and `WORKER` role gate rejection) should pass with:
```
✔ ALL TESTS PASSED SUCCESSFULLY! Clean, type-safe, O(1) performance verified.
```

---

## 6. Default Credentials

| Field | Value |
|---|---|
| **App URL** | [http://localhost:3000](http://localhost:3000) |
| **Admin Email** | `superadmin@example.com` |
| **Password** | `Password123!` |
| **Role** | `SUPER_ADMIN` |
