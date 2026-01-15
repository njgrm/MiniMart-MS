import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * ⚡ Optimized Prisma Client Configuration
 * 
 * - Uses connection pooling via DATABASE_URL params
 * - Query logging in development for debugging slow queries
 * - Single instance pattern to prevent connection exhaustion
 * - Extended transaction timeout for batch operations
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
    // Increase transaction timeout for batch operations (30 seconds)
    transactionOptions: {
      maxWait: 10000, // 10s max wait to acquire connection
      timeout: 30000, // 30s transaction timeout (was 5s default)
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;