/**
 * Christian Minimart - Intelligence API
 * ======================================
 * 
 * RESTful API for external integrations (Zapier, Chatbots, Mobile Apps).
 * 
 * Endpoints:
 * - GET:  Product analysis (velocity, stock, forecast)
 * - POST: Event ingestion (log manufacturer campaigns, promos, etc.)
 * 
 * Authentication: API Key via Authorization header
 * Format: Authorization: Bearer <API_KEY>
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeProduct, getForecast, getReorderAlerts, EventSourceType } from "@/lib/forecasting";
import { z } from "zod";

// =============================================================================
// Configuration
// =============================================================================

// API Key validation (in production, use environment variable)
const API_KEY = process.env.INTELLIGENCE_API_KEY || "cm-erp-secret-key-2024";

// Rate limiting (simple in-memory, use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateEventSchema = z.object({
  name: z.string().min(1, "Event name is required").max(200),
  description: z.string().optional(),
  source: z.enum(["STORE_DISCOUNT", "MANUFACTURER_CAMPAIGN", "HOLIDAY"]),
  start_date: z.string().refine(val => !isNaN(Date.parse(val)), "Invalid start date"),
  end_date: z.string().refine(val => !isNaN(Date.parse(val)), "Invalid end date"),
  multiplier: z.number().min(1.0).max(10.0).optional().default(2.0),
  affected_brand: z.string().optional(),
  affected_category: z.string().optional(),
  products: z.array(z.union([z.string(), z.number()])).optional(), // Barcodes or product IDs
  created_by: z.string().optional().default("API/Chatbot"),
});

const QuerySchema = z.object({
  product: z.string().optional(), // Product name, barcode, or ID
  action: z.enum(["analyze", "forecast", "alerts", "events"]).optional().default("analyze"),
  limit: z.number().min(1).max(100).optional().default(10),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validate API Key
 */
function validateApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;
  
  const [type, key] = authHeader.split(" ");
  return type === "Bearer" && key === API_KEY;
}

/**
 * Simple rate limiting
 */
function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(clientId);
  
  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  limit.count++;
  return true;
}

/**
 * Get client identifier for rate limiting
 */
function getClientId(request: NextRequest): string {
  return request.headers.get("X-Forwarded-For") || 
         request.headers.get("X-Real-IP") || 
         "anonymous";
}

/**
 * Create JSON response with proper headers
 */
function jsonResponse(
  data: unknown, 
  status: number = 200,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-API-Version": "2.0",
      "X-Powered-By": "Christian Minimart ERP",
      ...headers,
    },
  });
}

/**
 * Find products by various identifiers
 */
async function findProducts(identifiers: (string | number)[]): Promise<number[]> {
  const productIds: number[] = [];
  
  for (const id of identifiers) {
    if (typeof id === "number") {
      productIds.push(id);
    } else {
      // Try to find by barcode or name
      const product = await prisma.product.findFirst({
        where: {
          OR: [
            { barcode: id },
            { product_name: { contains: id, mode: "insensitive" } },
          ],
        },
        select: { product_id: true },
      });
      
      if (product) {
        productIds.push(product.product_id);
      }
    }
  }
  
  return productIds;
}

// =============================================================================
// GET Handler - Product Analysis
// =============================================================================

/**
 * GET /api/intelligence
 * 
 * Query Parameters:
 * - product: Product name, barcode, or ID
 * - action: "analyze" | "forecast" | "alerts" | "events"
 * - limit: Number of results (for alerts/events)
 * 
 * Examples:
 * - GET /api/intelligence?product=Coca-Cola&action=analyze
 * - GET /api/intelligence?action=alerts&limit=5
 * - GET /api/intelligence?action=events
 */
