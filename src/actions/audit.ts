"use server";

import { prisma } from "@/lib/db";
import { AuditAction, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

// =============================================================================
// Types
// =============================================================================

export interface CreateAuditLogInput {
  userId?: number;
  username: string;
  action: AuditAction;
  entityType: string;
  entityId?: number;
  entityName: string;
  details: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  username: string;
  action: AuditAction;
  module: string | null;
  entity_type: string;
  entity_id: number | null;
  entity_name: string;
  details: string;
  metadata: unknown;
  ip_address: string | null;
  created_at: Date;
}

export interface AuditLogFilters {
  action?: AuditAction;
  module?: string;
  entityType?: string;
  username?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Create a new audit log entry
 * This should be called from other server actions when admin changes occur
 */
export async function createAuditLog(input: CreateAuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: input.userId ?? null,
        username: input.username,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        entity_name: input.entityName,
        details: input.details,
        metadata: input.metadata ? input.metadata as Prisma.InputJsonValue : Prisma.JsonNull,
        ip_address: input.ipAddress ?? null,
      },
    });
  } catch (error) {
    // Don't throw - audit logging should never break the main operation
    console.error("[AuditLog] Failed to create audit log:", error);
  }
}

/**
 * Get audit logs with filtering and pagination
 */
export async function getAuditLogs(
  filters?: AuditLogFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<{ logs: AuditLogEntry[]; total: number; pages: number }> {
  try {
    // Build where clause
    const where: Prisma.AuditLogWhereInput = {};

    if (filters?.action) {
      where.action = filters.action;
    }

    if (filters?.module) {
      where.module = filters.module;
    }

    if (filters?.entityType) {
      where.entity_type = filters.entityType;
    }

    if (filters?.username) {
      where.username = { contains: filters.username, mode: "insensitive" };
    }

    if (filters?.startDate || filters?.endDate) {
      where.created_at = {};
      if (filters.startDate) {
        where.created_at.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.created_at.lte = filters.endDate;
      }
    }

    if (filters?.search) {
      where.OR = [
        { entity_name: { contains: filters.search, mode: "insensitive" } },
        { details: { contains: filters.search, mode: "insensitive" } },
        { username: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Get total count
    const total = await prisma.auditLog.count({ where });

    // Get paginated results
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      logs: logs.map((log) => ({
        id: log.id,
        user_id: log.user_id,
        username: log.username,
        action: log.action,
        module: log.module,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        entity_name: log.entity_name,
        details: log.details,
        metadata: log.metadata,
        ip_address: log.ip_address,
        created_at: log.created_at,
      })),
      total,
      pages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    console.error("[AuditLog] Failed to fetch audit logs:", error);
    return { logs: [], total: 0, pages: 0 };
  }
}

/**
 * Get distinct entity types for filter dropdown
 */
export async function getAuditLogEntityTypes(): Promise<string[]> {
  try {
    const types = await prisma.auditLog.findMany({
      select: { entity_type: true },
      distinct: ["entity_type"],
      orderBy: { entity_type: "asc" },
    });
    return types.map((t) => t.entity_type);
  } catch (error) {
    console.error("[AuditLog] Failed to fetch entity types:", error);
    return [];
  }
}

/**
 * Get distinct usernames for filter dropdown
 */
export async function getAuditLogUsernames(): Promise<string[]> {
  try {
    const users = await prisma.auditLog.findMany({
      select: { username: true },
      distinct: ["username"],
      orderBy: { username: "asc" },
    });
    return users.map((u) => u.username);
  } catch (error) {
    console.error("[AuditLog] Failed to fetch usernames:", error);
    return [];
  }
}

/**
 * Get distinct modules for filter dropdown
 */
export async function getAuditLogModules(): Promise<string[]> {
  try {
    const modules = await prisma.auditLog.findMany({
      select: { module: true },
      distinct: ["module"],
      where: { module: { not: null } },
      orderBy: { module: "asc" },
    });
    return modules.map((m) => m.module).filter((m): m is string => m !== null);
  } catch (error) {
    console.error("[AuditLog] Failed to fetch modules:", error);
    return [];
  }
}
