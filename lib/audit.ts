import { prisma } from "./db";

type AuditInput = {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  actorName: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  ipAddress?: string;
  userAgent?: string;
};

export async function writeAudit(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId ?? null,
      actorName: input.actorName,
      beforeJson: input.before ? JSON.parse(JSON.stringify(input.before)) : undefined,
      afterJson: input.after ? JSON.parse(JSON.stringify(input.after)) : undefined,
      metadataJson: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
      ipAddress: input.ipAddress ?? "127.0.0.1",
      userAgent: input.userAgent ?? "Maverick-Hub/1.0",
    },
  });
}
