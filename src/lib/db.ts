import { PrismaClient } from "@prisma/client";

// Em desenvolvimento o Next reinicia módulos (HMR); garantir um único
// PrismaClient evita estourar conexões do banco.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