export async function GET(request: NextRequest) {
  try {
    // Validate API Key
    if (!validateApiKey(request)) {
      return jsonResponse(
        { 
          success: false, 
          error: "Unauthorized", 
          message: "Invalid or missing API key. Use Authorization: Bearer <API_KEY>" 
        },
        401
      );
    }
    
    // Rate limiting
    const clientId = getClientId(request);
    if (!checkRateLimit(clientId)) {
      return jsonResponse(
        { 
          success: false, 
          error: "Rate limit exceeded", 
          message: "Too many requests. Please try again later." 
        },
        429
      );
    }
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      product: searchParams.get("product") || undefined,
      action: searchParams.get("action") || "analyze",
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 10,
    };
    
    const query = QuerySchema.parse(rawQuery);
    
    // Handle different actions
    switch (query.action) {
      case "analyze": {
        if (!query.product) {
          return jsonResponse(
            { 
              success: false, 
              error: "Missing parameter", 
              message: "Product identifier is required for analysis. Use ?product=<name|barcode|id>" 
            },
            400
          );
        }
        
        const analysis = await analyzeProduct(query.product);
        
        if (!analysis) {
          return jsonResponse(
            { 
              success: false, 
              error: "Not found", 
              message: `Product "${query.product}" not found` 
            },
            404
          );
        }
        
        return jsonResponse({
          success: true,
          data: analysis,
          timestamp: new Date().toISOString(),
        });
      }
      
      case "forecast": {
        if (!query.product) {
          return jsonResponse(
            { 
              success: false, 
              error: "Missing parameter", 
              message: "Product identifier is required for forecast. Use ?product=<name|barcode|id>" 
            },
            400
          );
        }
        
        // Find product
        const product = await prisma.product.findFirst({
          where: {
            OR: [
              { barcode: query.product },
              { product_name: { contains: query.product, mode: "insensitive" } },
              ...(isNaN(parseInt(query.product)) ? [] : [{ product_id: parseInt(query.product) }]),
            ],
          },
        });
        
        if (!product) {
          return jsonResponse(
            { 
              success: false, 
              error: "Not found", 
              message: `Product "${query.product}" not found` 
            },
            404
          );
        }
        
        const forecast = await getForecast({ productId: product.product_id });
        
        return jsonResponse({
          success: true,
          data: forecast,
          timestamp: new Date().toISOString(),
        });
      }
      
      case "alerts": {
        const alerts = await getReorderAlerts();
        
        return jsonResponse({
          success: true,
          data: {
            total: alerts.length,
            alerts: alerts.slice(0, query.limit),
          },
          timestamp: new Date().toISOString(),
        });
      }
      
      case "events": {
        const events = await prisma.eventLog.findMany({
          where: { is_active: true },
          orderBy: { start_date: "desc" },
          take: query.limit,
          include: {
            products: {
              include: {
                product: {
                  select: { product_id: true, product_name: true, barcode: true },
                },
              },
            },
          },
        });
        
        return jsonResponse({
          success: true,
          data: {
            total: events.length,
            events: events.map(e => ({
              id: e.id,
              name: e.name,
              description: e.description,
              source: e.source,
              startDate: e.start_date.toISOString(),
              endDate: e.end_date.toISOString(),
              multiplier: e.multiplier.toNumber(),
              affectedBrand: e.affected_brand,
              affectedCategory: e.affected_category,
              products: e.products.map(p => ({
                id: p.product.product_id,
                name: p.product.product_name,
                barcode: p.product.barcode,
              })),
              createdBy: e.created_by,
              createdAt: e.created_at.toISOString(),
            })),
          },
          timestamp: new Date().toISOString(),
        });
      }
      
      default:
        return jsonResponse(
          { 
            success: false, 
            error: "Invalid action", 
            message: "Supported actions: analyze, forecast, alerts, events" 
          },
          400
        );
    }
  } catch (error) {
    console.error("[Intelligence API] GET Error:", error);
    
    if (error instanceof z.ZodError) {
      return jsonResponse(
        { 
          success: false, 
          error: "Validation error", 
          details: error.issues 
        },
        400
      );
    }
    
    return jsonResponse(
      { 
        success: false, 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      },
      500
    );
  }
}

// =============================================================================
// POST Handler - Event Ingestion
// =============================================================================

