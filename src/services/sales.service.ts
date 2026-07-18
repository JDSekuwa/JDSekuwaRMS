import { prisma, superuserPrisma } from "../lib/prisma";
import { Role, PaymentType, TableStatus, TableOrderStatus, CreditSource, CreditStatus } from "../generated/prisma/client";
import { setSessionContext } from "./auth.service";
import { logAction } from "./audit.service";
import { deductForSale, restoreForVoid } from "./inventory.service";
import { TableConflictError, ForbiddenError } from "../lib/errors";
import { upsertCreditEntry } from "./credit.service";
import { serverCache } from "../lib/cache";

/**
 * Creates a POS Quick Sale complete transaction.
 */
export async function createQuickSale(
  cashierId: string,
  items: Array<{ menuItemId: string; qty: number; rawQtyOverride?: number }>,
  paymentType: PaymentType,
  discount: number = 0,
  customerInfo?: { customerName: string; phone: string }
): Promise<any> {
  const cashier = await superuserPrisma.profile.findUnique({
    where: { id: cashierId }
  });
  if (!cashier) {
    throw new Error("Cashier not found");
  }

  if (cashier.role === Role.WORKER && discount > 0) {
    throw new ForbiddenError("Discounts can only be approved by Admins or Super Admins.");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, cashier.role, cashierId);

    // 1. Calculate totals from database MenuItem prices
    let subtotal = 0;
    const itemsWithPrices = [];

    for (const item of items) {
      const menu = await tx.menuItem.findUnique({
        where: { id: item.menuItemId }
      });
      if (!menu) {
        throw new Error(`Menu item not found: ${item.menuItemId}`);
      }
      
      const price = Number(menu.price);
      subtotal += price * item.qty;
      itemsWithPrices.push({ ...item, price });
    }

    const total = Math.max(0, subtotal - discount);

    // 2. Create the QuickSale record
    const quickSale = await tx.quickSale.create({
      data: {
        paymentType,
        subtotal,
        discount,
        total,
        cashierId
      }
    });

    // 3. Deduct stock levels and write OrderItems
    for (const item of itemsWithPrices) {
      const deductions = await deductForSale(item.menuItemId, item.qty, item.rawQtyOverride, tx);

      await tx.orderItem.create({
        data: {
          quickSaleId: quickSale.id,
          menuItemId: item.menuItemId,
          qty: item.qty,
          unitPrice: item.price,
          rawQtyOverride: item.rawQtyOverride !== undefined ? item.rawQtyOverride : null,
          rawDeductions: deductions,
        }
      });
    }

    // 4. Create credit entry if CREDIT payment
    if (paymentType === PaymentType.CREDIT) {
      if (!customerInfo || !customerInfo.customerName || !customerInfo.phone) {
        throw new Error("Customer name and phone number are required for credit payments");
      }

      await upsertCreditEntry(
        tx,
        customerInfo.customerName,
        customerInfo.phone,
        CreditSource.QUICK_SELL,
        quickSale.id,
        total
      );
    }

    await logAction(
      cashierId,
      "CREATE_QUICK_SALE",
      "QuickSale",
      quickSale.id,
      { total, paymentType },
      tx
    );

    // Invalidate caches
    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return quickSale;
  }, { maxWait: 5000, timeout: 15000 });
}

/**
 * Voids an individual OrderItem (completed or open).
 */
