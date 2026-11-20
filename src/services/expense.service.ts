import { superuserPrisma } from "../lib/prisma";
import { Role, PaymentType } from "../generated/prisma/client";
import { ForbiddenError, NotFoundError } from "../lib/errors";
import { getCachedProfile } from "./auth.service";

export interface CreateExpenseInput {
  title: string;
  categoryId: string;
  amount: number;
  date?: string;
  paymentType?: PaymentType;
  vendor?: string | null;
  notes?: string | null;
}

export interface UpdateExpenseInput {
  title?: string;
  categoryId?: string;
  amount?: number;
  date?: string;
  paymentType?: PaymentType;
  vendor?: string | null;
  notes?: string | null;
}

export interface ExpenseFilters {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  search?: string;
  skip?: number;
  take?: number;
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Cleaning & Hygiene", description: "Soap, detergent, sanitizers, brooms, mop" },
  { name: "Maintenance & Repairs", description: "Wires, switches, plumbing, electrical, bulbs, repairs" },
  { name: "Crockery & Utensils", description: "Drinking glasses, plates, spoons, cups, barware" },
  { name: "Utilities & Bills", description: "Electricity, water, internet, LPG gas (non-kitchen)" },
  { name: "Kitchen & Bar Supplies", description: "Packaging, napkins, foils, non-recipe consumables" },
  { name: "General Overhead", description: "Miscellaneous non-saleable operational expenses" },
];

async function assertAdminOrSuper(userId: string) {
  const profile = await getCachedProfile(userId);
  if (!profile) {
    throw new Error("Caller profile not found");
  }
  if (profile.role !== Role.ADMIN && profile.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError("Only Admins and Super Admins can manage expenses");
  }
  return profile;
}

/* ──────────────────────────────────────────────────────────────────────────
   CATEGORY SERVICES
────────────────────────────────────────────────────────────────────────── */

/**
 * Lists all expense categories with their associated expense counts.
 */
export async function listExpenseCategories() {
  return superuserPrisma.expenseCategory.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { expenses: true },
      },
    },
  });
}

/**
 * Creates a new expense category.
 */
export async function createExpenseCategory(
  name: string,
  description: string | null | undefined,
  userId: string
) {
  await assertAdminOrSuper(userId);

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Category name is required");
  }

  const existing = await superuserPrisma.expenseCategory.findUnique({
    where: { name: trimmed },
  });
  if (existing) {
    throw new Error(`Expense category "${trimmed}" already exists`);
  }

  return superuserPrisma.expenseCategory.create({
    data: {
      name: trimmed,
      description: description?.trim() || null,
    },
  });
}

/**
 * Deletes an expense category if it has no associated expense entries.
 */
export async function deleteExpenseCategory(id: string, userId: string) {
  await assertAdminOrSuper(userId);

  const category = await superuserPrisma.expenseCategory.findUnique({
    where: { id },
    include: {
      _count: {
        select: { expenses: true },
      },
    },
  });

  if (!category) {
    throw new NotFoundError("Expense category not found");
  }

  if (category._count.expenses > 0) {
    throw new Error(
      `Cannot delete category "${category.name}" because it is linked to ${category._count.expenses} expense records.`
    );
  }

  return superuserPrisma.expenseCategory.delete({
    where: { id },
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   EXPENSE CRUD SERVICES
────────────────────────────────────────────────────────────────────────── */

/**
 * Records a new non-saleable expense entry.
 */
export async function createExpense(input: CreateExpenseInput, userId: string) {
  await assertAdminOrSuper(userId);

  const title = input.title.trim();
  if (!title) {
    throw new Error("Expense title is required");
  }

  const amount = Number(input.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const category = await superuserPrisma.expenseCategory.findUnique({
    where: { id: input.categoryId },
  });
  if (!category) {
    throw new NotFoundError("Selected expense category does not exist");
  }

  const expenseDate = input.date ? new Date(input.date) : new Date();

  return superuserPrisma.expense.create({
    data: {
      title,
      categoryId: input.categoryId,
      amount,
      date: expenseDate,
      paymentType: input.paymentType || PaymentType.CASH,
      vendor: input.vendor?.trim() || null,
      notes: input.notes?.trim() || null,
      recordedById: userId,
    },
    include: {
      category: true,
      recordedBy: true,
    },
  });
}

/**
 * Retrieves a single expense record by ID.
 */
export async function getExpenseById(id: string, userId: string) {
  await assertAdminOrSuper(userId);

  const expense = await superuserPrisma.expense.findUnique({
    where: { id },
    include: {
      category: true,
      recordedBy: true,
    },
  });

  if (!expense) {
    throw new NotFoundError("Expense record not found");
  }

  return expense;
}

/**
 * Updates an existing expense record.
 */
export async function updateExpense(id: string, input: UpdateExpenseInput, userId: string) {
  await assertAdminOrSuper(userId);

  const existing = await superuserPrisma.expense.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Expense record not found");
  }

  const dataToUpdate: any = {};

  if (input.title !== undefined) {
    const trimmed = input.title.trim();
    if (!trimmed) throw new Error("Title cannot be empty");
    dataToUpdate.title = trimmed;
  }

  if (input.categoryId !== undefined) {
    const category = await superuserPrisma.expenseCategory.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) throw new NotFoundError("Expense category not found");
    dataToUpdate.categoryId = input.categoryId;
  }

  if (input.amount !== undefined) {
    const amount = Number(input.amount);
    if (isNaN(amount) || amount <= 0) throw new Error("Amount must be greater than 0");
    dataToUpdate.amount = amount;
  }

  if (input.date !== undefined) {
    dataToUpdate.date = new Date(input.date);
  }

  if (input.paymentType !== undefined) {
    dataToUpdate.paymentType = input.paymentType;
  }

  if (input.vendor !== undefined) {
    dataToUpdate.vendor = input.vendor?.trim() || null;
  }

  if (input.notes !== undefined) {
    dataToUpdate.notes = input.notes?.trim() || null;
  }

  return superuserPrisma.expense.update({
    where: { id },
    data: dataToUpdate,
    include: {
      category: true,
      recordedBy: true,
    },
  });
}

/**
 * Deletes an expense record.
 */
export async function deleteExpense(id: string, userId: string) {
  await assertAdminOrSuper(userId);

  const existing = await superuserPrisma.expense.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Expense record not found");
  }

  return superuserPrisma.expense.delete({
    where: { id },
  });
}

/**
 * Lists expenses with filtering, pagination, and total period summary amount.
 */
export async function listExpenses(filters: ExpenseFilters, userId: string) {
  await assertAdminOrSuper(userId);

  const where: any = {};

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.startDate || filters.endDate) {
    where.date = {};
    if (filters.startDate) {
      where.date.gte = new Date(`${filters.startDate}T00:00:00.000`);
    }
    if (filters.endDate) {
      where.date.lte = new Date(`${filters.endDate}T23:59:59.999`);
    }
  }

  if (filters.search) {
    const term = filters.search.trim();
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { vendor: { contains: term, mode: "insensitive" } },
      { notes: { contains: term, mode: "insensitive" } },
    ];
  }

  const [expenses, total, sumAggregate] = await Promise.all([
    superuserPrisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      skip: filters.skip ?? 0,
      take: filters.take ?? 50,
      include: {
        category: true,
        recordedBy: true,
      },
    }),
    superuserPrisma.expense.count({ where }),
    superuserPrisma.expense.aggregate({
      where,
      _sum: {
        amount: true,
      },
    }),
  ]);

  const totalAmount = Number(sumAggregate._sum.amount || 0);

  return {
    expenses,
    total,
    totalAmount,
  };
}
