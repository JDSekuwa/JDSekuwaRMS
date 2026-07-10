import { prisma, superuserPrisma } from "../lib/prisma";
import { CreditSource, CreditStatus, Role } from "../generated/prisma/client";
import { setSessionContext } from "./auth.service";
import { logAction } from "./audit.service";
import { ForbiddenError } from "../lib/errors";

export interface CreditCustomerSummary {
  customerName: string;
  phone: string;
  totalOutstanding: number;
  isOverdue: boolean;
}

/**
 * Creates a new credit ledger entry, or merges the amount into an existing PENDING credit ledger entry
 * for the same customer phone number.
 */
export async function upsertCreditEntry(
  tx: any,
  customerName: string,
  phone: string,
  source: CreditSource,
  sourceId: string,
  amount: number
): Promise<any> {
  // Find any existing PENDING credit ledger entry for this phone number
  const existing = await tx.creditLedger.findFirst({
    where: {
      phone,
      status: CreditStatus.PENDING
    }
  });

  if (existing) {
    // Merge: update the existing entry's amount
    const updated = await tx.creditLedger.update({
      where: { id: existing.id },
      data: {
        amount: Number(existing.amount) + amount,
      }
    });
    return updated;
  } else {
    // Create new entry
    const created = await tx.creditLedger.create({
      data: {
        customerName,
        phone,
        source,
        sourceId,
        amount,
        givenDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: CreditStatus.PENDING
      }
    });
    return created;
  }
}

/**
 * Retrieves credit customers summaries grouped by phone.
 * Excludes PAID and WRITTEN_OFF ledger entries.
 */
export async function listCreditCustomers(): Promise<CreditCustomerSummary[]> {
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

  const result = Array.from(summaryMap.values());

  // Sort: isOverdue first (true before false), then totalOutstanding desc
  result.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return b.totalOutstanding - a.totalOutstanding;
  });

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
  const profile = await superuserPrisma.profile.findUnique({
    where: { id: recordedById }
  });
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
  const profile = await superuserPrisma.profile.findUnique({
    where: { id: userId }
  });
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

