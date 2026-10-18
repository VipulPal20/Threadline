import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & { __prisma?: PrismaClient };

export const db = globalForPrisma.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = db;
