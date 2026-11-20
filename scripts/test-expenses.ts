import { superuserPrisma } from "../src/lib/prisma";
import { Role, PaymentType } from "../src/generated/prisma/client";
import {
  listExpenseCategories,
  createExpenseCategory,
  deleteExpenseCategory,
  createExpense,
  getExpenseById,
  updateExpense,
  deleteExpense,
  listExpenses,
} from "../src/services/expense.service";
import { getSalesReport } from "../src/services/reports.service";

async function main() {
  console.log("=== STARTING EXPENSES INTEGRATION TEST ===");

  // 1. Find or create an admin profile for testing
  let adminProfile = await superuserPrisma.profile.findFirst({
    where: { role: { in: [Role.SUPER_ADMIN, Role.ADMIN] } },
  });

  if (!adminProfile) {
    console.log("No admin found, creating a test super admin profile...");
    adminProfile = await superuserPrisma.profile.create({
      data: {
        id: "test-admin-uuid-" + Date.now(),
        username: "test_admin",
        role: Role.SUPER_ADMIN,
        isActive: true,
      },
    });
  }
  console.log(`Using admin profile: ${adminProfile.username} (${adminProfile.id}) [${adminProfile.role}]`);

  // 2. Test Category Auto-seed & Listing
  const categories = await listExpenseCategories();
  console.log(`Categories listed successfully: ${categories.length} categories found.`);
  if (categories.length === 0) {
    throw new Error("Expected at least seeded default categories!");
  }

  // 3. Test Custom Category Creation
  const testCatName = `Test Hardware Cat ${Date.now()}`;
  const customCat = await createExpenseCategory(testCatName, "Test Description for wires & tools", adminProfile.id);
  console.log(`Created custom category: "${customCat.name}" with ID: ${customCat.id}`);

  // 4. Test Expense Creation
  const todayStr = new Date().toISOString().split("T")[0];
  const expense = await createExpense(
    {
      title: "Electrical Wire 2.5mm roll",
      categoryId: customCat.id,
      amount: 1550.5,
      date: todayStr,
      paymentType: PaymentType.CASH,
      vendor: "Bhandari Hardware",
      notes: "Room 102 repair",
    },
    adminProfile.id
  );
  console.log(`Created expense: "${expense.title}" - Rs. ${expense.amount} (ID: ${expense.id})`);

  // 5. Test Expense Retrieval
  const fetched = await getExpenseById(expense.id, adminProfile.id);
  if (!fetched || fetched.title !== "Electrical Wire 2.5mm roll") {
    throw new Error("Failed to fetch created expense by ID");
  }
  console.log(`Fetched expense by ID: verified title matches "${fetched.title}"`);

  // 6. Test Expense Listing with Filters
  const { expenses: listData, total, totalAmount } = await listExpenses(
    {
      categoryId: customCat.id,
      startDate: todayStr,
      endDate: todayStr,
      search: "Wire",
      take: 10,
    },
    adminProfile.id
  );
  console.log(`List expenses filtered by category and search: found ${listData.length} items (Total amount: Rs. ${totalAmount})`);
  if (listData.length === 0 || totalAmount !== 1550.5) {
    throw new Error("Expense filter check failed!");
  }

  // 7. Verify Operational Expenses are isolated from getSalesReport()
  const salesReport = await getSalesReport(
    {
      start: new Date(todayStr),
      end: new Date(todayStr),
    },
    adminProfile.id
  );
  console.log("Sales Report Summary (isolated from operational expenses):");
  console.log(`- Gross Total Sales: Rs. ${salesReport.summary.totalSales}`);
  console.log(`- Purchase Expenses: Rs. ${salesReport.summary.purchaseExpenses}`);
  console.log(`- Operational Expenses: Rs. ${salesReport.summary.operationalExpenses}`);
  console.log(`- Total Expenses: Rs. ${salesReport.summary.totalExpenses}`);
  console.log(`- Net Profit: Rs. ${salesReport.summary.netProfit}`);

  if (salesReport.summary.operationalExpenses !== 0) {
    throw new Error(`Expected operationalExpenses === 0 in sales report, got ${salesReport.summary.operationalExpenses}`);
  }

  // 8. Test Expense Update
  const updated = await updateExpense(
    expense.id,
    {
      amount: 1700,
      notes: "Updated note: includes socket switches",
    },
    adminProfile.id
  );
  console.log(`Updated expense amount to Rs. ${updated.amount}, notes: "${updated.notes}"`);
  if (Number(updated.amount) !== 1700) {
    throw new Error("Update amount failed");
  }

  // 9. Test Expense Deletion
  const deleteResult = await deleteExpense(expense.id, adminProfile.id);
  console.log(`Deleted expense: ${deleteResult.id}`);

  // 10. Test Category Deletion
  const deletedCat = await deleteExpenseCategory(customCat.id, adminProfile.id);
  console.log(`Deleted custom category: ${deletedCat.name}`);

  // 11. Test Worker Role Rejection (ForbiddenError)
  let workerProfile = await superuserPrisma.profile.findFirst({
    where: { role: Role.WORKER },
  });
  if (!workerProfile) {
    workerProfile = await superuserPrisma.profile.create({
      data: {
        id: "test-worker-uuid-" + Date.now(),
        username: "test_worker",
        role: Role.WORKER,
        isActive: true,
      },
    });
  }

  try {
    await createExpense(
      {
        title: "Unauthorized expense",
        categoryId: categories[0].id,
        amount: 100,
      },
      workerProfile.id
    );
    throw new Error("Expected ForbiddenError for WORKER role, but succeeded!");
  } catch (err: any) {
    if (err.name === "ForbiddenError" || err.message.includes("Only Admins and Super Admins")) {
      console.log("Worker role rejection verified: ForbiddenError correctly thrown.");
    } else {
      throw err;
    }
  }

  // Cleanup test profiles if created
  if (adminProfile.username === "test_admin") {
    await superuserPrisma.profile.delete({ where: { id: adminProfile.id } }).catch(() => {});
  }
  if (workerProfile.username === "test_worker") {
    await superuserPrisma.profile.delete({ where: { id: workerProfile.id } }).catch(() => {});
  }

  console.log("=== ALL EXPENSES INTEGRATION TESTS PASSED SUCCESSFULLY ===");
}

main()
  .catch((e) => {
    console.error("Test failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await superuserPrisma.$disconnect();
  });
