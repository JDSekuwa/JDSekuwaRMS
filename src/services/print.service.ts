import { superuserPrisma } from "../lib/prisma";

export interface KotPayload {
  tableOrderId: string;
  tableName: string;
  tag: string | null;
  openedBy: string;
  openedAt: Date;
  items: Array<{
    name: string;
    qty: number;
  }>;
}

export interface ReceiptItemPayload {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptPayload {
  id: string;
  type: "TABLE_ORDER" | "QUICK_SALE";
  tableName: string | null;
  tag: string | null;
  cashierName: string;
  openedAt: Date;
  closedAt: Date | null;
  paymentType: string | null;
  subtotal: number;
  discount: number;
  total: number;
  items: ReceiptItemPayload[];
}

/**
 * Builds KOT print payload containing kitchen-category items only, without prices.
 */
export async function buildKotPayload(tableOrderId: string): Promise<KotPayload> {
  const order = await superuserPrisma.tableOrder.findUnique({
    where: { id: tableOrderId },
    include: {
      table: true,
      openedBy: true,
      items: {
        where: { isVoid: false },
        include: {
          menuItem: {
            include: {
              category: true
            }
          }
        }
      }
    }
  });

  if (!order) {
    throw new Error("Table order not found");
  }

  const kitchenItems = order.items
    .filter(item => item.menuItem.category.isKitchen)
    .map(item => ({
      name: item.menuItem.name,
      qty: item.qty
    }));

  return {
    tableOrderId: order.id,
    tableName: order.table.name,
    tag: order.table.currentTag,
    openedBy: order.openedBy.role,
    openedAt: order.openedAt,
    items: kitchenItems
  };
}

/**
 * Builds final receipt bill payload for either a closed Table Order or a POS Quick Sale.
 */
export async function buildReceiptPayload(id: string): Promise<ReceiptPayload> {
  // Check if ID matches a TableOrder first
  const order = await superuserPrisma.tableOrder.findUnique({
    where: { id },
    include: {
      table: true,
      openedBy: true,
      items: {
        where: { isVoid: false },
        include: {
          menuItem: true
        }
      }
    }
  });

  if (order) {
    const items = order.items.map(item => ({
      id: item.id,
      name: item.menuItem.name,
      qty: item.qty,
      unitPrice: Number(item.unitPrice),
      total: Number(item.unitPrice) * item.qty
    }));

    return {
      id: order.id,
      type: "TABLE_ORDER",
      tableName: order.table.name,
      tag: order.table.currentTag,
      cashierName: order.openedBy.role,
      openedAt: order.openedAt,
      closedAt: order.closedAt,
      paymentType: order.paymentType,
      subtotal: order.subtotal ? Number(order.subtotal) : 0,
      discount: Number(order.discount),
      total: order.total ? Number(order.total) : 0,
      items
    };
  }

  // Check if ID matches a QuickSale
  const sale = await superuserPrisma.quickSale.findUnique({
    where: { id },
    include: {
      cashier: true,
      items: {
        where: { isVoid: false },
        include: {
          menuItem: true
        }
      }
    }
  });

  if (sale) {
    const items = sale.items.map(item => ({
      id: item.id,
      name: item.menuItem.name,
      qty: item.qty,
      unitPrice: Number(item.unitPrice),
      total: Number(item.unitPrice) * item.qty
    }));

    return {
      id: sale.id,
      type: "QUICK_SALE",
      tableName: "POS",
      tag: null,
      cashierName: sale.cashier.role,
      openedAt: sale.createdAt,
      closedAt: sale.createdAt,
      paymentType: sale.paymentType,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      total: Number(sale.total),
      items
    };
  }

  throw new Error(`Order or sale not found with ID: ${id}`);
}