export async function voidOrderItem(
  orderItemId: string,
  userId: string
): Promise<any> {
  const profile = await superuserPrisma.profile.findUnique({
    where: { id: userId }
  });
  if (!profile) {
    throw new Error("User not found");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, userId);

    const orderItem = await tx.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        quickSale: true,
        tableOrder: true
      }
    });

    if (!orderItem) {
      throw new Error("Order item not found");
    }
    if (orderItem.isVoid) {
      throw new Error("Order item is already void");
    }

    // 1. Mark isVoid
    const updatedOrderItem = await tx.orderItem.update({
      where: { id: orderItemId },
      data: {
        isVoid: true,
        voidedById: userId,
        voidedAt: new Date()
      }
    });

    // 2. Restore stock via snapshot
    await restoreForVoid(orderItemId, tx);

    // 3. Adjust parent sale's totals if closed
    if (orderItem.quickSaleId) {
      const qsale = orderItem.quickSale!;
      const nonVoidItems = await tx.orderItem.findMany({
        where: {
          quickSaleId: orderItem.quickSaleId,
          isVoid: false
        }
      });

      let subtotal = 0;
      for (const item of nonVoidItems) {
        subtotal += Number(item.unitPrice) * item.qty;
      }
      const total = Math.max(0, subtotal - Number(qsale.discount));

      await tx.quickSale.update({
        where: { id: orderItem.quickSaleId },
        data: { subtotal, total }
      });

      if (qsale.paymentType === PaymentType.CREDIT) {
        await tx.creditLedger.updateMany({
          where: {
            source: CreditSource.QUICK_SELL,
            sourceId: qsale.id
          },
          data: {
            amount: total
          }
        });
      }
    } else if (orderItem.tableOrderId && orderItem.tableOrder?.status === TableOrderStatus.CLOSED) {
      const order = orderItem.tableOrder!;
      const nonVoidItems = await tx.orderItem.findMany({
        where: {
          tableOrderId: orderItem.tableOrderId,
          isVoid: false
        }
      });

      let subtotal = 0;
      for (const item of nonVoidItems) {
        subtotal += Number(item.unitPrice) * item.qty;
      }
      const total = Math.max(0, subtotal - Number(order.discount));

      const orderUpdated = await tx.tableOrder.updateMany({
        where: {
          id: order.id,
          version: order.version
        },
        data: {
          subtotal,
          total,
          version: { increment: 1 }
        }
      });
      if (orderUpdated.count === 0) {
        throw new TableConflictError("Table order version changed during void");
      }

      if (order.paymentType === PaymentType.CREDIT) {
        await tx.creditLedger.updateMany({
          where: {
            source: CreditSource.TABLE_SALE,
            sourceId: order.id
          },
          data: {
            amount: total
          }
        });
      }
    } else if (orderItem.tableOrderId && orderItem.tableOrder?.status === TableOrderStatus.OPEN) {
      const order = orderItem.tableOrder!;
      const orderUpdated = await tx.tableOrder.updateMany({
        where: {
          id: order.id,
          version: order.version
        },
        data: {
          version: { increment: 1 }
        }
      });
      if (orderUpdated.count === 0) {
        throw new TableConflictError("Table order version changed during void");
      }
    }

    await logAction(
      userId,
      "VOID_ORDER_ITEM",
      "OrderItem",
      orderItemId,
      { menuItemId: orderItem.menuItemId, qty: orderItem.qty },
      tx
    );

    // Invalidate caches
    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return updatedOrderItem;
  }, { maxWait: 5000, timeout: 15000 });
}

/**
 * Opens a Table Order with optimistic locking.
 */
export async function openTableOrder(
  tableId: string,
  tag: string | null = null,
  userId: string
): Promise<any> {
  const profile = await superuserPrisma.profile.findUnique({
    where: { id: userId }
  });
  if (!profile) {
    throw new Error("User not found");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, userId);

    const table = await tx.restaurantTable.findUnique({
      where: { id: tableId }
    });
    if (!table) {
      throw new Error("Table not found");
    }
    if (table.status !== TableStatus.VACANT) {
      throw new TableConflictError("Table is not vacant");
    }

    // Optimistic lock status change
    const updated = await tx.restaurantTable.updateMany({
      where: {
        id: tableId,
        version: table.version
      },
      data: {
        status: TableStatus.OCCUPIED,
        currentTag: tag,
        version: { increment: 1 }
      }
    });

    if (updated.count === 0) {
      throw new TableConflictError("Table status was updated by another session");
    }

    const order = await tx.tableOrder.create({
      data: {
        tableId,
        status: TableOrderStatus.OPEN,
        openedById: userId,
        version: 1
      }
    });

    await logAction(userId, "OPEN_TABLE_ORDER", "TableOrder", order.id, { tableId }, tx);

    // Invalidate caches
    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return order;
  }, { maxWait: 5000, timeout: 15000 });
}

