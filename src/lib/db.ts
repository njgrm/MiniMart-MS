import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * ⚡ Optimized Prisma Client Configuration
 * 
 * - Uses connection pooling via DATABASE_URL params
 * - Query logging in development for debugging slow queries
 * - Single instance pattern to prevent connection exhaustion
 * 
 * Add these to your DATABASE_URL for connection pooling:
 * ?connection_limit=10&pool_timeout=20
 */
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "stdout", level: "warn" },
            { emit: "stdout", level: "error" },
            // Uncomment to debug slow queries:
            // { emit: "stdout", level: "query" },
          ]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;