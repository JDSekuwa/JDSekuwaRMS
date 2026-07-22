import { prisma, superuserPrisma } from "../lib/prisma";
import { CreditSource, CreditStatus, Role } from "../generated/prisma/client";
import { setSessionContext, getCachedProfile } from "./auth.service";
import { logAction } from "./audit.service";
import { ForbiddenError } from "../lib/errors";

export interface CreditCustomerSummary {
  customerName: string;
  phone: string;
  totalOutstanding: number;
  isOverdue: boolean;
}

export interface CustomerCreditLookupResult {
  customerName: string;
  phone: string;
  totalOutstanding: number;
  isOverdue: boolean;
  activeInvoicesCount: number;
  sectionBreakdown: {
    pos: number;
    tables: number;
    rooms: number;
  };
  recentInvoices: Array<{
    id: string;
    source: CreditSource;
    amount: number;
    outstanding: number;
    status: CreditStatus;
    givenDate: Date;
    dueDate: Date;
  }>;
}

/**
 * Creates a new credit ledger entry for a sales transaction, keeping exact source attribution.
 * Phone numbers are normalized for unified customer credit aggregation across POS, Tables, and Rooms.
 */
export async function upsertCreditEntry(
  tx: any,
  customerName: string,
  phone: string,
  source: CreditSource,
  sourceId: string,
  amount: number
): Promise<any> {
  const normalizedPhone = phone.trim();
  const normalizedName = customerName.trim();

  // Find if a credit ledger entry already exists for this exact source transaction
  const existing = await tx.creditLedger.findFirst({
    where: {
      source,
      sourceId,
    }
  });

  if (existing) {
    // Update existing transaction's total & customer details
    const updated = await tx.creditLedger.update({
      where: { id: existing.id },
      data: {
        customerName: normalizedName,
        phone: normalizedPhone,
        amount,
      }
    });
    return updated;
  } else {
    // Create new distinct credit transaction entry
    const created = await tx.creditLedger.create({
      data: {
        customerName: normalizedName,
        phone: normalizedPhone,
        source,
        sourceId,
        amount,
        givenDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default due date
        status: CreditStatus.PENDING
      }
    });
    return created;
  }
}

/**
 * Performs a comprehensive credit lookup by customer phone number across all sales sections
 * (POS Quick Sell, Table Sales, Rooms Lodging), returning accumulated sum total and section breakdown.
 */
export async function getCustomerCreditLookup(
  phone: string
): Promise<CustomerCreditLookupResult> {
  const normalizedPhone = phone.trim();
  if (!normalizedPhone) {
    return {
      customerName: "",
      phone: "",
      totalOutstanding: 0,
      isOverdue: false,
      activeInvoicesCount: 0,
      sectionBreakdown: { pos: 0, tables: 0, rooms: 0 },
      recentInvoices: []
    };
  }

  const ledgers = await prisma.creditLedger.findMany({
    where: {
      phone: { equals: normalizedPhone, mode: "insensitive" }
    },
    include: {
      payments: {
        select: { amount: true }
      }
    },
    orderBy: {
      givenDate: "desc"
    }
  });

  const now = new Date();
  let customerName = "";
  let totalOutstanding = 0;
  let isOverdue = false;
  let activeInvoicesCount = 0;

  const sectionBreakdown = {
    pos: 0,
    tables: 0,
    rooms: 0
  };

  const recentInvoices: Array<{
    id: string;
    source: CreditSource;
    amount: number;
    outstanding: number;
    status: CreditStatus;
    givenDate: Date;
    dueDate: Date;
  }> = [];

  for (const ledger of ledgers) {
    if (!customerName && ledger.customerName) {
      customerName = ledger.customerName;
    }

    const paidAmount = ledger.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const outstanding = Math.max(0, Number(ledger.amount) - paidAmount);

    const isUnsettled = ledger.status === CreditStatus.PENDING || ledger.status === CreditStatus.PARTIAL;

    if (isUnsettled && outstanding > 0) {
      activeInvoicesCount++;
      totalOutstanding += outstanding;

      if (new Date(ledger.dueDate) < now) {
        isOverdue = true;
      }

      if (ledger.source === CreditSource.QUICK_SELL) {
        sectionBreakdown.pos += outstanding;
      } else if (ledger.source === CreditSource.TABLE_SALE) {
        sectionBreakdown.tables += outstanding;
      } else if (ledger.source === CreditSource.ROOM_STAY) {
        sectionBreakdown.rooms += outstanding;
      }
    }

    recentInvoices.push({
      id: ledger.id,
      source: ledger.source,
      amount: Number(ledger.amount),
      outstanding,
      status: ledger.status,
      givenDate: ledger.givenDate,
      dueDate: ledger.dueDate
    });
  }

  return {
    customerName,
    phone: normalizedPhone,
    totalOutstanding,
    isOverdue,
    activeInvoicesCount,
    sectionBreakdown,
    recentInvoices
  };
}