/**
 * Appends OrderItems to an open Table Order.
 */
export async function addItemsToTableOrder(
  tableOrderId: string,
  items: Array<{ menuItemId: string; qty: number; rawQtyOverride?: number }>,
  userId: string
): Promise<any> {
  const profile = await superuserPrisma.profile.findUnique({
    where: { id: userId }
  });
  if (!profile) {
    throw new Error("User not found");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, userId);

    const order = await tx.tableOrder.findUnique({
      where: { id: tableOrderId }
    });
    if (!order) {
      throw new Error("Table order not found");
    }
    if (order.status !== TableOrderStatus.OPEN) {
      throw new Error("Cannot add items to a closed table order");
    }

    // Optimistic locking on TableOrder version
    const updated = await tx.tableOrder.updateMany({
      where: {
        id: tableOrderId,
        version: order.version
      },
      data: {
        version: { increment: 1 }
      }
    });

    if (updated.count === 0) {
      throw new TableConflictError("Table order version changed");
    }

    const createdItems = [];
    for (const item of items) {
      const menu = await tx.menuItem.findUnique({
        where: { id: item.menuItemId }
      });
      if (!menu) {
        throw new Error(`Menu item not found: ${item.menuItemId}`);
      }

      const created = await tx.orderItem.create({
        data: {
          tableOrderId,
          menuItemId: item.menuItemId,
          qty: item.qty,
          unitPrice: menu.price,
          rawQtyOverride: item.rawQtyOverride !== undefined ? item.rawQtyOverride : null,
        }
      });
      createdItems.push(created);
    }

    await logAction(
      userId,
      "ADD_ITEMS_TO_TABLE_ORDER",
      "TableOrder",
      tableOrderId,
      { count: items.length },
      tx
    );

    // Invalidate caches
    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return createdItems;
  }, { maxWait: 5000, timeout: 15000 });
}

/**
 * Removes an OrderItem from an open Table Order completely.
 */
export async function removeItemFromTableOrder(
  orderItemId: string,
  userId: string
): Promise<any> {
  const profile = await superuserPrisma.profile.findUnique({
    where: { id: userId }
  });
  if (!profile) {
    throw new Error("User not found");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, userId);

    const orderItem = await tx.orderItem.findUnique({
      where: { id: orderItemId },
      include: { tableOrder: true }
    });

    if (!orderItem) {
      throw new Error("Order item not found");
    }
    if (!orderItem.tableOrderId) {
      throw new Error("Order item is not linked to a table order");
    }
    if (orderItem.tableOrder?.status !== TableOrderStatus.OPEN) {
      throw new Error("Cannot remove items from a closed table order");
    }

    // Optimistic lock parent TableOrder version
    const updated = await tx.tableOrder.updateMany({
      where: {
        id: orderItem.tableOrderId,
        version: orderItem.tableOrder.version
      },
      data: {
        version: { increment: 1 }
      }
    });

    if (updated.count === 0) {
      throw new TableConflictError("Table order version changed");
    }

    // Delete item (since it's an open order and no stock was deducted)
    await tx.orderItem.delete({
      where: { id: orderItemId }
    });

    await logAction(
      userId,
      "REMOVE_ITEM_FROM_TABLE_ORDER",
      "TableOrder",
      orderItem.tableOrderId,
      { menuItemId: orderItem.menuItemId, qty: orderItem.qty },
      tx
    );

    // Invalidate caches
    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return { success: true };
  }, { maxWait: 5000, timeout: 15000 });
}

/**
 * Moves TableOrder to a vacant target table.
 */
