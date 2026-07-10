import { Resend } from "resend";
import { superuserPrisma } from "../lib/prisma";
import { createAdminClient } from "../lib/supabase";
import { CreditStatus } from "../generated/prisma/client";

const resend = new Resend(process.env.RESEND_API_KEY || "re_mock_key");

/**
 * Shared helper to send email. Intercepts and logs to console in development
 * if RESEND_API_KEY is not configured or is a mock key.
 */
async function sendEmail({
  to,
  subject,
  html
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === "re_mock_key" || !apiKey.startsWith("re_")) {
    console.log(`[Email Mock Service] Sending email to: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`HTML Payload:\n${html}`);
    return { id: "mock_email_id_" + Math.random().toString(36).substring(2, 11) };
  }

  const response = await resend.emails.send({
    from: "JD Sekuwa RMS <noreply@jdsekuwahouse.com.np>",
    to,
    subject,
    html
  });

  if (response.error) {
    throw new Error(`Resend email delivery failed: ${response.error.message}`);
  }

  return response.data;
}

/**
 * Generates a Supabase auth recovery link and dispatches a password reset email via Resend.
 */
export async function sendPasswordResetEmail(email: string): Promise<any> {
  const supabase = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirectTo = `${siteUrl}/reset-password`;

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo
    }
  });

  if (error || !data?.properties?.action_link) {
    throw new Error(`Failed to generate password recovery link: ${error?.message || "Unknown error"}`);
  }

  const resetLink = data.properties.action_link;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Password Reset Request</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; color: #1a1a1a; padding: 24px; line-height: 1.6; }
        .container { max-width: 500px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 32px; border-radius: 12px; }
        .logo { font-size: 20px; font-weight: bold; color: #e8590c; margin-bottom: 24px; }
        .button { display: inline-block; background-color: #e8590c; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 16px; }
        .footer { font-size: 12px; color: #6b7280; margin-top: 32px; border-t: 1px solid #e5e7eb; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">JD Sekuwa House</div>
        <h2>Password Reset Request</h2>
        <p>Hello,</p>
        <p>We received a request to reset the password for your JD Sekuwa RMS account. Click the button below to proceed:</p>
        <a href="${resetLink}" class="button" target="_blank">Reset Password</a>
        <p style="margin-top: 24px; font-size: 13px; color: #6b7280;">If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
        <div class="footer">
          &copy; ${new Date().getFullYear()} JD Sekuwa House. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: email,
    subject: "Reset your JD Sekuwa RMS Password",
    html
  });
}

/**
 * Searches the inventory for ingredients below their minimum threshold and mails a low-stock report.
 */
export async function sendLowStockDigest(recipientEmail: string): Promise<any> {
  const rawItems = await superuserPrisma.rawItem.findMany({
    orderBy: { name: "asc" }
  });

  const lowStockItems = rawItems.filter(
    item => Number(item.currentStock) < Number(item.minThreshold)
  );

  if (lowStockItems.length === 0) {
    return { skipped: true, reason: "No items below min threshold" };
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Low Stock Inventory Alert</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; color: #1a1a1a; padding: 24px; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 32px; border-radius: 12px; }
        .header { margin-bottom: 24px; }
        .title { font-size: 22px; font-weight: bold; color: #dc2626; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
        th { background-color: #f7f7f8; font-weight: bold; }
        .warning { color: #dc2626; font-weight: bold; }
        .footer { font-size: 12px; color: #6b7280; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="title">Low Stock Alert Digest</div>
          <p>The following raw inventory items have fallen below their configured minimum safety stock thresholds:</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Current Stock</th>
              <th>Min Threshold</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            ${lowStockItems.map(item => `
              <tr>
                <td><strong>${item.name}</strong></td>
                <td class="warning">${Number(item.currentStock)}</td>
                <td>${Number(item.minThreshold)}</td>
                <td>${item.unit}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          &copy; ${new Date().getFullYear()} JD Sekuwa House. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: recipientEmail,
    subject: "Low Stock Inventory Digest Alert",
    html
  });
}

/**
 * Searches the ledger for pending or partial credits that are overdue and mails a report.
 */
export async function sendOverdueCreditDigest(recipientEmail: string): Promise<any> {
  const ledgers = await superuserPrisma.creditLedger.findMany({
    where: {
      status: { in: [CreditStatus.PENDING, CreditStatus.PARTIAL] },
      dueDate: { lt: new Date() }
    },
    include: {
      payments: true
    },
    orderBy: { dueDate: "asc" }
  });

  const overdueList = ledgers.map(ledger => {
    const paid = ledger.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const outstanding = Number(ledger.amount) - paid;
    return {
      customerName: ledger.customerName,
      phone: ledger.phone,
      dueDate: ledger.dueDate,
      amount: Number(ledger.amount),
      outstanding
    };
  }).filter(l => l.outstanding > 0);

  if (overdueList.length === 0) {
    return { skipped: true, reason: "No overdue credit ledgers found" };
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Overdue Credits Digest</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; color: #1a1a1a; padding: 24px; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 32px; border-radius: 12px; }
        .header { margin-bottom: 24px; }
        .title { font-size: 22px; font-weight: bold; color: #dc2626; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
        th { background-color: #f7f7f8; font-weight: bold; }
        .overdue { color: #dc2626; font-weight: bold; }
        .footer { font-size: 12px; color: #6b7280; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="title">Overdue Credits Digest</div>
          <p>The following customers have outstanding food/beverage or lodging credits that are past their payment due date:</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Phone</th>
              <th>Due Date</th>
              <th>Outstanding (NPR)</th>
            </tr>
          </thead>
          <tbody>
            ${overdueList.map(item => `
              <tr>
                <td><strong>${item.customerName}</strong></td>
                <td>${item.phone}</td>
                <td>${new Date(item.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                <td class="overdue">Rs. ${item.outstanding.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          &copy; ${new Date().getFullYear()} JD Sekuwa House. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: recipientEmail,
    subject: "Overdue Credit Customers Digest Alert",
    html
  });
}
