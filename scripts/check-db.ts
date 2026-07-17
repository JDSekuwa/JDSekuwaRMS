import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== RESTAURANT TABLES ===");
  const tables = await prisma.restaurantTable.findMany({});
  for (const t of tables) {
    console.log(`Table ID: ${t.id} | Name: ${t.name} | Status: ${t.status} | Current Tag: ${t.currentTag}`);
  }

  console.log("\n=== ALL TABLE ORDERS ===");
  const orders = await prisma.tableOrder.findMany({
    include: {
      table: true,
      items: { include: { menuItem: true } }
    }
  });
  console.log(`Total orders: ${orders.length}`);
  for (const o of orders) {
    console.log(`Order ID: ${o.id} | Table Name: ${o.table.name} | Status: ${o.status}`);
    console.log(`  Items:`, o.items.map(i => `${i.menuItem.name} x ${i.qty}`));
  }
}

main()
  .then(() => pool.end())
  .catch(console.error);