export async function moveTableOrder(
  sourceTableOrderId: string,
  targetTableId: string,
  userId: string
): Promise<any> {
  const profile = await superuserPrisma.profile.findUnique({
    where: { id: userId }
  });
  if (!profile) {
    throw new Error("User not found");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, userId);

    const sourceOrder = await tx.tableOrder.findUnique({
      where: { id: sourceTableOrderId },
      include: { table: true }
    });
    if (!sourceOrder) {
      throw new Error("Source table order not found");
    }
    if (sourceOrder.status !== TableOrderStatus.OPEN) {
      throw new Error("Source table order is not open");
    }

    const targetTable = await tx.restaurantTable.findUnique({
      where: { id: targetTableId }
    });
    if (!targetTable) {
      throw new Error("Target table not found");
    }
    if (targetTable.status !== TableStatus.VACANT) {
      throw new Error("Target table is not vacant");
    }

    // Optimistic lock on target table
    const targetUpdated = await tx.restaurantTable.updateMany({
      where: {
        id: targetTableId,
        version: targetTable.version
      },
      data: {
        status: TableStatus.OCCUPIED,
        currentTag: sourceOrder.table.currentTag,
        version: { increment: 1 }
      }
    });
    if (targetUpdated.count === 0) {
      throw new TableConflictError("Target table state changed");
    }

    // Optimistic lock on source table reset
    const sourceUpdated = await tx.restaurantTable.updateMany({
      where: {
        id: sourceOrder.tableId,
        version: sourceOrder.table.version
      },
      data: {
        status: TableStatus.VACANT,
        currentTag: null,
        version: { increment: 1 }
      }
    });
    if (sourceUpdated.count === 0) {
      throw new TableConflictError("Source table state changed");
    }

    // Optimistic lock on TableOrder move
    const orderUpdated = await tx.tableOrder.updateMany({
      where: {
        id: sourceTableOrderId,
        version: sourceOrder.version
      },
      data: {
        tableId: targetTableId,
        version: { increment: 1 }
      }
    });
    if (orderUpdated.count === 0) {
      throw new TableConflictError("Source table order state changed");
    }

    await logAction(
      userId,
      "MOVE_TABLE_ORDER",
      "TableOrder",
      sourceTableOrderId,
      { sourceTableId: sourceOrder.tableId, targetTableId },
      tx
    );

    // Invalidate caches
    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return { success: true };
  }, { maxWait: 5000, timeout: 15000 });
}

/**
 * Merges source TableOrder into target TableOrder.
 */
export async function mergeTableOrders(
  sourceTableOrderId: string,
  targetTableOrderId: string,
  userId: string
): Promise<any> {
  const profile = await superuserPrisma.profile.findUnique({
    where: { id: userId }
  });
  if (!profile) {
    throw new Error("User not found");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, profile.role, userId);

    const sourceOrder = await tx.tableOrder.findUnique({
      where: { id: sourceTableOrderId },
      include: { table: true }
    });
    if (!sourceOrder) {
      throw new Error("Source order not found");
    }
    if (sourceOrder.status !== TableOrderStatus.OPEN) {
      throw new Error("Source order is not open");
    }

    const targetOrder = await tx.tableOrder.findUnique({
      where: { id: targetTableOrderId },
      include: { table: true }
    });
    if (!targetOrder) {
      throw new Error("Target order not found");
    }
    if (targetOrder.status !== TableOrderStatus.OPEN) {
      throw new Error("Target order is not open");
    }

    // Optimistic lock on source table reset
    const sourceTableUpdated = await tx.restaurantTable.updateMany({
      where: {
        id: sourceOrder.tableId,
        version: sourceOrder.table.version
      },
      data: {
        status: TableStatus.VACANT,
        currentTag: null,
        version: { increment: 1 }
      }
    });
    if (sourceTableUpdated.count === 0) {
      throw new TableConflictError("Source table state changed");
    }

    // Optimistic lock on source order status update
    const sourceOrderUpdated = await tx.tableOrder.updateMany({
      where: {
        id: sourceTableOrderId,
        version: sourceOrder.version
      },
      data: {
        status: TableOrderStatus.VOIDED,
        closedAt: new Date(),
        version: { increment: 1 }
      }
    });
    if (sourceOrderUpdated.count === 0) {
      throw new TableConflictError("Source order state changed");
    }

    // Optimistic lock on target order update (version increment)
    const targetOrderUpdated = await tx.tableOrder.updateMany({
      where: {
        id: targetTableOrderId,
        version: targetOrder.version
      },
      data: {
        version: { increment: 1 }
      }
    });
    if (targetOrderUpdated.count === 0) {
      throw new TableConflictError("Target order state changed");
    }

    // Move all items from source to target
    await tx.orderItem.updateMany({
      where: {
        tableOrderId: sourceTableOrderId,
        isVoid: false
      },
      data: {
        tableOrderId: targetTableOrderId
      }
    });

    await logAction(
      userId,
      "MERGE_TABLE_ORDERS",
      "TableOrder",
      targetTableOrderId,
      { sourceTableOrderId, targetTableOrderId },
      tx
    );

    // Invalidate caches
    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return { success: true };
  }, { maxWait: 5000, timeout: 15000 });
}

