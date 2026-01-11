import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as currency with peso sign and comma separators
 * @param amount - The amount to format
 * @param showDecimals - Whether to show decimal places (default: true)
 * @returns Formatted currency string (e.g., "₱1,234.56")
 */
export function formatCurrency(amount: number, showDecimals: boolean = true): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return showDecimals ? "₱0.00" : "₱0";
  }
  
  const formatted = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount);
  
  return `₱${formatted}`;
}

/**
 * Format a number with comma separators (no currency symbol)
 * @param num - The number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string (e.g., "1,234" or "1,234.56")
 */
export function formatNumber(num: number, decimals: number = 0): string {
  if (num === null || num === undefined || isNaN(num)) {
    return decimals > 0 ? "0." + "0".repeat(decimals) : "0";
  }
  
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Generates a unique EAN-13 style barcode.
 * Format: 2 + timestamp(10) + checksum(1) = 13 digits
 * The "2" prefix indicates internal/store use.
 */
export function generateBarcode(): string {
  // Use timestamp + random for uniqueness
  const timestamp = Date.now().toString().slice(-10);
  const random = Math.floor(Math.random() * 10).toString();
  const base = "2" + timestamp + random; // 12 digits
  
  // Calculate EAN-13 check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(base[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  
  return base + checkDigit.toString();
}

/**
 * Convert a number of days to a human-readable format
 * @param days - Number of days to convert
 * @returns Human-readable string (e.g., "1 year 3 months 5 days" or "45 days")
 * 
 * Examples:
 * - 9999 days → "Over 27 years"
 * - 450 days → "1 year 2 months 25 days"
 * - 45 days → "1 month 15 days"
 * - 7 days → "7 days"
 * - 1 day → "1 day"
 */
export function formatDaysToHumanReadable(days: number): string {
  if (days === null || days === undefined || isNaN(days) || days < 0) {
    return "Unknown";
  }

  // Handle edge cases
  if (days === 0) return "Today";
  if (days === 1) return "1 day";

  // For very large numbers (like 9999), simplify to years
  if (days >= 9000) {
    return "Over 27 years";
  }

  const years = Math.floor(days / 365);
  const remainingAfterYears = days % 365;
  const months = Math.floor(remainingAfterYears / 30);
  const remainingDays = remainingAfterYears % 30;

  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  }

  if (months > 0) {
    parts.push(`${months} ${months === 1 ? "month" : "months"}`);
  }

  if (remainingDays > 0 && parts.length < 2) {
    // Only show days if we don't already have 2 parts (to keep it concise)
    parts.push(`${remainingDays} ${remainingDays === 1 ? "day" : "days"}`);
  }

  // If no parts (shouldn't happen), fall back to days
  if (parts.length === 0) {
    return `${days} days`;
  }

  return parts.join(" ");
}
