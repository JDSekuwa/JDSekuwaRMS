import "dotenv/config";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createAdminClient } from "../src/lib/supabase";

// Initialize a superuser Prisma Client for administrative writes
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const supabase = createAdminClient();

const USERS_TO_SEED = [
  { email: "superadmin@example.com", role: Role.SUPER_ADMIN },
  { email: "admin1@example.com", role: Role.ADMIN },
  { email: "admin2@example.com", role: Role.ADMIN },
  { email: "worker1@example.com", role: Role.WORKER },
  { email: "worker2@example.com", role: Role.WORKER },
];

const DEFAULT_PASSWORD = "Password123!";

async function main() {
  console.log("Cleaning up existing profiles and auth users...");

  // Fetch all existing profiles
  const existingProfiles = await prisma.profile.findMany();
  for (const profile of existingProfiles) {
    console.log(`Deleting Auth user: ${profile.id}`);
    const { error } = await supabase.auth.admin.deleteUser(profile.id);
    if (error) {
      console.warn(`Warning: Could not delete Auth user ${profile.id}: ${error.message}`);
    }
  }

  // Delete matching database profiles (cascade deletes audit logs, etc.)
  await prisma.profile.deleteMany({});
  console.log("Cleanup completed.");

  console.log("Seeding profiles and users...");
  for (const userSpec of USERS_TO_SEED) {
    console.log(`Creating Auth user for ${userSpec.email} as ${userSpec.role}...`);
    
    // Create the user in Supabase Auth using the Admin API
    const { data: { user }, error } = await supabase.auth.admin.createUser({
      email: userSpec.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      app_metadata: { role: userSpec.role },
      user_metadata: { role: userSpec.role }, // populated in both for safety
    });

    if (error || !user) {
      throw new Error(`Failed to create Auth user: ${error?.message || "Unknown error"}`);
    }

    console.log(`Auth user created successfully with ID: ${user.id}`);

    // Create the matching Profile row in PostgreSQL
    await prisma.profile.create({
      data: {
        id: user.id,
        role: userSpec.role,
      },
    });
    console.log(`Database profile created for ${userSpec.email}.`);
  }

  console.log("Profiles seeding completed successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error("Seeding profiles failed:", e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
