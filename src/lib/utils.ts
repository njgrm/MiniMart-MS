import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
