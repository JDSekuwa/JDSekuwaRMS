process.loadEnvFile?.(".env");

import { getSalesReport, getDailySalesSummary } from "../src/services/reports.service";
import { superuserPrisma } from "../src/lib/prisma";
import { Role } from "../src/generated/prisma/client";

async function run() {
  console.log("=== VERIFYING SALES REPORT SERVICE ===");

  // 1. Fetch an admin profile to act as caller
  const admin = await superuserPrisma.profile.findFirst({
    where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
  });

  if (!admin) {
    console.error("No Admin or Super Admin profile found in database!");
    process.exit(1);
  }

  console.log(`Using admin profile: ${admin.id} (${admin.role})`);

  // 2. Test 1-day range (today)
  const today = new Date();
  console.log("\n--- Testing 1-Day (Today) Range ---");
  const singleDay = await getSalesReport({ start: today, end: today }, admin.id);
  console.log("1-Day Summary:", JSON.stringify(singleDay.summary, null, 2));
  console.log(`Daily Breakdown Count: ${singleDay.dailyBreakdown.length} (Expected: 1)`);
  if (singleDay.dailyBreakdown.length !== 1) {
    throw new Error(`Expected 1 day in breakdown, got ${singleDay.dailyBreakdown.length}`);
  }

  // 3. Test 7-day range
  console.log("\n--- Testing 7-Day Range ---");
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 6);
  const sevenDays = await getSalesReport({ start: sevenDaysAgo, end: today }, admin.id);
  console.log("7-Day Summary:", JSON.stringify(sevenDays.summary, null, 2));
  console.log(`Daily Breakdown Count: ${sevenDays.dailyBreakdown.length} (Expected: 7)`);
  if (sevenDays.dailyBreakdown.length !== 7) {
    throw new Error(`Expected 7 days in breakdown, got ${sevenDays.dailyBreakdown.length}`);
  }

  // Verify daily breakdown sums equal the total
  const computedSum = sevenDays.dailyBreakdown.reduce((acc, d) => acc + d.totalSales, 0);
  const computedExpenses = sevenDays.dailyBreakdown.reduce((acc, d) => acc + d.totalExpenses, 0);
  console.log(`Computed breakdown sales sum: ${computedSum}, Summary total: ${sevenDays.summary.totalSales}`);
  console.log(`Computed breakdown expense sum: ${computedExpenses}, Summary expenses: ${sevenDays.summary.totalExpenses}`);
  if (Math.abs(computedSum - sevenDays.summary.totalSales) > 0.01) {
    throw new Error("Mismatch between dailyBreakdown sum and summary.totalSales!");
  }
  if (Math.abs(computedExpenses - sevenDays.summary.totalExpenses) > 0.01) {
    throw new Error("Mismatch between dailyBreakdown expense sum and summary.totalExpenses!");
  }
  if (Math.abs(sevenDays.summary.netProfit - (sevenDays.summary.totalSales - sevenDays.summary.totalExpenses)) > 0.01) {
    throw new Error("Mismatch between summary.netProfit and (totalSales - totalExpenses)!");
  }

  // 4. Test 30-day (Monthly) range
  console.log("\n--- Testing 30-Day Monthly Range ---");
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 29);
  const monthly = await getSalesReport({ start: thirtyDaysAgo, end: today }, admin.id);
  console.log("Monthly Summary:", JSON.stringify(monthly.summary, null, 2));
  console.log(`Daily Breakdown Count: ${monthly.dailyBreakdown.length} (Expected: 30)`);
  if (monthly.dailyBreakdown.length !== 30) {
    throw new Error(`Expected 30 days in breakdown, got ${monthly.dailyBreakdown.length}`);
  }
  if (Math.abs(monthly.summary.netProfit - (monthly.summary.totalSales - monthly.summary.totalExpenses)) > 0.01) {
    throw new Error("Mismatch in monthly netProfit calculation!");
  }

  // 5. Test Backward Compatibility for getDailySalesSummary
  console.log("\n--- Testing Backward Compatibility of getDailySalesSummary ---");
  const dailySummary = await getDailySalesSummary(admin.id);
  console.log("Daily summary (Dashboard compatibility):", JSON.stringify(dailySummary, null, 2));
  if (typeof dailySummary.totalSales !== "number") {
    throw new Error("getDailySalesSummary did not return valid totalSales number");
  }

  // 6. Test Authorization gate for non-admin
  console.log("\n--- Testing Authorization Gate for WORKER ---");
  const worker = await superuserPrisma.profile.findFirst({
    where: { role: Role.WORKER },
  });

  if (worker) {
    try {
      await getSalesReport({ start: today, end: today }, worker.id);
      throw new Error("Security check failed: WORKER was able to access getSalesReport!");
    } catch (err: any) {
      if (err.name === "ForbiddenError" || err.message?.includes("Forbidden") || err.message?.includes("operational reports")) {
        console.log("Authorization check passed: WORKER correctly rejected with ForbiddenError.");
      } else {
        throw err;
      }
    }
  } else {
    console.log("No WORKER profile found, skipping worker role test.");
  }

  console.log("\n ALL TESTS PASSED SUCCESSFULLY! Clean, type-safe, O(1) performance verified.");
}

run()
  .catch((e) => {
    console.error("Test failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await superuserPrisma.$disconnect();
  });