/**
 * Retrieves credit customers summaries grouped by phone.
 * Excludes PAID and WRITTEN_OFF ledger entries.
 */
export async function listCreditCustomers(
  options?: { skip?: number; take?: number; search?: string }
): Promise<CreditCustomerSummary[] | { data: CreditCustomerSummary[]; total: number }> {
  const ledgers = await prisma.creditLedger.findMany({
    where: {
      status: {
        in: [CreditStatus.PENDING, CreditStatus.PARTIAL]
      }
    },
    include: {
      payments: {
        select: {
          amount: true
        }
      }
    }
  });

  const summaryMap = new Map<string, { customerName: string; phone: string; totalOutstanding: number; isOverdue: boolean }>();
  const now = new Date();

  for (const ledger of ledgers) {
    const paidAmount = ledger.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const outstanding = Number(ledger.amount) - paidAmount;

    if (outstanding <= 0) continue;

    const isEntryOverdue = new Date(ledger.dueDate) < now;

    const existing = summaryMap.get(ledger.phone);
    if (existing) {
      existing.totalOutstanding += outstanding;
      if (isEntryOverdue) {
        existing.isOverdue = true;
      }
    } else {
      summaryMap.set(ledger.phone, {
        customerName: ledger.customerName,
        phone: ledger.phone,
        totalOutstanding: outstanding,
        isOverdue: isEntryOverdue
      });
    }
  }

  let result = Array.from(summaryMap.values());

  if (options?.search) {
    const searchLower = options.search.toLowerCase();
    result = result.filter(
      (r) =>
        r.customerName.toLowerCase().includes(searchLower) ||
        r.phone.includes(searchLower)
    );
  }

  // Sort: isOverdue first (true before false), then totalOutstanding desc
  result.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return b.totalOutstanding - a.totalOutstanding;
  });

  if (options?.skip !== undefined && options?.take !== undefined) {
    const total = result.length;
    const paginatedResult = result.slice(options.skip, options.skip + options.take);
    return { data: paginatedResult, total };
  }

  return result;
}

/**
 * Retrieves full transaction and payment history for a customer phone number, oldest first.
 */
export async function getCustomerLedger(phone: string): Promise<any[]> {
  return await prisma.creditLedger.findMany({
    where: { phone },
    include: {
      payments: {
        orderBy: {
          paidAt: "asc"
        }
      }
    },
    orderBy: {
      givenDate: "asc"
    }
  });
}

/**
 * Records a credit payment, updating status of the ledger entry.
 */
export async function recordPayment(
  creditLedgerId: string,
  amount: number,
  recordedById: string
): Promise<any> {
  const profile = await getCachedProfile(recordedById);
  if (!profile) {
    throw new Error("Recorder profile not found");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, recordedById);

    const ledger = await tx.creditLedger.findUnique({
      where: { id: creditLedgerId },
      include: { payments: true }
    });

    if (!ledger) {
      throw new Error("Credit ledger entry not found");
    }

    if (ledger.status === CreditStatus.PAID) {
      throw new Error("Credit ledger entry is already fully paid");
    }
    if (ledger.status === CreditStatus.WRITTEN_OFF) {
      throw new Error("Cannot record payment for a written-off credit ledger entry");
    }

    // Append the payment
    const payment = await tx.creditPayment.create({
      data: {
        creditLedgerId,
        amount,
        recordedById,
      }
    });

    // Recompute total paid
    const prevPaid = ledger.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const totalPaid = prevPaid + amount;

    let newStatus: CreditStatus = CreditStatus.PARTIAL;
    if (totalPaid >= Number(ledger.amount)) {
      newStatus = CreditStatus.PAID;
    }

    await tx.creditLedger.update({
      where: { id: creditLedgerId },
      data: {
        status: newStatus
      }
    });

    await logAction(recordedById, "RECORD_CREDIT_PAYMENT", "CreditLedger", creditLedgerId, { amount, status: newStatus }, tx);

    return payment;
  });
}