/**
 * POST /api/intelligence
 * 
 * Create a new event (manufacturer campaign, store promo, holiday)
 * 
 * Body:
 * {
 *   "name": "Coke Christmas Commercial",
 *   "source": "MANUFACTURER_CAMPAIGN",
 *   "start_date": "2024-12-01",
 *   "end_date": "2024-12-15",
 *   "multiplier": 2.5,
 *   "affected_brand": "Coca-Cola",
 *   "products": ["4800016123456", "Coke Mismo"]
 * }
 * 
 * Use Cases:
 * - Chatbot: "Supplier said Coke has a TV ad next week"
 * - Zapier: Automated event creation from spreadsheet
 * - Manual: Admin logs upcoming promotion
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API Key
    if (!validateApiKey(request)) {
      return jsonResponse(
        { 
          success: false, 
          error: "Unauthorized", 
          message: "Invalid or missing API key. Use Authorization: Bearer <API_KEY>" 
        },
        401
      );
    }
    
    // Rate limiting
    const clientId = getClientId(request);
    if (!checkRateLimit(clientId)) {
      return jsonResponse(
        { 
          success: false, 
          error: "Rate limit exceeded", 
          message: "Too many requests. Please try again later." 
        },
        429
      );
    }
    
    // Parse and validate body
    const body = await request.json();
    const validatedData = CreateEventSchema.parse(body);
    
    // Validate date range
    const startDate = new Date(validatedData.start_date);
    const endDate = new Date(validatedData.end_date);
    
    if (endDate < startDate) {
      return jsonResponse(
        { 
          success: false, 
          error: "Validation error", 
          message: "End date must be after start date" 
        },
        400
      );
    }
    
    // Find affected products if specified
    let productIds: number[] = [];
    if (validatedData.products && validatedData.products.length > 0) {
      productIds = await findProducts(validatedData.products);
    }
    
    // If brand is specified but no products, find all products of that brand
    if (validatedData.affected_brand && productIds.length === 0) {
      const brandProducts = await prisma.product.findMany({
        where: {
          product_name: { contains: validatedData.affected_brand, mode: "insensitive" },
          is_archived: false,
        },
        select: { product_id: true },
      });
      productIds = brandProducts.map(p => p.product_id);
    }
    
    // Create the event
    const event = await prisma.eventLog.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        source: validatedData.source as EventSourceType,
        start_date: startDate,
        end_date: endDate,
        multiplier: validatedData.multiplier,
        affected_brand: validatedData.affected_brand,
        affected_category: validatedData.affected_category,
        created_by: validatedData.created_by,
        products: {
          create: productIds.map(productId => ({
            product_id: productId,
          })),
        },
      },
      include: {
        products: {
          include: {
            product: {
              select: { product_id: true, product_name: true, barcode: true },
            },
          },
        },
      },
    });
    
    return jsonResponse(
      {
        success: true,
        message: "Event created successfully",
        data: {
          id: event.id,
          name: event.name,
          description: event.description,
          source: event.source,
          startDate: event.start_date.toISOString(),
          endDate: event.end_date.toISOString(),
          multiplier: event.multiplier.toNumber(),
          affectedBrand: event.affected_brand,
          affectedCategory: event.affected_category,
          affectedProducts: event.products.map(p => ({
            id: p.product.product_id,
            name: p.product.product_name,
            barcode: p.product.barcode,
          })),
          createdBy: event.created_by,
          createdAt: event.created_at.toISOString(),
        },
        _links: {
          self: `/api/intelligence?action=events`,
          analyze: event.products.length > 0 
            ? `/api/intelligence?product=${event.products[0].product.product_id}&action=analyze`
            : null,
        },
      },
      201
    );
  } catch (error) {
    console.error("[Intelligence API] POST Error:", error);
    
    if (error instanceof z.ZodError) {
      return jsonResponse(
        { 
          success: false, 
          error: "Validation error", 
          details: error.issues 
        },
        400
      );
    }
    
    return jsonResponse(
      { 
        success: false, 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      },
      500
    );
  }
}

// =============================================================================
// DELETE Handler - Deactivate Event
// =============================================================================

/**
 * DELETE /api/intelligence
 * 
 * Deactivate an event by ID
 * 
 * Query: ?event_id=123
 */
export async function DELETE(request: NextRequest) {
  try {
    // Validate API Key
    if (!validateApiKey(request)) {
      return jsonResponse(
        { 
          success: false, 
          error: "Unauthorized", 
          message: "Invalid or missing API key" 
        },
        401
      );
    }
    
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("event_id");
    
    if (!eventId || isNaN(parseInt(eventId))) {
      return jsonResponse(
        { 
          success: false, 
          error: "Missing parameter", 
          message: "Event ID is required. Use ?event_id=<id>" 
        },
        400
      );
    }
    
    // Soft delete (deactivate) the event
    const event = await prisma.eventLog.update({
      where: { id: parseInt(eventId) },
      data: { is_active: false },
    });
    
    return jsonResponse({
      success: true,
      message: "Event deactivated successfully",
      data: { id: event.id, name: event.name },
    });
  } catch (error) {
    console.error("[Intelligence API] DELETE Error:", error);
    
    return jsonResponse(
      { 
        success: false, 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      },
      500
    );
  }
}
