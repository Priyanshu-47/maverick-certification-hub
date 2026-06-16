import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function findRegistration(input: string, include?: Record<string, boolean | object>) {
  const reg = await prisma.registration.findFirst({
    where: { OR: [{ id: input }, { registrationCode: input }] },
    include: include as any,
  });
  return reg;
}
