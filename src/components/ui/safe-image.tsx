"use client";

import React, { useState, useCallback } from "react";
import Image, { ImageProps } from "next/image";
import { cn } from "@/lib/utils";
import { ImageOff, Package } from "lucide-react";

interface SafeImageProps extends Omit<ImageProps, "onError"> {
  /** Fallback icon to show when image fails to load */
  fallbackIcon?: "package" | "image-off" | "none";
  /** Custom fallback content */
  fallbackContent?: React.ReactNode;
  /** Class name for the fallback container */
  fallbackClassName?: string;
  /** Whether to show a loading skeleton */
  showSkeleton?: boolean;
}

/**
 * SafeImage - A wrapper around Next.js Image that handles offline scenarios gracefully.
 * 
 * Features:
 * - Graceful fallback when images fail to load (network errors, offline mode)
 * - Automatic detection of external URLs and applies unoptimized prop
 * - Loading skeleton support
 * - Custom fallback icons/content
 * 
 * @example
 * <SafeImage
 *   src={product.image_url}
 *   alt={product.name}
 *   width={40}
 *   height={40}
 *   fallbackIcon="package"
 * />
 */
export function SafeImage({
  src,
  alt,
  className,
  fallbackIcon = "package",
  fallbackContent,
  fallbackClassName,
  showSkeleton = false,
  ...props
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Detect if URL is external (not localhost or relative)
  const isExternalUrl = typeof src === "string" && 
    (src.startsWith("http://") || src.startsWith("https://")) &&
    !src.includes("localhost") &&
    !src.includes("127.0.0.1");

  // If no src or has error, show fallback
  if (!src || hasError) {
    if (fallbackContent) {
      return <>{fallbackContent}</>;
    }

    const FallbackIcon = fallbackIcon === "package" ? Package : ImageOff;

    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-muted",
          fallbackClassName || className
        )}
        style={{ 
          width: typeof props.width === "number" ? props.width : undefined,
          height: typeof props.height === "number" ? props.height : undefined,
        }}
      >
        {fallbackIcon !== "none" && (
          <FallbackIcon className="h-1/2 w-1/2 text-muted-foreground/50" />
        )}
      </div>
    );
  }

  return (
    <>
      {showSkeleton && isLoading && (
        <div 
          className={cn(
            "animate-pulse bg-muted absolute inset-0",
            className
          )}
        />
      )}
      <Image
        src={src}
        alt={alt}
        className={cn(
          className,
          isLoading && showSkeleton ? "opacity-0" : "opacity-100",
          "transition-opacity duration-200"
        )}
        onError={handleError}
        onLoad={handleLoad}
        // External URLs should be unoptimized to avoid fetch timeouts when offline
        unoptimized={isExternalUrl || props.unoptimized}
        {...props}
      />
    </>
  );
}

/**
 * ProductImage - Pre-configured SafeImage for product thumbnails
 */
export function ProductImage({
  src,
  alt,
  size = 40,
  className,
  ...props
}: {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
} & Omit<SafeImageProps, "src" | "alt" | "width" | "height" | "fallbackIcon">) {
  return (
    <div 
      className={cn(
        "rounded-md overflow-hidden bg-muted flex items-center justify-center flex-shrink-0",
        className
      )}
      style={{ width: size, height: size }}
    >
      <SafeImage
        src={src || ""}
        alt={alt}
        width={size}
        height={size}
        className="object-cover w-full h-full"
        fallbackIcon="package"
        {...props}
      />
    </div>
  );
}