/**
 * Closes and settles a Table Order. Stock is deducted atomically at this time.
 */
export async function closeTableOrder(
  tableOrderId: string,
  cashierId: string,
  paymentType: PaymentType,
  discount: number = 0,
  customerInfo?: { customerName: string; phone: string }
): Promise<any> {
  const cashier = await superuserPrisma.profile.findUnique({
    where: { id: cashierId }
  });
  if (!cashier) {
    throw new Error("Cashier not found");
  }

  if (cashier.role === Role.WORKER && discount > 0) {
    throw new ForbiddenError("Discounts can only be approved by Admins or Super Admins.");
  }

  return await prisma.$transaction(async (tx) => {
    await setSessionContext(tx, cashier.role, cashierId);

    const order = await tx.tableOrder.findUnique({
      where: { id: tableOrderId },
      include: {
        table: true,
        items: {
          where: { isVoid: false }
        }
      }
    });

    if (!order) {
      throw new Error("Table order not found");
    }
    if (order.status !== TableOrderStatus.OPEN) {
      throw new Error("Table order is not open");
    }

    // 1. Calculate settled totals
    let subtotal = 0;
    for (const item of order.items) {
      subtotal += Number(item.unitPrice) * item.qty;
    }

    const total = Math.max(0, subtotal - discount);

    // 2. Perform stock deductions and save snapshots to OrderItem rows
    for (const item of order.items) {
      const deductions = await deductForSale(
        item.menuItemId,
        item.qty,
        item.rawQtyOverride ? Number(item.rawQtyOverride) : undefined,
        tx
      );

      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          rawDeductions: deductions
        },
        select: {
          id: true,
          rawDeductions: true,
        }
      });
    }

    // 3. Optimistic lock on TableOrder status change
    const orderUpdated = await tx.tableOrder.updateMany({
      where: {
        id: tableOrderId,
        version: order.version
      },
      data: {
        status: TableOrderStatus.CLOSED,
        closedAt: new Date(),
        paymentType,
        subtotal,
        discount,
        total,
        version: { increment: 1 }
      }
    });
    if (orderUpdated.count === 0) {
      throw new TableConflictError("Table order version mismatch");
    }

    // 4. Optimistic lock on RestaurantTable state release
    const tableUpdated = await tx.restaurantTable.updateMany({
      where: {
        id: order.tableId,
        version: order.table.version
      },
      data: {
        status: TableStatus.VACANT,
        currentTag: null,
        version: { increment: 1 }
      }
    });
    if (tableUpdated.count === 0) {
      throw new TableConflictError("Table was modified by another session");
    }

    // 5. Create credit record if CREDIT payment
    if (paymentType === PaymentType.CREDIT) {
      if (!customerInfo || !customerInfo.customerName || !customerInfo.phone) {
        throw new Error("Customer name and phone number are required for credit payments");
      }

      await upsertCreditEntry(
        tx,
        customerInfo.customerName,
        customerInfo.phone,
        CreditSource.TABLE_SALE,
        order.id,
        total
      );
    }

    await logAction(
      cashierId,
      "CLOSE_TABLE_ORDER",
      "TableOrder",
      order.id,
      { total, paymentType },
      tx
    );

    // Invalidate caches
    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return { success: true };
  }, { maxWait: 5000, timeout: 15000 });
}
