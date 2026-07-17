import "dotenv/config";
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { superuserPrisma } from "../lib/prisma";
import { Role } from "../generated/prisma/client";
import { ForbiddenError } from "../lib/errors";
import {
  listStaffUsers,
  createStaffUser,
  updateStaffUserRole,
  resetStaffUserPassword,
  deleteStaffUser
} from "./users.service";

// Define mock UUIDs
const MOCK_WORKER_UUID = "8c12ef02-1262-43b9-a2ad-86d7cd58b9f1";
const MOCK_ADMIN_UUID = "8c12ef02-1262-43b9-a2ad-86d7cd58b9f2";
const MOCK_SUPER_UUID = "8c12ef02-1262-43b9-a2ad-86d7cd58b9f3";
const MOCK_CREATED_UUID = "8c12ef02-1262-43b9-a2ad-86d7cd58b9f4";

// Mock Supabase admin client to isolate network dependencies
vi.mock("../lib/supabase", () => {
  const mockUsersList = [
    { id: "8c12ef02-1262-43b9-a2ad-86d7cd58b9f1", email: "worker1@example.com", created_at: "2026-07-16T00:00:00.000Z" },
    { id: "8c12ef02-1262-43b9-a2ad-86d7cd58b9f2", email: "admin1@example.com", created_at: "2026-07-16T00:00:00.000Z" },
    { id: "8c12ef02-1262-43b9-a2ad-86d7cd58b9f3", email: "superadmin@example.com", created_at: "2026-07-16T00:00:00.000Z" }
  ];

  return {
    createAdminClient: () => ({
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: mockUsersList },
            error: null
          }),
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: "8c12ef02-1262-43b9-a2ad-86d7cd58b9f4", created_at: "2026-07-16T12:00:00.000Z" } },
            error: null
          }),
          updateUserById: vi.fn().mockImplementation((id: string, attrs: any) => {
            return Promise.resolve({ data: { user: { id } }, error: null });
          }),
          deleteUser: vi.fn().mockResolvedValue({
            data: {},
            error: null
          })
        }
      }
    })
  };
});

describe("Users Administration Service Unit Tests", () => {
  let superAdminId: string;
  let workerId: string;
  let createdProfileId: string | null = null;

  beforeAll(async () => {
    // Retrieve seeded profiles
    const superAdmin = await superuserPrisma.profile.findFirst({
      where: { role: Role.SUPER_ADMIN }
    });
    const worker = await superuserPrisma.profile.findFirst({
      where: { role: Role.WORKER }
    });

    if (!superAdmin || !worker) {
      throw new Error("Seeded profiles not found in database. Run seeding scripts first.");
    }

    superAdminId = superAdmin.id;
    workerId = worker.id;
  });

  afterEach(async () => {
    // Cleanup profiles created during execution
    if (createdProfileId) {
      await superuserPrisma.profile.deleteMany({
        where: { id: createdProfileId }
      });
      createdProfileId = null;
    }
  });

  it("should successfully list staff profiles for SUPER_ADMIN", async () => {
    const list = (await listStaffUsers(superAdminId)) as any[];
    expect(list).toBeDefined();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty("email");
    expect(list[0]).toHaveProperty("role");
  });

  it("should block non-Super-Admin roles from listing staff", async () => {
    await expect(listStaffUsers(workerId)).rejects.toThrow(ForbiddenError);
  });

  it("should successfully create a staff user and database profile for SUPER_ADMIN", async () => {
    const email = "new_staff_member@example.com";
    const userRole = Role.WORKER;

    const res = await createStaffUser(superAdminId, email, "Password123!", userRole);
    expect(res).toBeDefined();
    expect(res.id).toBe(MOCK_CREATED_UUID);
    expect(res.email).toBe(email);
    expect(res.role).toBe(userRole);

    createdProfileId = res.id;

    // Verify it exists in Postgres
    const profile = await superuserPrisma.profile.findUnique({
      where: { id: res.id }
    });
    expect(profile).toBeDefined();
    expect(profile?.role).toBe(userRole);
  });

  it("should block non-Super-Admin roles from creating users", async () => {
    await expect(
      createStaffUser(workerId, "attacker@example.com", "Password123!", Role.WORKER)
    ).rejects.toThrow(ForbiddenError);
  });

  it("should successfully update user roles for SUPER_ADMIN", async () => {
    // Temporarily create target profile in DB
    const targetUserId = MOCK_WORKER_UUID;
    await superuserPrisma.profile.upsert({
      where: { id: targetUserId },
      update: { role: Role.WORKER },
      create: { id: targetUserId, role: Role.WORKER }
    });

    const updated = await updateStaffUserRole(superAdminId, targetUserId, Role.ADMIN);
    expect(updated).toBeDefined();
    expect(updated.role).toBe(Role.ADMIN);

    // Verify Postgres update
    const dbProfile = await superuserPrisma.profile.findUnique({
      where: { id: targetUserId }
    });
    expect(dbProfile?.role).toBe(Role.ADMIN);

    // Cleanup
    await superuserPrisma.profile.delete({ where: { id: targetUserId } });
  });

  it("should block self-role edits and non-Super-Admin updates", async () => {
    await expect(
      updateStaffUserRole(superAdminId, superAdminId, Role.WORKER)
    ).rejects.toThrow(/self-role/i);

    await expect(
      updateStaffUserRole(workerId, "8c12ef02-1262-43b9-a2ad-86d7cd58b9f9", Role.ADMIN)
    ).rejects.toThrow(ForbiddenError);
  });

  it("should successfully reset user passwords", async () => {
    const res = await resetStaffUserPassword(superAdminId, MOCK_WORKER_UUID, "NewPass123!");
    expect(res.success).toBe(true);
  });

  it("should successfully delete a user", async () => {
    const targetUserId = MOCK_WORKER_UUID;
    await superuserPrisma.profile.upsert({
      where: { id: targetUserId },
      update: { role: Role.WORKER },
      create: { id: targetUserId, role: Role.WORKER }
    });

    const res = await deleteStaffUser(superAdminId, targetUserId);
    expect(res.success).toBe(true);

    // Confirm deleted in Postgres
    const profile = await superuserPrisma.profile.findUnique({
      where: { id: targetUserId }
    });
    expect(profile).toBeNull();
  });
});
