process.loadEnvFile?.(".env");
import { superuserPrisma, prisma } from "../src/lib/prisma";
import {
  openTableOrder,
  addItemsToTableOrder,
  closeTableOrder,
  mergeTableOrders,
} from "../src/services/sales.service";
import {
  getTableOrderHistory,
  getTableOrderHistoryDetail,
} from "../src/services/tables.service";
import {
  TableStatus,
  TableOrderStatus,
  PaymentType,
  Role,
  CreditSource,
  Unit,
} from "../src/generated/prisma/client";

async function runTests() {
  console.log("=== PHASE 5 VERIFICATION SUITE ===\n");

  // 1. Setup Test Fixtures (Worker profile, tables, menu item)
  console.log("1. Setting up test fixtures...");

  // Ensure worker profile exists
  let worker = await superuserPrisma.profile.findFirst({
    where: { role: Role.WORKER },
  });
  if (!worker) {
    worker = await superuserPrisma.profile.create({
      data: {
        id: "a0000000-0000-0000-0000-000000000001",
        role: Role.WORKER,
      },
    });
  }

  // Ensure admin profile exists
  let admin = await superuserPrisma.profile.findFirst({
    where: { role: Role.SUPER_ADMIN },
  });
  if (!admin) {
    admin = await superuserPrisma.profile.create({
      data: {
        id: "a0000000-0000-0000-0000-000000000002",
        role: Role.SUPER_ADMIN,
      },
    });
  }

  // Ensure tables exist and are vacant
  const tableNames = ["Test Table 1", "Test Table 2", "Test Table 3", "Test Table 4"];
  const tables: Record<string, string> = {};

  for (const name of tableNames) {
    let t = await superuserPrisma.restaurantTable.findUnique({ where: { name } });
    if (!t) {
      t = await superuserPrisma.restaurantTable.create({
        data: { name, status: TableStatus.VACANT, version: 1 },
      });
    } else {
      t = await superuserPrisma.restaurantTable.update({
        where: { id: t.id },
        data: { status: TableStatus.VACANT, currentTag: null, version: { increment: 1 } },
      });
    }
    tables[name] = t.id;
  }

  // Ensure category and menu item exist
  let category = await superuserPrisma.menuCategory.findFirst();
  if (!category) {
    category = await superuserPrisma.menuCategory.create({
      data: { name: "Sekuwa Special" },
    });
  }

  let menuItem1 = await superuserPrisma.menuItem.findFirst({
    where: { name: "Pork Sekuwa" },
  });
  if (!menuItem1) {
    menuItem1 = await superuserPrisma.menuItem.create({
      data: {
        name: "Pork Sekuwa",
        price: 350.0,
        categoryId: category.id,
      },
    });
  }

  let menuItem2 = await superuserPrisma.menuItem.findFirst({
    where: { name: "Buff Sekuwa" },
  });
  if (!menuItem2) {
    menuItem2 = await superuserPrisma.menuItem.create({
      data: {
        name: "Buff Sekuwa",
        price: 300.0,
        categoryId: category.id,
      },
    });
  }

  console.log("   Test fixtures ready.\n");

  // =========================================================================
  // SCENARIO 1: Open a table, add two rounds, close with Cash.
  // =========================================================================
  console.log("--- SCENARIO 1: Open table, add two rounds, close with cash ---");
  const t1Id = tables["Test Table 1"];

  const order1 = await openTableOrder(t1Id, "Evening Session", worker.id, {
    customerName: "Suman Shrestha",
    customerPhone: "9841234567",
  });
  console.log(`   Order opened: ID=${order1.id}`);
  if (order1.customerName !== "Suman Shrestha" || order1.customerPhone !== "9841234567") {
    throw new Error(`Scenario 1 Failed: Customer info not saved on open. Got name=${order1.customerName}, phone=${order1.customerPhone}`);
  }

  // Add Round 1
  const round1Items = await addItemsToTableOrder(
    order1.id,
    [{ menuItemId: menuItem1.id, qty: 2 }],
    worker.id
  );
  console.log(`   Round 1 added: ${round1Items.length} items (Round #${round1Items[0].round})`);
  if (round1Items[0].round !== 1) {
    throw new Error(`Scenario 1 Failed: Expected Round 1, got ${round1Items[0].round}`);
  }

  // Add Round 2
  const round2Items = await addItemsToTableOrder(
    order1.id,
    [{ menuItemId: menuItem2.id, qty: 1 }],
    worker.id
  );
  console.log(`   Round 2 added: ${round2Items.length} items (Round #${round2Items[0].round})`);
  if (round2Items[0].round !== 2) {
    throw new Error(`Scenario 1 Failed: Expected Round 2, got ${round2Items[0].round}`);
  }

  // Close order with Cash
  await closeTableOrder(order1.id, worker.id, PaymentType.CASH, 0);
  console.log("   Order closed with CASH payment.");

  // Verify History
  const history1 = await getTableOrderHistory({ tableId: t1Id });
  const foundVisit1 = history1.visits.find((v) => v.id === order1.id);
  if (!foundVisit1) throw new Error("Scenario 1 Failed: Order not in history");
  if (foundVisit1.customer.name !== "Suman Shrestha") {
    throw new Error(`Scenario 1 Failed: Customer name mismatch: ${foundVisit1.customer.name}`);
  }
  if (foundVisit1.paymentType !== "CASH") {
    throw new Error(`Scenario 1 Failed: Payment type mismatch: ${foundVisit1.paymentType}`);
  }
  console.log(`   History list check PASSED: Customer=${foundVisit1.customer.name}, Total=${foundVisit1.totals.total}`);

  // Verify History Detail
  const detail1 = await getTableOrderHistoryDetail(order1.id);
  if (!detail1) throw new Error("Scenario 1 Failed: Detail returned null");
  if (detail1.rounds.length !== 2) {
    throw new Error(`Scenario 1 Failed: Expected 2 rounds, got ${detail1.rounds.length}`);
  }
  console.log(`   History detail check PASSED: Found ${detail1.rounds.length} rounds:`);
  detail1.rounds.forEach((r) => {
    console.log(`     - ${r.roundLabel}: ${r.items.map((i) => `${i.item} (x${i.qty}, Rs.${i.lineTotal})`).join(", ")}`);
  });
  console.log("✔ SCENARIO 1 PASSED!\n");

  // =========================================================================
  // SCENARIO 2: Credit Sale with Customer Info
  // =========================================================================
  console.log("--- SCENARIO 2: Credit sale with customer info ---");
  const t2Id = tables["Test Table 2"];

  const order2 = await openTableOrder(t2Id, "Tag Corner", worker.id);
  console.log(`   Order opened: ID=${order2.id}, Tag copied as name=${order2.customerName}`);

  // Add items
  await addItemsToTableOrder(
    order2.id,
    [{ menuItemId: menuItem1.id, qty: 1 }],
    worker.id
  );

  // Close with CREDIT
  await closeTableOrder(order2.id, worker.id, PaymentType.CREDIT, 0, {
    customerName: "Rabin Thapa",
    phone: "9801122334",
  });
  console.log("   Order closed on CREDIT for Rabin Thapa.");

  // Verify Credit Ledger
  const creditEntry = await superuserPrisma.creditLedger.findFirst({
    where: { sourceId: order2.id },
  });
  if (!creditEntry) throw new Error("Scenario 2 Failed: Credit ledger entry missing");
  console.log(`   CreditLedger verified: Customer=${creditEntry.customerName}, Amount=Rs.${creditEntry.amount}`);

  // Verify History Detail
  const detail2 = await getTableOrderHistoryDetail(order2.id);
  if (!detail2) throw new Error("Scenario 2 Failed: Detail returned null");
  if (detail2.customer.name !== "Rabin Thapa") {
    throw new Error(`Scenario 2 Failed: Customer name not updated at checkout. Got ${detail2.customer.name}`);
  }
  if (detail2.paymentType !== "CREDIT") {
    throw new Error(`Scenario 2 Failed: Payment type should be CREDIT, got ${detail2.paymentType}`);
  }
  console.log("✔ SCENARIO 2 PASSED!\n");

  // =========================================================================
  // SCENARIO 3: Legacy visit with null round fallback
  // =========================================================================
  console.log("--- SCENARIO 3: Legacy visit with null round fallback ---");
  const t3Id = tables["Test Table 3"];

  // Insert closed order directly simulating pre-migration row
  const legacyOrder = await superuserPrisma.tableOrder.create({
    data: {
      tableId: t3Id,
      status: TableOrderStatus.CLOSED,
      customerName: "Legacy Guest",
      customerPhone: "9811000000",
      openedById: worker.id,
      paymentType: PaymentType.CASH,
      subtotal: 1000,
      discount: 0,
      total: 1000,
      openedAt: new Date(Date.now() - 3600000),
      closedAt: new Date(Date.now() - 1800000),
    },
  });

  // Insert items with round: null at 2 different minute clusters (10 mins apart)
  const time1 = new Date(Date.now() - 3500000);
  const time2 = new Date(Date.now() - 2900000);

  await superuserPrisma.orderItem.create({
    data: {
      tableOrderId: legacyOrder.id,
      menuItemId: menuItem1.id,
      qty: 2,
      unitPrice: 350,
      round: null, // explicitly null
      createdAt: time1,
    },
  });

  await superuserPrisma.orderItem.create({
    data: {
      tableOrderId: legacyOrder.id,
      menuItemId: menuItem2.id,
      qty: 1,
      unitPrice: 300,
      round: null, // explicitly null
      createdAt: time2,
    },
  });

  const detail3 = await getTableOrderHistoryDetail(legacyOrder.id);
  if (!detail3) throw new Error("Scenario 3 Failed: Legacy detail returned null");
  if (detail3.rounds.length !== 2) {
    throw new Error(`Scenario 3 Failed: Expected minute fallback to produce 2 rounds, got ${detail3.rounds.length}`);
  }
  console.log(`   Legacy detail fallback PASSED: Grouped ${detail3.rounds.length} rounds via minute clustering:`);
  detail3.rounds.forEach((r) => {
    console.log(`     - ${r.roundLabel}: ${r.items.map((i) => i.item).join(", ")}`);
  });
  console.log("✔ SCENARIO 3 PASSED!\n");

  // =========================================================================
  // SCENARIO 4: Merged tables & round collision prevention
  // =========================================================================
  console.log("--- SCENARIO 4: Merged tables and round collision prevention ---");
  const tSourceId = tables["Test Table 3"];
  const tTargetId = tables["Test Table 4"];

  // Open Source Table & add 2 rounds
  const sourceOrder = await openTableOrder(tSourceId, "Source Party", worker.id);
  await addItemsToTableOrder(sourceOrder.id, [{ menuItemId: menuItem1.id, qty: 1 }], worker.id); // Round 1
  await addItemsToTableOrder(sourceOrder.id, [{ menuItemId: menuItem1.id, qty: 2 }], worker.id); // Round 2

  // Open Target Table & add 1 round
  const targetOrder = await openTableOrder(tTargetId, "Target Party", worker.id);
  await addItemsToTableOrder(targetOrder.id, [{ menuItemId: menuItem2.id, qty: 3 }], worker.id); // Round 1

  console.log(`   Source Order #${sourceOrder.id} has 2 rounds.`);
  console.log(`   Target Order #${targetOrder.id} has 1 round.`);

  // Merge Source into Target
  console.log("   Merging Source into Target...");
  await mergeTableOrders(sourceOrder.id, targetOrder.id, worker.id);

  // Check moved items rounds on Target
  const targetItems = await superuserPrisma.orderItem.findMany({
    where: { tableOrderId: targetOrder.id, isVoid: false },
    orderBy: { round: "asc" },
  });

  const distinctRounds = Array.from(new Set(targetItems.map((i) => i.round)));
  console.log(`   Target Order now has distinct rounds: ${distinctRounds.join(", ")}`);
  if (distinctRounds.length !== 3) {
    throw new Error(`Scenario 4 Failed: Expected 3 distinct rounds [1, 2, 3], got ${distinctRounds.join(", ")}`);
  }
  if (distinctRounds[0] !== 1 || distinctRounds[1] !== 2 || distinctRounds[2] !== 3) {
    throw new Error(`Scenario 4 Failed: Collision detected! Rounds are not sequential: ${distinctRounds.join(", ")}`);
  }

  // Close Target order
  await closeTableOrder(targetOrder.id, worker.id, PaymentType.CASH, 0);

  // Verify History detail of Target Order
  const detail4 = await getTableOrderHistoryDetail(targetOrder.id);
  if (!detail4) throw new Error("Scenario 4 Failed: Detail returned null");
  if (detail4.rounds.length !== 3) {
    throw new Error(`Scenario 4 Failed: Expected 3 rounds in history, got ${detail4.rounds.length}`);
  }
  console.log(`   Merged history check PASSED:`);
  detail4.rounds.forEach((r) => {
    console.log(`     - ${r.roundLabel}: ${r.items.map((i) => `${i.item} (x${i.qty})`).join(", ")}`);
  });
  console.log("✔ SCENARIO 4 PASSED!\n");

  console.log("==========================================");
  console.log("ALL 4 SCENARIOS PASSED SUCCESSFULLY!");
  console.log("==========================================");
}

runTests()
  .catch((err) => {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await superuserPrisma.$disconnect();
    await prisma.$disconnect();
  });
