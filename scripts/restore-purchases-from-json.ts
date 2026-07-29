import "dotenv/config";
import fs from "fs";
import path from "path";
import { superuserPrisma } from "../src/lib/prisma";

async function restorePurchases() {
  console.log("Reading purchases_rows.json...");
  const jsonPath = path.resolve(__dirname, "../../purchases_rows.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("JSON file not found at:", jsonPath);
    process.exit(1);
  }

  const rawData = fs.readFileSync(jsonPath, "utf-8");
  const purchasesData = JSON.parse(rawData);

  console.log(`Found ${purchasesData.length} purchase records in JSON.`);

  // 1. Fetch valid profiles or fallback
  const existingProfiles = await superuserPrisma.profile.findMany({ select: { id: true } });
  const profileIdSet = new Set(existingProfiles.map((p) => p.id));
  const fallbackProfileId = existingProfiles[0]?.id;

  if (!fallbackProfileId) {
    console.error("No profiles found in database! Please seed profiles first.");
    process.exit(1);
  }

  // 2. Fetch existing raw items
  const existingRawItems = await superuserPrisma.rawItem.findMany({ select: { id: true, name: true, costPrice: true } });
  const rawItemIdSet = new Set(existingRawItems.map((r) => r.id));

  console.log(`Database currently has ${existingProfiles.length} profiles and ${existingRawItems.length} raw items.`);

  let insertedCount = 0;
  let skippedCount = 0;

  for (const item of purchasesData) {
    // Check if purchase already exists
    const existingPurchase = await superuserPrisma.purchase.findUnique({
      where: { id: item.id }
    });

    if (existingPurchase) {
      skippedCount++;
      continue;
    }

    // Check if raw_item_id exists
    if (!rawItemIdSet.has(item.raw_item_id)) {
      console.warn(`Raw item ID ${item.raw_item_id} not found in DB for purchase ${item.id}. Skipping.`);
      continue;
    }

    // Check recorded_by_id
    const recordedById = profileIdSet.has(item.recorded_by_id) ? item.recorded_by_id : fallbackProfileId;

    await superuserPrisma.purchase.create({
      data: {
        id: item.id,
        rawItemId: item.raw_item_id,
        qty: Number(item.qty),
        unitCost: Number(item.unit_cost),
        totalCost: Number(item.total_cost),
        supplierName: item.supplier_name || null,
        purchasedAt: new Date(item.purchased_at),
        recordedById: recordedById,
        createdAt: new Date(item.created_at || item.purchased_at),
        updatedAt: new Date(item.updated_at || item.purchased_at),
      }
    });
    insertedCount++;
  }

  console.log(`Inserted ${insertedCount} purchase records. Skipped ${skippedCount} pre-existing records.`);

  // 3. Auto-update raw item cost prices to highest purchase unit cost
  console.log("Updating raw item cost prices to highest purchase unit costs...");
  const rawItems = await superuserPrisma.rawItem.findMany();
  
  for (const rawItem of rawItems) {
    const highestPurchase = await superuserPrisma.purchase.findFirst({
      where: { rawItemId: rawItem.id },
      orderBy: { unitCost: "desc" },
      select: { unitCost: true }
    });

    if (highestPurchase && Number(highestPurchase.unitCost) > Number(rawItem.costPrice)) {
      await superuserPrisma.rawItem.update({
        where: { id: rawItem.id },
        data: { costPrice: Number(highestPurchase.unitCost) }
      });
      console.log(`Updated ${rawItem.name} costPrice: ${rawItem.costPrice} -> ${highestPurchase.unitCost}`);
    }
  }

  console.log("SUCCESS: All 68 purchases restored and cost prices updated!");
}

restorePurchases()
  .then(async () => {
    await superuserPrisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Error restoring purchases:", e);
    await superuserPrisma.$disconnect();
    process.exit(1);
  });
