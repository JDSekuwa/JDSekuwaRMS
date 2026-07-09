import { prisma } from "../lib/prisma";

/**
 * Logs an administrative or transactional action to the database audit logs.
 * Accepts an optional transaction client `tx` to participate in active transaction blocks.
 */
export async function logAction(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  meta: Record<string, any> = {},
  tx?: any
): Promise<void> {
  const client = tx || prisma;
  
  await client.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      meta: meta || {},
    },
  });
}
