"use client";

import React, { useEffect, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function rs(n: number) {
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PrintReportContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "daily";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const params = `startDate=${startDate}&endDate=${endDate}`;

  // Queries matching reports dashboard
  const daily = useQuery<any>({
    queryKey: ["print-report-daily"],
    queryFn: async () => {
      const r = await fetch("/api/reports/daily-sales");
      return r.json();
    },
    enabled: tab === "daily",
  });

  const sales = useQuery<any>({
    queryKey: ["print-report-sales", startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/reports/sales?${params}`);
      return r.json();
    },
    enabled: tab === "sales",
  });

  const cogs = useQuery<any>({
    queryKey: ["print-report-cogs", startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/reports/cogs?${params}`);
      return r.json();
    },
    enabled: tab === "cogs",
  });

  const items = useQuery<any>({
    queryKey: ["print-report-items", startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/reports/item-wise-sales?${params}`);
      return r.json();
    },
    enabled: tab === "items",
  });

  const purchases = useQuery<any>({
    queryKey: ["print-report-purchases", startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/reports/purchases?${params}`);
      return r.json();
    },
    enabled: tab === "purchases",
  });

  const expenses = useQuery<any>({
    queryKey: ["print-report-expenses", startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/expenses?startDate=${startDate}&endDate=${endDate}&limit=500`);
      return r.json();
    },
    enabled: tab === "expenses",
  });

  const credit = useQuery<any>({
    queryKey: ["print-report-credit"],
    queryFn: async () => {
      const r = await fetch("/api/reports/credit-outstanding");
      return r.json();
    },
    enabled: tab === "credit",
  });

  const creditDetails = useQuery<any>({
    queryKey: ["print-report-credit-details"],
    queryFn: async () => {
      const r = await fetch("/api/credit/customers?limit=100");
      return r.json();
    },
    enabled: tab === "credit",
  });

  const rooms = useQuery<any>({
    queryKey: ["print-report-rooms", startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/reports/room-occupancy?${params}`);
      return r.json();
    },
    enabled: tab === "rooms",
  });

  const roomDetails = useQuery<any[]>({
    queryKey: ["print-report-room-details"],
    queryFn: async () => {
      const r = await fetch("/api/rooms");
      return r.json();
    },
    enabled: tab === "rooms",
  });

  const profit = useQuery<any>({
    queryKey: ["print-report-profit", startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/reports/profit-summary?${params}`);
      return r.json();
    },
    enabled: tab === "profit",
  });

  const isLoading =
    (tab === "daily" && daily.isLoading) ||
    (tab === "sales" && sales.isLoading) ||
    (tab === "cogs" && cogs.isLoading) ||
    (tab === "items" && items.isLoading) ||
    (tab === "purchases" && purchases.isLoading) ||
    (tab === "expenses" && expenses.isLoading) ||
    (tab === "credit" && (credit.isLoading || creditDetails.isLoading)) ||
    (tab === "rooms" && (rooms.isLoading || roomDetails.isLoading)) ||
    (tab === "profit" && profit.isLoading);

  const dataReady =
    (tab === "daily" && daily.data) ||
    (tab === "sales" && sales.data) ||
    (tab === "cogs" && cogs.data) ||
    (tab === "items" && items.data) ||
    (tab === "purchases" && purchases.data) ||
    (tab === "expenses" && expenses.data) ||
    (tab === "credit" && credit.data && creditDetails.data) ||
    (tab === "rooms" && rooms.data && roomDetails.data) ||
    (tab === "profit" && profit.data);

  useEffect(() => {
    if (dataReady && !isLoading) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [dataReady, isLoading]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-black">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-xs font-bold text-gray-500">Generating Accounting Ledger Document...</p>
        </div>
      </div>
    );
  }

  // Define tab name titles
  const reportTitles: Record<string, string> = {
    daily: "Daily Sales Summary Report",
    sales: "Sales Performance Report",
    cogs: "Cost of Goods Sold (COGS) Report",
    items: "Item-Wise Performance Report",
    purchases: "Acquisition Purchase Cost Report",
    expenses: "Operating Expenses Ledger (Non-Saleable Overhead)",
    credit: "Accounts Receivable Credit Ledger",
    rooms: "Room Occupancy & Status Report",
    profit: "Profit & Loss Income Statement",
  };

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white text-black font-sans leading-normal">
      {/* HEADER */}
      <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">JD Sekuwa House</h1>
          <p className="text-xs uppercase font-bold tracking-widest text-gray-500 mt-1">Restaurant Management System</p>
        </div>
        <div className="text-right">
          <h2 className="text-md font-bold uppercase">{reportTitles[tab]}</h2>
          <p className="text-[10px] text-gray-500 font-mono mt-1">
            Generated: {new Date().toLocaleString()}
          </p>
          {(startDate || endDate) && (
            <p className="text-[10px] text-gray-600 font-mono">
              Period: {startDate} to {endDate}
            </p>
          )}
        </div>
      </div>

      {/* BODY CONTENT */}

      {/* DAILY SALES SUMMARY */}
      {tab === "daily" && daily.data && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4 mb-4 border border-black p-4">
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Total Sales</span>
              <span className="text-sm font-bold font-mono">{rs(daily.data.totalSales)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Quick Sell</span>
              <span className="text-sm font-bold font-mono">{rs(daily.data.quickSales)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Table Dine-in</span>
              <span className="text-sm font-bold font-mono">{rs(daily.data.tableSales)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Room/Stay</span>
              <span className="text-sm font-bold font-mono">{rs(daily.data.roomSales)}</span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase mb-2">Today&apos;s Revenue Accounting Breakdown</h3>
            <table className="w-full border-collapse border border-black text-xs text-left">
              <thead>
                <tr className="border-b border-black bg-gray-100 font-bold uppercase">
                  <th className="border-r border-black p-2">Revenue Stream</th>
                  <th className="border-r border-black p-2 text-right">Accounting Code</th>
                  <th className="p-2 text-right">Amount (NPR)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-300">
                  <td className="border-r border-black p-2 font-semibold">POS Quick Sell Revenue</td>
                  <td className="border-r border-black p-2 text-right font-mono">REV-QSELL</td>
                  <td className="p-2 text-right font-mono">{rs(daily.data.quickSales)}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="border-r border-black p-2 font-semibold">Table Dine-in Revenue</td>
                  <td className="border-r border-black p-2 text-right font-mono">REV-TDINE</td>
                  <td className="p-2 text-right font-mono">{rs(daily.data.tableSales)}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border-r border-black p-2 font-semibold">Rooms Lodging Revenue</td>
                  <td className="border-r border-black p-2 text-right font-mono">REV-ROOM</td>
                  <td className="p-2 text-right font-mono">{rs(daily.data.roomSales)}</td>
                </tr>
                <tr className="font-bold bg-gray-200">
                  <td className="border-r border-black p-2">Total Gross Receipts</td>
                  <td className="border-r border-black p-2 text-right font-mono">REV-TOTAL</td>
                  <td className="p-2 text-right font-mono">{rs(daily.data.totalSales)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MONTHLY / MULTI-RANGE SALES */}
      {tab === "sales" && sales.data?.summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 mb-4 border border-black p-4">
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Overall Sales</span>
              <span className="text-sm font-bold font-mono">{rs(sales.data.summary.totalSales)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Overall Expenses</span>
              <span className="text-sm font-bold font-mono text-red-700">- {rs(sales.data.summary.totalExpenses)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Net Operating Balance</span>
              <span className="text-sm font-bold font-mono">{rs(sales.data.summary.netProfit)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4 border border-black p-4">
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Quick Sell Sales</span>
              <span className="text-sm font-bold font-mono">{rs(sales.data.summary.quickSales)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Table Dine-in Sales</span>
              <span className="text-sm font-bold font-mono">{rs(sales.data.summary.tableSales)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Room/Stay Sales</span>
              <span className="text-sm font-bold font-mono">{rs(sales.data.summary.roomSales)}</span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase mb-2">Revenue & Expense Accounting Breakdown</h3>
            <table className="w-full border-collapse border border-black text-xs text-left">
              <thead>
                <tr className="border-b border-black bg-gray-100 font-bold uppercase">
                  <th className="border-r border-black p-2">Financial Category / Stream</th>
                  <th className="border-r border-black p-2 text-right">Accounting Code</th>
                  <th className="border-r border-black p-2 text-right">Share / Ratio (%)</th>
                  <th className="p-2 text-right">Amount (NPR)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-300">
                  <td className="border-r border-black p-2 font-semibold">POS Quick Sell Revenue</td>
                  <td className="border-r border-black p-2 text-right font-mono">REV-QSELL</td>
                  <td className="border-r border-black p-2 text-right font-mono">
                    {sales.data.summary.totalSales > 0
                      ? `${((sales.data.summary.quickSales / sales.data.summary.totalSales) * 100).toFixed(1)}%`
                      : "0.0%"}
                  </td>
                  <td className="p-2 text-right font-mono">{rs(sales.data.summary.quickSales)}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="border-r border-black p-2 font-semibold">Table Dine-in Revenue</td>
                  <td className="border-r border-black p-2 text-right font-mono">REV-TDINE</td>
                  <td className="border-r border-black p-2 text-right font-mono">
                    {sales.data.summary.totalSales > 0
                      ? `${((sales.data.summary.tableSales / sales.data.summary.totalSales) * 100).toFixed(1)}%`
                      : "0.0%"}
                  </td>
                  <td className="p-2 text-right font-mono">{rs(sales.data.summary.tableSales)}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border-r border-black p-2 font-semibold">Rooms Lodging Revenue</td>
                  <td className="border-r border-black p-2 text-right font-mono">REV-ROOM</td>
                  <td className="border-r border-black p-2 text-right font-mono">
                    {sales.data.summary.totalSales > 0
                      ? `${((sales.data.summary.roomSales / sales.data.summary.totalSales) * 100).toFixed(1)}%`
                      : "0.0%"}
                  </td>
                  <td className="p-2 text-right font-mono">{rs(sales.data.summary.roomSales)}</td>
                </tr>
                <tr className="font-bold bg-gray-200 border-b border-black">
                  <td className="border-r border-black p-2">Total Gross Receipts</td>
                  <td className="border-r border-black p-2 text-right font-mono">REV-TOTAL</td>
                  <td className="border-r border-black p-2 text-right font-mono">100.0%</td>
                  <td className="p-2 text-right font-mono">{rs(sales.data.summary.totalSales)}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border-r border-black p-2 font-semibold">Purchases & Operational Expenses</td>
                  <td className="border-r border-black p-2 text-right font-mono">EXP-PURCH</td>
                  <td className="border-r border-black p-2 text-right font-mono">
                    {sales.data.summary.totalSales > 0
                      ? `${((sales.data.summary.totalExpenses / sales.data.summary.totalSales) * 100).toFixed(1)}%`
                      : "-"}
                  </td>
                  <td className="p-2 text-right font-mono text-red-700">- {rs(sales.data.summary.totalExpenses)}</td>
                </tr>
                <tr className="font-bold bg-gray-100">
                  <td className="border-r border-black p-2">Net Operating Balance</td>
                  <td className="border-r border-black p-2 text-right font-mono">NET-BALANCE</td>
                  <td className="border-r border-black p-2 text-right font-mono">
                    {sales.data.summary.totalSales > 0
                      ? `${((sales.data.summary.netProfit / sales.data.summary.totalSales) * 100).toFixed(1)}%`
                      : "0.0%"}
                  </td>
                  <td className="p-2 text-right font-mono">{rs(sales.data.summary.netProfit)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {sales.data.dailyBreakdown && sales.data.dailyBreakdown.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase mb-2">Day-by-Day Sales & Expense Ledger</h3>
              <table className="w-full border-collapse border border-black text-xs text-left">
                <thead>
                  <tr className="border-b border-black bg-gray-100 font-bold uppercase">
                    <th className="border-r border-black p-2">Date</th>
                    <th className="border-r border-black p-2 text-right">Quick Sell (NPR)</th>
                    <th className="border-r border-black p-2 text-right">Table Dine-in (NPR)</th>
                    <th className="border-r border-black p-2 text-right">Room Stay (NPR)</th>
                    <th className="border-r border-black p-2 text-right">Total Sales (NPR)</th>
                    <th className="border-r border-black p-2 text-right">Expenses (NPR)</th>
                    <th className="p-2 text-right">Net Balance (NPR)</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.data.dailyBreakdown.map((row: any) => (
                    <tr key={row.date} className="border-b border-gray-300">
                      <td className="border-r border-black p-2 font-mono font-medium">{row.date}</td>
                      <td className="border-r border-black p-2 text-right font-mono">{rs(row.quickSales)}</td>
                      <td className="border-r border-black p-2 text-right font-mono">{rs(row.tableSales)}</td>
                      <td className="border-r border-black p-2 text-right font-mono">{rs(row.roomSales)}</td>
                      <td className="border-r border-black p-2 text-right font-mono font-bold">{rs(row.totalSales)}</td>
                      <td className="border-r border-black p-2 text-right font-mono text-red-700">
                        {row.totalExpenses > 0 ? `- ${rs(row.totalExpenses)}` : rs(0)}
                      </td>
                      <td className="p-2 text-right font-mono font-bold">{rs(row.netProfit)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-gray-200 border-t border-black">
                    <td className="border-r border-black p-2">Total</td>
                    <td className="border-r border-black p-2 text-right font-mono">{rs(sales.data.summary.quickSales)}</td>
                    <td className="border-r border-black p-2 text-right font-mono">{rs(sales.data.summary.tableSales)}</td>
                    <td className="border-r border-black p-2 text-right font-mono">{rs(sales.data.summary.roomSales)}</td>
                    <td className="border-r border-black p-2 text-right font-mono">{rs(sales.data.summary.totalSales)}</td>
                    <td className="border-r border-black p-2 text-right font-mono text-red-700">- {rs(sales.data.summary.totalExpenses)}</td>
                    <td className="p-2 text-right font-mono">{rs(sales.data.summary.netProfit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* COGS */}
      {tab === "cogs" && cogs.data && (
        <div className="space-y-6">
          <div className="border border-black p-4 inline-block mb-4">
            <span className="text-[9px] uppercase font-bold text-gray-500 block">Total Cost of Goods Sold (COGS)</span>
            <span className="text-sm font-bold font-mono">{rs(cogs.data.totalCogs)}</span>
          </div>

          <table className="w-full border-collapse border border-black text-xs text-left">
            <thead>
              <tr className="border-b border-black bg-gray-100 font-bold uppercase">
                <th className="border-r border-black p-2">Menu Item Name</th>
                <th className="border-r border-black p-2 text-right">Unit Recipe Cost</th>
                <th className="border-r border-black p-2 text-right">Quantity Sold</th>
                <th className="p-2 text-right">Subtotal COGS (NPR)</th>
              </tr>
            </thead>
            <tbody>
              {cogs.data.items.map((item: any) => (
                <tr key={item.menuItemId} className="border-b border-gray-300">
                  <td className="border-r border-black p-2 font-semibold">{item.name}</td>
                  <td className="border-r border-black p-2 text-right font-mono">{rs(item.costPerUnit)}</td>
                  <td className="border-r border-black p-2 text-right font-mono">{item.qty}</td>
                  <td className="p-2 text-right font-mono font-bold text-red-700">{rs(item.subtotalCogs)}</td>
                </tr>
              ))}
              {cogs.data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500 italic">No items sold matching range.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ITEM-WISE SALES */}
      {tab === "items" && items.data && (
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-bold uppercase mb-2">Top 5 Best Sellers</h3>
            <table className="w-full border-collapse border border-black text-xs text-left">
              <thead>
                <tr className="border-b border-black bg-gray-100 font-bold uppercase">
                  <th className="border-r border-black p-2 w-12 text-center">Rank</th>
                  <th className="border-r border-black p-2">Item Name</th>
                  <th className="border-r border-black p-2 text-right">Quantity Sold</th>
                  <th className="p-2 text-right">Revenue (NPR)</th>
                </tr>
              </thead>
              <tbody>
                {items.data.bestSellers.map((item: any, idx: number) => (
                  <tr key={item.name} className="border-b border-gray-300">
                    <td className="border-r border-black p-2 text-center font-bold font-mono">{idx + 1}</td>
                    <td className="border-r border-black p-2 font-semibold">{item.name}</td>
                    <td className="border-r border-black p-2 text-right font-mono">{item.qty}</td>
                    <td className="p-2 text-right font-mono">{rs(item.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase mb-2">Top 5 Slow Movers</h3>
            <table className="w-full border-collapse border border-black text-xs text-left">
              <thead>
                <tr className="border-b border-black bg-gray-100 font-bold uppercase">
                  <th className="border-r border-black p-2 w-12 text-center">Rank</th>
                  <th className="border-r border-black p-2">Item Name</th>
                  <th className="border-r border-black p-2 text-right">Quantity Sold</th>
                  <th className="p-2 text-right">Revenue (NPR)</th>
                </tr>
              </thead>
              <tbody>
                {items.data.slowSellers.map((item: any, idx: number) => (
                  <tr key={item.name} className="border-b border-gray-300">
                    <td className="border-r border-black p-2 text-center font-bold font-mono">{idx + 1}</td>
                    <td className="border-r border-black p-2 font-semibold">{item.name}</td>
                    <td className="border-r border-black p-2 text-right font-mono">{item.qty}</td>
                    <td className="p-2 text-right font-mono">{rs(item.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PURCHASE COSTS */}
      {tab === "purchases" && purchases.data && (
        <div className="space-y-6">
          <div className="border border-black p-4 inline-block mb-4">
            <span className="text-[9px] uppercase font-bold text-gray-500 block">Total Purchase Costs</span>
            <span className="text-md font-bold font-mono">{rs(purchases.data.totalCost)}</span>
          </div>

          <table className="w-full border-collapse border border-black text-xs text-left">
            <thead>
              <tr className="border-b border-black bg-gray-100 font-bold uppercase">
                <th className="border-r border-black p-2">Ingredient/Supply Name</th>
                <th className="border-r border-black p-2 text-right">Quantity Acquired</th>
                <th className="p-2 text-right">Total Acquisition Cost (NPR)</th>
              </tr>
            </thead>
            <tbody>
              {purchases.data.items.map((item: any) => (
                <tr key={item.name} className="border-b border-gray-300">
                  <td className="border-r border-black p-2 font-semibold">{item.name}</td>
                  <td className="border-r border-black p-2 text-right font-mono">{Number(item.qty).toFixed(2)}</td>
                  <td className="p-2 text-right font-mono font-bold text-red-700">{rs(item.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* OPERATING EXPENSES */}
      {tab === "expenses" && expenses.data && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 mb-4 border border-black p-4">
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Total Operational Expenses</span>
              <span className="text-sm font-bold font-mono text-red-700">{rs(expenses.data.summary?.totalAmount || 0)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Total Transactions</span>
              <span className="text-sm font-bold font-mono">{expenses.data.pagination?.total || 0}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Classification</span>
              <span className="text-sm font-bold font-mono text-gray-700">Non-Saleable Overhead</span>
            </div>
          </div>

          <table className="w-full border-collapse border border-black text-xs text-left">
            <thead>
              <tr className="border-b border-black bg-gray-100 font-bold uppercase">
                <th className="border-r border-black p-2 font-mono">Date</th>
                <th className="border-r border-black p-2">Title / Description</th>
                <th className="border-r border-black p-2">Category</th>
                <th className="border-r border-black p-2 text-center">Payment</th>
                <th className="border-r border-black p-2">Vendor</th>
                <th className="border-r border-black p-2">Recorded By</th>
                <th className="p-2 text-right">Amount (NPR)</th>
              </tr>
            </thead>
            <tbody>
              {expenses.data.data?.map((exp: any) => (
                <tr key={exp.id} className="border-b border-gray-300">
                  <td className="border-r border-black p-2 font-mono">{exp.date ? exp.date.split("T")[0] : "-"}</td>
                  <td className="border-r border-black p-2 font-semibold">
                    {exp.title}
                    {exp.notes && <div className="text-[10px] text-gray-500">{exp.notes}</div>}
                  </td>
                  <td className="border-r border-black p-2">{exp.category?.name || "Uncategorized"}</td>
                  <td className="border-r border-black p-2 text-center font-mono">{exp.paymentType}</td>
                  <td className="border-r border-black p-2">{exp.vendor || "-"}</td>
                  <td className="border-r border-black p-2 text-gray-600">{exp.recordedBy?.username || "Admin"}</td>
                  <td className="p-2 text-right font-mono font-bold text-red-700">{rs(exp.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black font-bold bg-gray-50">
                <td colSpan={6} className="border-r border-black p-2 text-right uppercase">Total Operating Expenses</td>
                <td className="p-2 text-right font-mono font-bold text-red-700">{rs(expenses.data.summary?.totalAmount || 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* CREDIT OUTSTANDING */}
      {tab === "credit" && credit.data && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4 mb-4 border border-black p-4">
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Outstanding</span>
              <span className="text-sm font-bold font-mono">{rs(credit.data.totalOutstanding)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Overdue</span>
              <span className="text-sm font-bold font-mono text-red-700">{rs(credit.data.totalOverdue)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Written Off</span>
              <span className="text-sm font-bold font-mono">{rs(credit.data.totalWrittenOff)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Active Debtors</span>
              <span className="text-sm font-bold font-mono">{credit.data.activeCustomersCount}</span>
            </div>
          </div>

          <table className="w-full border-collapse border border-black text-xs text-left">
            <thead>
              <tr className="border-b border-black bg-gray-100 font-bold uppercase">
                <th className="border-r border-black p-2">Debtor/Customer Name</th>
                <th className="border-r border-black p-2 font-mono">Phone Number</th>
                <th className="border-r border-black p-2 text-center">Status</th>
                <th className="p-2 text-right">Outstanding Debt (NPR)</th>
              </tr>
            </thead>
            <tbody>
              {creditDetails.data?.data?.map((c: any) => (
                <tr key={c.phone} className="border-b border-gray-300">
                  <td className="border-r border-black p-2 font-semibold">{c.customerName}</td>
                  <td className="border-r border-black p-2 font-mono">{c.phone}</td>
                  <td className="border-r border-black p-2 text-center font-bold">
                    {c.isOverdue ? "OVERDUE" : "PENDING"}
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-red-700">{rs(c.totalOutstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ROOM OCCUPANCY */}
      {tab === "rooms" && rooms.data && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4 mb-4 border border-black p-4">
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Total Rooms</span>
              <span className="text-sm font-bold font-mono">{rooms.data.totalRooms}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Rooms Occupied</span>
              <span className="text-sm font-bold font-mono">{rooms.data.occupiedRoomsCount}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Nights Sold</span>
              <span className="text-sm font-bold font-mono">{rooms.data.totalNightsSold}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Room Revenue</span>
              <span className="text-sm font-bold font-mono">{rs(rooms.data.totalRoomRevenue)}</span>
            </div>
          </div>

          <table className="w-full border-collapse border border-black text-xs text-left">
            <thead>
              <tr className="border-b border-black bg-gray-100 font-bold uppercase">
                <th className="border-r border-black p-2">Room Identifier</th>
                <th className="border-r border-black p-2 text-center">Status</th>
                <th className="p-2 text-right">Nightly Rate (NPR)</th>
              </tr>
            </thead>
            <tbody>
              {roomDetails.data?.map((r: any) => (
                <tr key={r.id} className="border-b border-gray-300">
                  <td className="border-r border-black p-2 font-semibold">{r.name}</td>
                  <td className="border-r border-black p-2 text-center font-bold">{r.status}</td>
                  <td className="p-2 text-right font-mono">{rs(Number(r.nightlyRate || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PROFIT SUMMARY */}
      {tab === "profit" && profit.data && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4 mb-4 border border-black p-4">
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Total Revenue</span>
              <span className="text-sm font-bold font-mono">{rs(profit.data.totalSales)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Cost of Goods Sold (COGS)</span>
              <span className="text-sm font-bold font-mono">{rs(profit.data.cogs)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Gross Profit</span>
              <span className="text-sm font-bold font-mono">{rs(profit.data.grossProfit)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-500 block">Net Profit</span>
              <span className="text-sm font-bold font-mono">{rs(profit.data.netProfit)}</span>
            </div>
          </div>

          <table className="w-full border-collapse border border-black text-xs text-left">
            <thead>
              <tr className="border-b border-black bg-gray-100 font-bold uppercase">
                <th className="border-r border-black p-2">Financial Item Line</th>
                <th className="border-r border-black p-2 text-right">Accounting Code</th>
                <th className="p-2 text-right">Amount (NPR)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-300">
                <td className="border-r border-black p-2 font-semibold">Gross Operating Revenue</td>
                <td className="border-r border-black p-2 text-right font-mono">PL-REV</td>
                <td className="p-2 text-right font-mono font-bold text-green-700">{rs(profit.data.totalSales)}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="border-r border-black p-2 font-semibold">Cost of Goods Sold (COGS)</td>
                <td className="border-r border-black p-2 text-right font-mono">PL-COGS</td>
                <td className="p-2 text-right font-mono font-bold text-red-700">- {rs(profit.data.cogs)}</td>
              </tr>
              <tr className="border-b border-black bg-gray-100 font-bold">
                <td className="border-r border-black p-2">Gross Operating Profit</td>
                <td className="border-r border-black p-2 text-right font-mono">PL-GPROFIT</td>
                <td className="p-2 text-right font-mono">{rs(profit.data.grossProfit)}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="border-r border-black p-2 font-semibold">Gross Margin (%)</td>
                <td className="border-r border-black p-2 text-right font-mono">PL-GMARGIN</td>
                <td className="p-2 text-right font-mono font-bold">
                  {profit.data.totalSales > 0
                    ? `${((profit.data.grossProfit / profit.data.totalSales) * 100).toFixed(2)}%`
                    : "0.00%"}
                </td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="border-r border-black p-2 font-semibold">Operating Losses (Write-offs)</td>
                <td className="border-r border-black p-2 text-right font-mono">PL-LOSS</td>
                <td className="p-2 text-right font-mono font-bold text-red-700">- {rs(profit.data.writeOffs)}</td>
              </tr>
              <tr className="border-b border-black bg-gray-100 font-bold">
                <td className="border-r border-black p-2">Net Profit</td>
                <td className="border-r border-black p-2 text-right font-mono">PL-NPROFIT</td>
                <td className="p-2 text-right font-mono font-bold">{rs(profit.data.netProfit)}</td>
              </tr>
              <tr className="font-bold bg-gray-200">
                <td className="border-r border-black p-2">Net Margin (%)</td>
                <td className="border-r border-black p-2 text-right font-mono">PL-NMARGIN</td>
                <td className="p-2 text-right font-mono">
                  {profit.data.totalSales > 0
                    ? `${((profit.data.netProfit / profit.data.totalSales) * 100).toFixed(2)}%`
                    : "0.00%"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* FOOTER */}
      <div className="border-t border-gray-300 pt-4 mt-12 text-center text-[10px] text-gray-500 font-mono">
        JD Sekuwa House Restaurant Management System &bull; Confidential Business Document
      </div>
    </div>
  );
}

export default function PrintReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-white text-black">
          <div className="text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-xs font-bold text-gray-500">Generating Accounting Ledger Document...</p>
          </div>
        </div>
      }
    >
      <PrintReportContent />
    </Suspense>
  );
}
