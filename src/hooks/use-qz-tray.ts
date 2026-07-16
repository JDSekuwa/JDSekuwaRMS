import { useState, useEffect, useCallback } from "react";

export interface KotPrintData {
  tableOrderId: string;
  tableName: string;
  tag: string | null;
  openedBy: string;
  openedAt: string;
  items: Array<{
    name: string;
    qty: number;
  }>;
}

export interface ReceiptPrintData {
  id: string;
  type: "TABLE_ORDER" | "QUICK_SALE";
  tableName: string | null;
  tag: string | null;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  paymentType: string | null;
  subtotal: number;
  discount: number;
  total: number;
  items: Array<{
    name: string;
    qty: number;
    unitPrice: number;
    total: number;
  }>;
}

export function useQzTray() {
  const [isConnected, setIsConnected] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [qz, setQz] = useState<any>(null);

  // Initialize and load connection to local desktop client
  useEffect(() => {
    // Only import on client-side to prevent SSR Node builds from crashing
    if (typeof window === "undefined") return;

    try {
      const qzLib = require("qz-tray");
      setQz(qzLib);

      // Establish websocket connection to localhost
      if (qzLib.websocket.isActive()) {
        setIsConnected(true);
        loadPrinters(qzLib);
      } else {
        qzLib.websocket.connect()
          .then(() => {
            setIsConnected(true);
            loadPrinters(qzLib);
          })
          .catch((err: any) => {
            console.warn("[QZ Tray] Bridge not connected locally:", err.message);
            setIsConnected(false);
          });
      }
    } catch (e: any) {
      console.error("[QZ Tray] Failed to load library:", e.message);
    }

    async function loadPrinters(lib: any) {
      try {
        const list = await lib.printers.find();
        setPrinters(list);
      } catch (err: any) {
        console.warn("[QZ Tray] Failed to query printers:", err.message);
      }
    }
  }, []);

  // Dispatch raw thermal KOT receipt
  const printKot = useCallback(async (printerName: string, kot: KotPrintData) => {
    if (!qz || !isConnected) {
      throw new Error("Printer bridge is not connected.");
    }

    const config = qz.configs.create(printerName);
    
    // ESC/POS raw formatting lines
    const printData = [
      "\x1B\x40",             // 1. Initialize printer
      "\x1B\x61\x01",         // 2. Align center
      "\x1D\x21\x11",         // 3. Double size text (double height + width)
      "KITCHEN TICKET (KOT)\n",
      "\x1D\x21\x00",         // 4. Normal text size
      `Table: ${kot.tableName}\n`,
      kot.tag ? `Tag: ${kot.tag}\n` : "",
      "--------------------------------\n",
      "\x1B\x61\x00",         // 5. Align left
      `Order ID: ${kot.tableOrderId.slice(0, 8)}\n`,
      `Waiter: ${kot.openedBy}\n`,
      `Time: ${new Date(kot.openedAt).toLocaleTimeString()}\n`,
      "--------------------------------\n",
      "Item Description             Qty\n",
      "--------------------------------\n",
      ...kot.items.map((item) => {
        const namePart = item.name.slice(0, 26).padEnd(27, " ");
        const qtyPart = String(item.qty).padStart(3, " ");
        return `${namePart}${qtyPart}\n`;
      }),
      "--------------------------------\n\n\n\n\n\x1D\x56\x41\x03" // 6. Cut paper
    ];

    await qz.print(config, printData);
  }, [qz, isConnected]);

  // Dispatch raw thermal sales receipt
  const printReceipt = useCallback(async (printerName: string, receipt: ReceiptPrintData) => {
    if (!qz || !isConnected) {
      throw new Error("Printer bridge is not connected.");
    }

    const config = qz.configs.create(printerName);

    // ESC/POS raw receipt layout
    const printData = [
      "\x1B\x40",             // Initialize
      "\x1B\x61\x01",         // Align center
      "\x1D\x21\x11",         // Double size text
      "JD SEKUWA HOUSE\n",
      "\x1D\x21\x00",         // Normal size
      "Lalitpur, Nepal\n",
      "--------------------------------\n",
      "\x1B\x61\x00",         // Align left
      `Invoice ID: ${receipt.id.slice(0, 8)}\n`,
      `Dining Table: ${receipt.tableName || "POS Quick"}\n`,
      receipt.tag ? `Guest Tag: ${receipt.tag}\n` : "",
      `Cashier Role: ${receipt.cashierName}\n`,
      `Mode: ${receipt.paymentType || "N/A"}\n`,
      `Closed At: ${receipt.closedAt ? new Date(receipt.closedAt).toLocaleString() : new Date(receipt.openedAt).toLocaleString()}\n`,
      "--------------------------------\n",
      "Item            Qty    Total(Rs)\n",
      "--------------------------------\n",
      ...receipt.items.map((item) => {
        const namePad = item.name.slice(0, 15).padEnd(16, " ");
        const qtyPad = String(item.qty).padStart(3, " ");
        const totalPad = String(item.total.toFixed(0)).padStart(11, " ");
        return `${namePad}${qtyPad}${totalPad}\n`;
      }),
      "--------------------------------\n",
      `Subtotal:       Rs. ${receipt.subtotal.toFixed(0)}\n`,
      `Discount:       Rs. -${receipt.discount.toFixed(0)}\n`,
      "--------------------------------\n",
      `Total Settled:  Rs. ${receipt.total.toFixed(0)}\n`,
      "--------------------------------\n",
      "\x1B\x61\x01",         // Align center
      "Thank you for dining with us!\n\n\n\n\n\x1D\x56\x41\x03" // Cut paper
    ];

    await qz.print(config, printData);
  }, [qz, isConnected]);

  return {
    isConnected,
    printers,
    printReceipt,
    printKot
  };
}
