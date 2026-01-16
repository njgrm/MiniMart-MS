/**
 * Christian Minimart - Smart Insight Engine
 * ==========================================
 * 
 * Algorithmic business insights that translate data into plain English advice.
 * No AI required - just smart, hard-coded rules.
 * 
 * Uses Lucide icon names (strings) for consistent UI rendering.
 */

import { subDays, startOfMonth, isSameMonth, format } from "date-fns";

// =============================================================================
// Types
// =============================================================================

export type InsightLevel = "CRITICAL" | "WARNING" | "INFO" | "SUCCESS";

/** Lucide icon names for type safety */
export type InsightIconName = 
  | "flame" 
  | "alert-triangle" 
  | "snowflake" 
  | "trending-up" 
  | "trending-down" 
  | "trophy" 
  | "package" 
  | "zap"
  | "clock"
  | "dollar-sign"
  | "shopping-cart"
  | "lightbulb";

export interface Insight {
  id: string;
  level: InsightLevel;
  icon: InsightIconName;  // Lucide icon name (no emojis)
  title: string;          // Concise category label
  message: string;        // Full written sentence explaining the data
  actionLabel?: string;   // Button text
  actionHref?: string;    // Link destination
  productId?: number;     // For product-specific insights
  productName?: string;
  productImage?: string | null; // Product image URL for visual context
  value?: number;         // Associated metric
  metadata?: Record<string, unknown>;
}

export interface SalesHistoryItem {
  date: string;
  productId: number;
  productName: string;
  category: string;
  quantity: number;
  subtotal: number;
}

export interface StockItem {
  product_id: number;
  product_name: string;
  category: string;
  stock: number;
  cost_price: number;
  retail_price: number;
  reorder_level: number;
}

export interface VelocityData {
  productId: number;
  productName: string;
  productImage?: string | null; // Product image URL
  category: string;
  currentStock: number;
  dailyVelocity: number;
  weeklyVelocity: number;
  lastWeekVelocity: number;
  velocityChange: number;  // % change week over week
  lastSaleDate: Date | null;
  daysSinceLastSale: number;
}

// =============================================================================
// Priority Sorting
// =============================================================================

const LEVEL_PRIORITY: Record<InsightLevel, number> = {
  CRITICAL: 0,
  WARNING: 1,
  SUCCESS: 2,
  INFO: 3,
};

// =============================================================================
// Insight Generation Algorithms
// =============================================================================

/**
 * Algorithm 1: Critical Stockout Detection
 * Identifies items where stock < (daily_velocity * 2)
 * These will run out in less than 2 days!
 */
function detectCriticalStockouts(velocityData: VelocityData[]): Insight[] {
  const insights: Insight[] = [];
  
  for (const item of velocityData) {
    if (item.dailyVelocity <= 0) continue;
    
    const daysOfStock = item.currentStock / item.dailyVelocity;
    
    if (daysOfStock < 2 && item.currentStock > 0) {
      insights.push({
        id: `stockout-${item.productId}`,
        level: "CRITICAL",
        icon: "flame",
        title: "Stockout Alert",
        message: `${item.productName} is selling ${item.dailyVelocity.toFixed(1)} units/day and will run out in approximately ${Math.max(1, Math.floor(daysOfStock))} day${Math.floor(daysOfStock) !== 1 ? 's' : ''}. Reorder immediately to avoid lost sales.`,
        actionLabel: "Order Stock",
        actionHref: `/admin/reports/velocity?search=${encodeURIComponent(item.productName)}`,
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        value: daysOfStock,
        metadata: { daysOfStock, dailyVelocity: item.dailyVelocity },
      });
    } else if (item.currentStock === 0 && item.dailyVelocity > 0) {
      insights.push({
        id: `out-of-stock-${item.productId}`,
        level: "CRITICAL",
        icon: "alert-triangle",
        title: "Out of Stock",
        message: `${item.productName} is completely out of stock but was averaging ${item.dailyVelocity.toFixed(1)} sales per day. You're losing revenue every hour this remains empty.`,
        actionLabel: "Emergency Order",
        actionHref: `/admin/reports/velocity?search=${encodeURIComponent(item.productName)}`,
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        value: 0,
        metadata: { dailyVelocity: item.dailyVelocity },
      });
    }
  }
  
  return insights;
}

/**
 * Algorithm 2: Dead Inventory Detection
 * Identifies items with stock > 0 but 0 sales in last 30 days
 * This is frozen cash sitting on your shelves!
 */
function detectDeadInventory(velocityData: VelocityData[]): Insight[] {
  const insights: Insight[] = [];
  
  for (const item of velocityData) {
    if (item.currentStock > 0 && item.daysSinceLastSale >= 30) {
      const frozenCash = item.currentStock * 50; // Rough estimate
      
      insights.push({
        id: `dead-stock-${item.productId}`,
        level: "WARNING",
        icon: "snowflake",
        title: "Dead Stock Alert",
        message: `${item.productName} has ${item.currentStock} units sitting unsold for ${item.daysSinceLastSale} days. Consider running a clearance promo to free up shelf space and recover capital.`,
        actionLabel: "View Details",
        actionHref: `/admin/reports/velocity?search=${encodeURIComponent(item.productName)}`,
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        value: item.daysSinceLastSale,
        metadata: { 
          daysSinceLastSale: item.daysSinceLastSale, 
          currentStock: item.currentStock,
          estimatedFrozenCash: frozenCash,
          isDeadStock: true,
        },
      });
    }
  }
  
  return insights;
}

/**
 * Algorithm 3: Revenue Pacing
 * Compare sum(sales_this_month) vs sum(sales_last_month_same_day)
 */
