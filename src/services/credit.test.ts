import "dotenv/config";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { prisma, superuserPrisma } from "../lib/prisma";
import {
  listCreditCustomers,
  getCustomerLedger,
  recordPayment,
  writeOff,
  getCustomerCreditLookup,
  CreditCustomerSummary
} from "./credit.service";
import { Role, CreditStatus, CreditSource } from "../generated/prisma/client";
import { ForbiddenError } from "../lib/errors";

describe("Credit Ledger Service Integration Tests (Stage B-5)", () => {
  let workerId: string;
  let adminId: string;
  const testPhone = "9998887770";

  beforeAll(async () => {
    // Fetch test profiles
    const worker = await superuserPrisma.profile.findFirst({ where: { role: Role.WORKER } });
    const admin = await superuserPrisma.profile.findFirst({ where: { role: Role.SUPER_ADMIN } });
    if (!worker || !admin) {
      throw new Error("Seeded profiles not found. Run seed-profiles.ts first.");
    }
    workerId = worker.id;
    adminId = admin.id;
  });

  afterEach(async () => {
    // Clean up all test credit entries and payments
    const ledgers = await superuserPrisma.creditLedger.findMany({
      where: { phone: testPhone }
    });
    for (const ledger of ledgers) {
      await superuserPrisma.creditPayment.deleteMany({ where: { creditLedgerId: ledger.id } });
      await superuserPrisma.creditLedger.delete({ where: { id: ledger.id } });
    }
  });

  it("should flag a customer as overdue if any active ledger entry is past its due date", async () => {
    // Create an overdue ledger entry
    await superuserPrisma.creditLedger.create({
      data: {
        customerName: "Overdue Customer",
        phone: testPhone,
        source: CreditSource.QUICK_SELL,
        sourceId: "00000000-0000-0000-0000-000000000001",
        amount: 250.00,
        givenDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),   // 1 day ago
        status: CreditStatus.PENDING
      }
    });

    const customers = (await listCreditCustomers()) as CreditCustomerSummary[];
    const customerSummary = customers.find(c => c.phone === testPhone);

    expect(customerSummary).toBeDefined();
    expect(customerSummary!.isOverdue).toBe(true);
    expect(customerSummary!.totalOutstanding).toBe(250.00);
  });

  it("should handle partial and full payment status transitions", async () => {
    // Create a ledger entry for 1000
    const ledger = await superuserPrisma.creditLedger.create({
      data: {
        customerName: "Payment Customer",
        phone: testPhone,
        source: CreditSource.QUICK_SELL,
        sourceId: "00000000-0000-0000-0000-000000000002",
        amount: 1000.00,
        givenDate: new Date(),
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        status: CreditStatus.PENDING
      }
    });

    // Record partial payment of 400
    await recordPayment(ledger.id, 400.00, workerId);
    
    let updatedLedger = await superuserPrisma.creditLedger.findUnique({
      where: { id: ledger.id },
      include: { payments: true }
    });
    expect(updatedLedger!.status).toBe(CreditStatus.PARTIAL);
    expect(updatedLedger!.payments).toHaveLength(1);
    expect(Number(updatedLedger!.payments[0].amount)).toBe(400.00);

    // Record remainder payment of 600
    await recordPayment(ledger.id, 600.00, workerId);

    updatedLedger = await superuserPrisma.creditLedger.findUnique({
      where: { id: ledger.id },
      include: { payments: true }
    });
    expect(updatedLedger!.status).toBe(CreditStatus.PAID);
    expect(updatedLedger!.payments).toHaveLength(2);
  });

  it("should enforce write-off role gates, rejecting Workers and allowing Admins", async () => {
    // Create a ledger entry
    const ledger = await superuserPrisma.creditLedger.create({
      data: {
        customerName: "Writeoff Customer",
        phone: testPhone,
        source: CreditSource.QUICK_SELL,
        sourceId: "00000000-0000-0000-0000-000000000003",
        amount: 300.00,
        givenDate: new Date(),
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        status: CreditStatus.PENDING
      }
    });

    // Worker attempts write-off -> Forbidden
    await expect(writeOff(ledger.id, workerId)).rejects.toThrow(ForbiddenError);

    // Admin attempts write-off -> Succeeds
    await writeOff(ledger.id, adminId);

    const updatedLedger = await superuserPrisma.creditLedger.findUnique({
      where: { id: ledger.id }
    });
    expect(updatedLedger!.status).toBe(CreditStatus.WRITTEN_OFF);
  });

  it("should aggregate accumulated credit across POS, Table Sales, and Rooms for a customer phone", async () => {
    // 1. POS Credit
    await superuserPrisma.creditLedger.create({
      data: {
        customerName: "Rabin Sekuwa",
        phone: testPhone,
        source: CreditSource.QUICK_SELL,
        sourceId: "00000000-0000-0000-0000-000000000010",
        amount: 500.00,
        givenDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CreditStatus.PENDING
      }
    });

    // 2. Table Sale Credit
    await superuserPrisma.creditLedger.create({
      data: {
        customerName: "Rabin Sekuwa",
        phone: testPhone,
        source: CreditSource.TABLE_SALE,
        sourceId: "00000000-0000-0000-0000-000000000011",
        amount: 1200.00,
        givenDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CreditStatus.PENDING
      }
    });

    // 3. Room Stay Credit
    await superuserPrisma.creditLedger.create({
      data: {
        customerName: "Rabin Sekuwa",
        phone: testPhone,
        source: CreditSource.ROOM_STAY,
        sourceId: "00000000-0000-0000-0000-000000000012",
        amount: 3500.00,
        givenDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CreditStatus.PENDING
      }
    });

    const lookup = await getCustomerCreditLookup(testPhone);

    expect(lookup.phone).toBe(testPhone);
    expect(lookup.customerName).toBe("Rabin Sekuwa");
    expect(lookup.totalOutstanding).toBe(5200.00); // 500 + 1200 + 3500
    expect(lookup.activeInvoicesCount).toBe(3);
    expect(lookup.sectionBreakdown.pos).toBe(500.00);
    expect(lookup.sectionBreakdown.tables).toBe(1200.00);
    expect(lookup.sectionBreakdown.rooms).toBe(3500.00);
  });
});

