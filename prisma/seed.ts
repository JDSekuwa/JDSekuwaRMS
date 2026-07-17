import "dotenv/config";
import { TableStatus, RoomStatus, Unit } from "../src/generated/prisma/client";
import { superuserPrisma as prisma } from "../src/lib/prisma";

async function main() {
  console.log("Cleaning up database...");

  // Delete in reverse order of dependencies to avoid foreign key violations
  await prisma.recipeLine.deleteMany({});
  await prisma.recipe.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.menuCategory.deleteMany({});
  await prisma.rawItem.deleteMany({});
  await prisma.restaurantTable.deleteMany({});
  await prisma.roomStay.deleteMany({});
  await prisma.room.deleteMany({});

  console.log("Seeding tables...");
  const tables = [];
  for (let i = 1; i <= 8; i++) {
    const table = await prisma.restaurantTable.create({
      data: {
        name: `Table ${i}`,
        status: TableStatus.VACANT,
        version: 1,
      },
    });
    tables.push(table);
  }
  console.log(`Created ${tables.length} tables.`);

  console.log("Seeding rooms...");
  const room1 = await prisma.room.create({
    data: {
      name: "Room 101",
      nightlyRate: 2500.00,
      status: RoomStatus.VACANT,
    },
  });
  const room2 = await prisma.room.create({
    data: {
      name: "Room 102",
      nightlyRate: 3500.00,
      status: RoomStatus.VACANT,
    },
  });
  console.log(`Created rooms: ${room1.name}, ${room2.name}`);

  console.log("Seeding menu categories...");
  const catSekuwa = await prisma.menuCategory.create({
    data: { name: "Sekuwa Special", isKitchen: true },
  });
  const catStarters = await prisma.menuCategory.create({
    data: { name: "Starters", isKitchen: true },
  });
  const catRiceRoti = await prisma.menuCategory.create({
    data: { name: "Rice & Roti", isKitchen: true },
  });
  const catDrinks = await prisma.menuCategory.create({
    data: { name: "Drinks", isKitchen: false },
  });
  const catCigarettes = await prisma.menuCategory.create({
    data: { name: "Cigarettes", isKitchen: false },
  });
  const catDesserts = await prisma.menuCategory.create({
    data: { name: "Desserts", isKitchen: false },
  });
  console.log("Seeded 6 menu categories.");

  console.log("Seeding raw inventory items...");
  const rawPork = await prisma.rawItem.create({
    data: {
      name: "Pork Meat",
      unit: Unit.KG,
      currentStock: 15.000,
      minThreshold: 5.000,
      costPrice: 650.00,
    },
  });
  const rawSpiceMix = await prisma.rawItem.create({
    data: {
      name: "House Sekuwa Spice Mix",
      unit: Unit.KG,
      currentStock: 5.000,
      minThreshold: 1.500,
      costPrice: 400.00,
    },
  });
  const rawChicken = await prisma.rawItem.create({
    data: {
      name: "Chicken Meat",
      unit: Unit.KG,
      currentStock: 20.000,
      minThreshold: 6.000,
      costPrice: 450.00,
    },
  });
  const rawMutton = await prisma.rawItem.create({
    data: {
      name: "Mutton Meat",
      unit: Unit.KG,
      currentStock: 10.000,
      minThreshold: 3.000,
      costPrice: 1100.00,
    },
  });
  const rawPeanut = await prisma.rawItem.create({
    data: {
      name: "Raw Peanuts",
      unit: Unit.KG,
      currentStock: 8.000,
      minThreshold: 2.000,
      costPrice: 220.00,
    },
  });
  const rawPotato = await prisma.rawItem.create({
    data: {
      name: "Potatoes",
      unit: Unit.KG,
      currentStock: 50.000,
      minThreshold: 15.000,
      costPrice: 60.00,
    },
  });
  console.log("Seeded raw inventory items.");

  console.log("Seeding menu items...");
  // Sekuwa
  const porkSekuwa = await prisma.menuItem.create({
    data: { name: "Pork Sekuwa (Plate)", price: 450.00, categoryId: catSekuwa.id },
  });
  const chickenSekuwa = await prisma.menuItem.create({
    data: { name: "Chicken Sekuwa (Plate)", price: 400.00, categoryId: catSekuwa.id },
  });
  const muttonSekuwa = await prisma.menuItem.create({
    data: { name: "Mutton Sekuwa (Plate)", price: 650.00, categoryId: catSekuwa.id },
  });

  // Starters
  await prisma.menuItem.create({
    data: { name: "Peanut Sandheko", price: 220.00, categoryId: catStarters.id },
  });
  await prisma.menuItem.create({
    data: { name: "French Fries", price: 180.00, categoryId: catStarters.id },
  });
  await prisma.menuItem.create({
    data: { name: "Chicken Chilli", price: 380.00, categoryId: catStarters.id },
  });

  // Rice & Roti
  await prisma.menuItem.create({
    data: { name: "Plain Rice", price: 120.00, categoryId: catRiceRoti.id },
  });
  await prisma.menuItem.create({
    data: { name: "Jeera Rice", price: 170.00, categoryId: catRiceRoti.id },
  });
  await prisma.menuItem.create({
    data: { name: "Butter Roti", price: 40.00, categoryId: catRiceRoti.id },
  });

  // Drinks
  await prisma.menuItem.create({
    data: { name: "Mineral Water (1L)", price: 50.00, categoryId: catDrinks.id },
  });
  await prisma.menuItem.create({
    data: { name: "Coca Cola (250ml)", price: 90.00, categoryId: catDrinks.id },
  });
  await prisma.menuItem.create({
    data: { name: "Nepal Ice Beer (650ml)", price: 480.00, categoryId: catDrinks.id },
  });

  // Cigarettes
  await prisma.menuItem.create({
    data: { name: "Surya Legend (20s)", price: 380.00, categoryId: catCigarettes.id },
  });
  await prisma.menuItem.create({
    data: { name: "Surya Red (20s)", price: 380.00, categoryId: catCigarettes.id },
  });

  // Desserts
  await prisma.menuItem.create({
    data: { name: "Vanilla Ice Cream", price: 130.00, categoryId: catDesserts.id },
  });
  console.log("Seeded 15 menu items.");

  console.log("Seeding recipe for Pork Sekuwa (Plate)...");
  // 1 plate = 0.333 kg (333g) Pork Meat + 0.050 kg (50g) Spice Mix
  const porkRecipe = await prisma.recipe.create({
    data: {
      menuItemId: porkSekuwa.id,
    },
  });

  await prisma.recipeLine.create({
    data: {
      recipeId: porkRecipe.id,
      rawItemId: rawPork.id,
      qtyPerUnit: 0.333,
    },
  });

  await prisma.recipeLine.create({
    data: {
      recipeId: porkRecipe.id,
      rawItemId: rawSpiceMix.id,
      qtyPerUnit: 0.050,
    },
  });

  console.log("Recipe for Pork Sekuwa seeded successfully!");
  console.log("Database seeding completed!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
