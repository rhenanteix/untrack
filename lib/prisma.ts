import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL)
    throw new Error("Configure DATABASE_URL para os recursos de conta.");
  globalForPrisma.prisma ??= new PrismaClient();
  return globalForPrisma.prisma;
}