/**
 * Writes off a credit entry (Admin/Super Admin only).
 */
export async function writeOff(
  creditLedgerId: string,
  userId: string
): Promise<any> {
  const profile = await getCachedProfile(userId);
  if (!profile) {
    throw new Error("User not found");
  }

  if (profile.role !== Role.ADMIN && profile.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError("Only Admins and Super Admins can write off credits");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, userId);

    const ledger = await tx.creditLedger.findUnique({
      where: { id: creditLedgerId }
    });

    if (!ledger) {
      throw new Error("Credit ledger entry not found");
    }

    if (ledger.status === CreditStatus.PAID) {
      throw new Error("Cannot write off a fully paid credit ledger entry");
    }

    const updated = await tx.creditLedger.update({
      where: { id: creditLedgerId },
      data: {
        status: CreditStatus.WRITTEN_OFF
      }
    });

    await logAction(userId, "WRITE_OFF_CREDIT", "CreditLedger", creditLedgerId, {}, tx);

    return updated;
  });
}

/**
 * Records a lump-sum payment on a customer account, distributing funds across all open credit invoices
 * in First-In, First-Out (FIFO) chronological order (oldest debt paid first).
 */
export async function recordCustomerAccountPayment(
  phone: string,
  amount: number,
  recordedById: string
): Promise<{ totalApplied: number; affectedInvoicesCount: number }> {
  const normalizedPhone = phone.trim();
  if (!normalizedPhone) {
    throw new Error("Customer phone number is required");
  }
  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  const profile = await getCachedProfile(recordedById);
  if (!profile) {
    throw new Error("Recorder profile not found");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, recordedById);

    // Fetch all unsettled credit entries for this phone number, oldest givenDate first (FIFO)
    const openLedgers = await tx.creditLedger.findMany({
      where: {
        phone: { equals: normalizedPhone, mode: "insensitive" },
        status: { in: [CreditStatus.PENDING, CreditStatus.PARTIAL] }
      },
      include: { payments: true },
      orderBy: { givenDate: "asc" }
    });

    if (openLedgers.length === 0) {
      throw new Error("No open credit invoices found for this customer phone number");
    }

    let remainingPayment = amount;
    let totalApplied = 0;
    let affectedInvoicesCount = 0;

    for (const ledger of openLedgers) {
      if (remainingPayment <= 0) break;

      const prevPaid = ledger.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const outstanding = Math.max(0, Number(ledger.amount) - prevPaid);

      if (outstanding <= 0.001) continue;

      const allocation = Math.min(remainingPayment, outstanding);

      // Create itemized payment record for this specific invoice
      await tx.creditPayment.create({
        data: {
          creditLedgerId: ledger.id,
          amount: allocation,
          recordedById
        }
      });

      const newTotalPaid = prevPaid + allocation;
      let newStatus: CreditStatus = CreditStatus.PARTIAL;
      if (newTotalPaid >= Number(ledger.amount) - 0.01) {
        newStatus = CreditStatus.PAID;
      }

      await tx.creditLedger.update({
        where: { id: ledger.id },
        data: { status: newStatus }
      });

      await logAction(
        recordedById,
        "RECORD_CREDIT_PAYMENT",
        "CreditLedger",
        ledger.id,
        { amount: allocation, status: newStatus, bulkAccountPayment: true },
        tx
      );

      remainingPayment -= allocation;
      totalApplied += allocation;
      affectedInvoicesCount++;
    }

    return { totalApplied, affectedInvoicesCount };
  });
}


