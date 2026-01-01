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
