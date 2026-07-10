import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  superuserPrisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient;
let superuserInstance: PrismaClient;

// Restricted Application Client (uses APP_DATABASE_URL if available)
if (process.env.NODE_ENV === "production") {
  const pool = new Pool({ connectionString: process.env.APP_DATABASE_URL || process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  prismaInstance = new PrismaClient({ adapter });
} else {
  if (!globalForPrisma.prisma) {
    const pool = new Pool({ connectionString: process.env.APP_DATABASE_URL || process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  prismaInstance = globalForPrisma.prisma;
}

// Superuser Administrative Client (always uses DATABASE_URL)
if (process.env.NODE_ENV === "production") {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  superuserInstance = new PrismaClient({ adapter });
} else {
  if (!globalForPrisma.superuserPrisma) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    globalForPrisma.superuserPrisma = new PrismaClient({ adapter });
  }
  superuserInstance = globalForPrisma.superuserPrisma;
}

export const prisma = prismaInstance;
export const superuserPrisma = superuserInstance;
