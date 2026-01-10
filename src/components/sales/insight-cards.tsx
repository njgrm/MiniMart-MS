"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Flame,
  AlertTriangle,
  Snowflake,
  TrendingUp,
  TrendingDown,
  Trophy,
  Package,
  Zap,
  Clock,
  DollarSign,
  ShoppingCart,
  Lightbulb,
  Bell,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { Insight, InsightLevel, InsightIconName } from "@/lib/insights";

// =============================================================================
// Icon Mapping
// =============================================================================

const ICON_MAP: Record<InsightIconName, LucideIcon> = {
  "flame": Flame,
  "alert-triangle": AlertTriangle,
  "snowflake": Snowflake,
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  "trophy": Trophy,
  "package": Package,
  "zap": Zap,
  "clock": Clock,
  "dollar-sign": DollarSign,
  "shopping-cart": ShoppingCart,
  "lightbulb": Lightbulb,
};

// =============================================================================
// Styling Configuration
// =============================================================================

const LEVEL_STYLES: Record<InsightLevel, {
  bg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  titleColor: string;
  buttonVariant: "destructive" | "default" | "secondary" | "outline";
}> = {
  CRITICAL: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800/50",
    iconBg: "bg-red-100 dark:bg-red-900/50",
    iconColor: "text-red-600 dark:text-red-400",
    titleColor: "text-red-700 dark:text-red-400",
    buttonVariant: "destructive",
  },
  WARNING: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800/50",
    iconBg: "bg-amber-100 dark:bg-amber-900/50",
    iconColor: "text-amber-600 dark:text-amber-400",
    titleColor: "text-amber-700 dark:text-amber-400",
    buttonVariant: "secondary",
  },
  SUCCESS: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800/50",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    titleColor: "text-emerald-700 dark:text-emerald-400",
    buttonVariant: "default",
  },
  INFO: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800/50",
    iconBg: "bg-blue-100 dark:bg-blue-900/50",
    iconColor: "text-blue-600 dark:text-blue-400",
    titleColor: "text-blue-700 dark:text-blue-400",
    buttonVariant: "outline",
  },
};

// =============================================================================
// Rich Text Parser - Renders **bold** and highlights numbers/product names
// =============================================================================

function parseRichText(message: string, level: InsightLevel): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let key = 0;
  
  // Pattern to match: **bold text**, product names, and numeric values with units
  // Bold: **text**
  // Numbers: digits with optional decimals, currency symbols, units like /day, %
  const regex = /(\*\*[^*]+\*\*)|(\d+\.?\d*\s*(?:units?|days?|%|\/day|hours?)?)|(\₱[\d,]+\.?\d*)/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(message)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++}>{message.slice(lastIndex, match.index)}</span>
      );
    }
    
    const [fullMatch] = match;
    
    if (fullMatch.startsWith("**") && fullMatch.endsWith("**")) {
      // Bold text - product names, actions - make them pop
      const text = fullMatch.slice(2, -2);
      parts.push(
        <span key={key++} className="font-bold text-foreground">
          {text}
        </span>
      );
    } else if (fullMatch.startsWith("₱")) {
      // Currency - always emerald and bold
      parts.push(
        <span key={key++} className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
          {fullMatch}
        </span>
      );
    } else {
      // Numbers with units - color based on level for emphasis, bold for pop
      const valueColor = level === "CRITICAL" 
        ? "text-red-600 dark:text-red-400" 
        : level === "WARNING" 
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground";
      parts.push(
        <span key={key++} className={cn("font-bold tabular-nums", valueColor)}>
          {fullMatch}
        </span>
      );
    }
    
    lastIndex = match.index + fullMatch.length;
  }
  
  // Add remaining text
  if (lastIndex < message.length) {
    parts.push(<span key={key++}>{message.slice(lastIndex)}</span>);
  }
  
  return parts.length > 0 ? parts : [message];
}

// =============================================================================
// Single Insight Card Component (Store Assistant Style - Simplified)
// =============================================================================

interface InsightCardProps {
  insight: Insight;
  className?: string;
}