function calculateRevenuePacing(
  thisMonthRevenue: number,
  lastMonthSameDayRevenue: number
): Insight | null {
  if (lastMonthSameDayRevenue === 0) return null;
  
  const percentChange = ((thisMonthRevenue - lastMonthSameDayRevenue) / lastMonthSameDayRevenue) * 100;
  const isAhead = percentChange >= 0;
  const absChange = Math.abs(percentChange);
  
  // Don't show if change is negligible (<1%)
  if (absChange < 1) return null;
  
  const formattedRevenue = new Intl.NumberFormat('en-PH', { 
    style: 'currency', 
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  }).format(thisMonthRevenue);
  
  return {
    id: "revenue-pacing",
    level: isAhead ? (absChange > 10 ? "SUCCESS" : "INFO") : "WARNING",
    icon: isAhead ? "trending-up" : "trending-down",
    title: isAhead ? "Revenue Ahead" : "Revenue Behind",
    message: isAhead 
      ? `This month's revenue (${formattedRevenue}) is tracking ${absChange.toFixed(1)}% ahead of last month's pace. Keep the momentum going!`
      : `Revenue is currently ${absChange.toFixed(1)}% behind last month's pace at this point. Consider promotions to boost sales.`,
    actionLabel: "View Financials",
    actionHref: "/admin/reports",
    value: percentChange,
    metadata: { thisMonthRevenue, lastMonthSameDayRevenue },
  };
}

/**
 * Algorithm 4: Hero Product Detection
 * Identifies the item with the highest % increase in velocity week-over-week
 */
function detectHeroProduct(velocityData: VelocityData[]): Insight | null {
  // Filter to items with meaningful sales this week AND last week (to calculate real growth)
  const withGrowth = velocityData.filter(
    item => item.weeklyVelocity > 5 && item.lastWeekVelocity > 0 && item.velocityChange > 20
  );
  
  if (withGrowth.length === 0) return null;
  
  // Sort by velocity change (highest first)
  withGrowth.sort((a, b) => b.velocityChange - a.velocityChange);
  const hero = withGrowth[0];
  
  return {
    id: `hero-product-${hero.productId}`,
    level: "SUCCESS",
    icon: "trophy",
    title: "Top Performer",
    message: `${hero.productName} is your star this week with sales up ${hero.velocityChange.toFixed(0)}% compared to last week. Make sure to keep it well-stocked to capitalize on the demand.`,
    actionLabel: "View Velocity",
    actionHref: `/admin/reports/velocity?search=${encodeURIComponent(hero.productName)}`,
    productId: hero.productId,
    productName: hero.productName,
    productImage: hero.productImage,
    value: hero.velocityChange,
    metadata: { 
      weeklyVelocity: hero.weeklyVelocity, 
      lastWeekVelocity: hero.lastWeekVelocity,
    },
  };
}

/**
 * Algorithm 5: Slow Mover Alert
 * Products with declining velocity (>30% drop)
 */
function detectSlowMovers(velocityData: VelocityData[]): Insight[] {
  const insights: Insight[] = [];
  
  const declining = velocityData.filter(
    item => item.lastWeekVelocity > 5 && item.velocityChange < -30
  );
  
  // Only show top 1 declining item to avoid clutter
  if (declining.length > 0) {
    declining.sort((a, b) => a.velocityChange - b.velocityChange);
    const worst = declining[0];
    
    insights.push({
      id: `slow-mover-${worst.productId}`,
      level: "WARNING",
      icon: "trending-down",
      title: "Declining Sales",
      message: `${worst.productName} sales have dropped ${Math.abs(worst.velocityChange).toFixed(0)}% compared to last week. Investigate if pricing, placement, or competition is affecting demand.`,
      actionLabel: "Investigate",
      actionHref: `/admin/reports/velocity?search=${encodeURIComponent(worst.productName)}`,
      productId: worst.productId,
      productName: worst.productName,
      productImage: worst.productImage,
      value: worst.velocityChange,
    });
  }
  
  return insights;
}

// =============================================================================
// Main Export
// =============================================================================

export interface InsightGeneratorInput {
  velocityData: VelocityData[];
  thisMonthRevenue: number;
  lastMonthSameDayRevenue: number;
}

/**
 * Generate all business insights from sales and stock data.
 * Insights are automatically sorted by priority (CRITICAL first).
 */
export function generateBusinessInsights(input: InsightGeneratorInput): Insight[] {
  const { velocityData, thisMonthRevenue, lastMonthSameDayRevenue } = input;
  
  const insights: Insight[] = [];
  
  // 1. Critical stockouts (highest priority)
  insights.push(...detectCriticalStockouts(velocityData));
  
  // 2. Dead inventory
  insights.push(...detectDeadInventory(velocityData));
  
  // 3. Revenue pacing
  const revenuePacing = calculateRevenuePacing(thisMonthRevenue, lastMonthSameDayRevenue);
  if (revenuePacing) insights.push(revenuePacing);
  
  // 4. Hero product
  const heroProduct = detectHeroProduct(velocityData);
  if (heroProduct) insights.push(heroProduct);
  
  // 5. Slow movers
  insights.push(...detectSlowMovers(velocityData));
  
  // Sort by priority (CRITICAL first, then WARNING, SUCCESS, INFO)
  insights.sort((a, b) => LEVEL_PRIORITY[a.level] - LEVEL_PRIORITY[b.level]);
  
  // Return all insights sorted by priority
  return insights;
}

/**
 * Get a fallback insight when no data is available
 */
export function getDefaultInsight(): Insight {
  return {
    id: "welcome",
    level: "INFO",
    icon: "lightbulb",
    title: "Getting Started",
    message: "Start recording sales to see personalized business insights here. The more data you collect, the smarter your recommendations will become.",
    actionLabel: "Go to POS",
    actionHref: "/admin/pos",
  };
}