export function InsightCard({ insight, className }: InsightCardProps) {
  const styles = LEVEL_STYLES[insight.level];
  const IconComponent = ICON_MAP[insight.icon] || Lightbulb;
  
  // Extract product name if available
  const productName = insight.productName || null;
  
  // Generate short, plain English issue text based on level
  const getShortIssue = () => {
    if (insight.level === "CRITICAL") {
      // Parse "run out in approximately X day" patterns
      const daysMatch = insight.message.match(/(\d+)\s*day/i);
      if (daysMatch) {
        const days = parseInt(daysMatch[1]);
        if (days <= 1) return "Empty in 1 day";
        return `Empty in ${days} days`;
      }
      if (insight.message.toLowerCase().includes("out of stock")) return "Out of stock now";
      return "Needs attention";
    }
    if (insight.level === "WARNING") {
      const daysMatch = insight.message.match(/(\d+)\s*day/i);
      if (daysMatch) {
        return `Low stock (${daysMatch[1]}d left)`;
      }
      if (insight.message.toLowerCase().includes("slow")) return "Slow-moving item";
      return "Monitor closely";
    }
    if (insight.level === "SUCCESS") {
      if (insight.message.toLowerCase().includes("top seller")) return "Top seller!";
      if (insight.message.toLowerCase().includes("trending")) return "Trending up";
      return "Performing well";
    }
    return "Info";
  };
  
  const shortIssue = getShortIssue();
  const issueColor = insight.level === "CRITICAL" 
    ? "text-red-600 dark:text-red-400" 
    : insight.level === "WARNING"
    ? "text-amber-600 dark:text-amber-400"
    : insight.level === "SUCCESS"
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-blue-600 dark:text-blue-400";
  
  // Determine action button text (simpler)
  const getActionText = () => {
    if (insight.level === "CRITICAL" || insight.level === "WARNING") {
      if (insight.actionLabel?.toLowerCase().includes("order") || insight.actionLabel?.toLowerCase().includes("restock")) {
        return "Restock";
      }
    }
    return insight.actionLabel || "View";
  };
  
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border p-3 transition-all duration-200",
        "hover:shadow-md",
        styles.bg,
        styles.border,
        className
      )}
    >
      {/* Simplified Card Layout */}
      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div className={cn(
          "flex-shrink-0 size-8 rounded-lg flex items-center justify-center",
          styles.iconBg
        )}>
          <IconComponent className={cn("size-4", styles.iconColor)} />
        </div>
        
        {/* Content - Simplified Hierarchy */}
        <div className="flex-1 min-w-0">
          {/* Product Name (Bold, Primary) */}
          {productName ? (
            <h4 className="font-bold text-sm text-foreground leading-tight truncate" title={productName}>
              {productName}
            </h4>
          ) : (
            <h4 className={cn("font-semibold text-xs leading-tight", styles.titleColor)}>
              {insight.title}
            </h4>
          )}
          
          {/* Short Issue (Color-coded) */}
          <p className={cn("text-xs font-semibold mt-0.5", issueColor)}>
            {shortIssue}
          </p>
        </div>
        
        {/* Inline Action Button */}
        {insight.actionLabel && insight.actionHref && (
          <Link href={insight.actionHref} className="shrink-0">
            <Button
              size="sm"
              variant={insight.level === "CRITICAL" ? "destructive" : "outline"}
              className={cn(
                "h-7 px-2.5 text-[10px] font-semibold",
                insight.level !== "CRITICAL" && styles.iconColor
              )}
            >
              {getActionText()}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Insight Cards Grid Component (Original - for full width display)
// =============================================================================

interface InsightCardsGridProps {
  insights: Insight[];
  className?: string;
}

export function InsightCardsGrid({ insights, className }: InsightCardsGridProps) {
  if (insights.length === 0) {
    return null;
  }
  
  return (
    <div className={cn("w-full", className)}>
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Smart Insights</h2>
        <span className="text-xs text-muted-foreground">• Actions you should take</span>
      </div>
      
      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Intelligence Feed Component (Scrollable Sidebar with Tabs)
// =============================================================================

interface IntelligenceFeedProps {
  insights: Insight[];
  className?: string;
  maxHeight?: string;
}

export function IntelligenceFeed({ insights, className, maxHeight = "h-[400px]" }: IntelligenceFeedProps) {
  const [activeTab, setActiveTab] = useState<"alerts" | "highlights">("alerts");
  
  // Split insights into alerts (Critical/Warning) and highlights (Success/Info)
  const { alerts, highlights } = useMemo(() => {
    const alerts = insights.filter(i => i.level === "CRITICAL" || i.level === "WARNING");
    const highlights = insights.filter(i => i.level === "SUCCESS" || i.level === "INFO");
    return { alerts, highlights };
  }, [insights]);
  
  const currentInsights = activeTab === "alerts" ? alerts : highlights;
  
  return (
    <div className={cn("bg-card rounded-xl border flex flex-col overflow-hidden", maxHeight, className)}>
      {/* Header with Tabs */}
      <div className="px-3 py-2.5 border-b shrink-0 bg-card">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="size-4 text-[#F59E0B]" />
          <h3 className="font-medium text-sm">Intelligence Feed</h3>
        </div>
        
        {/* Segmented Control Tabs */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab("alerts")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-md transition-colors font-medium",
              activeTab === "alerts"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bell className="size-3" />
            Attention Needed
            {alerts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-red-500 text-white">
                {alerts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("highlights")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-md transition-colors font-medium",
              activeTab === "highlights"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="size-3" />
            Highlights
            {highlights.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500 text-white">
                {highlights.length}
              </span>
            )}
          </button>
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div 
        className="flex-1 overflow-y-auto pr-1"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'hsl(var(--border)) transparent',
        }}
      >
        <div className="p-3 space-y-2">
          {currentInsights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              {activeTab === "alerts" ? (
                <>
                  <Bell className="size-10 mb-3 opacity-20" />
                  <p className="text-xs text-center font-medium">No alerts at this time</p>
                  <p className="text-[10px] text-center mt-1 text-muted-foreground/70">
                    All systems running smoothly.
                  </p>
                </>
              ) : (
                <>
                  <Sparkles className="size-10 mb-3 opacity-20" />
                  <p className="text-xs text-center font-medium">No highlights yet</p>
                  <p className="text-[10px] text-center mt-1 text-muted-foreground/70">
                    Keep selling to see positive trends.
                  </p>
                </>
              )}
            </div>
          ) : (
            currentInsights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
