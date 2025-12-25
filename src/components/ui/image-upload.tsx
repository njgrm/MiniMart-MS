"use client";

import * as React from "react";
import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, X, ImageIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ImageUploadProps {
  /** Callback when a file is selected or removed */
  onChange: (file: File | null) => void;
  /** Current image URL (for edit mode) or blob URL for preview */
  value?: string | null;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Custom className for the container */
  className?: string;
  /** Maximum file size in bytes (default: 5MB) */
  maxSize?: number;
  /** Accepted file types */
  accept?: Record<string, string[]>;
}

/**
 * ImageUpload - A reusable drag-and-drop image upload component
 * 
 * @example
 * ```tsx
 * <ImageUpload
 *   value={imageUrl}
 *   onChange={(file) => setFile(file)}
 * />
 * ```
 */
export function ImageUpload({
  onChange,
  value,
  disabled = false,
  className,
  maxSize = 5 * 1024 * 1024, // 5MB default
  accept = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
  },
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set preview from value prop (edit mode)
  useEffect(() => {
    if (value) {
      setPreview(value);
    }
  }, [value]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: { errors: { message: string }[] }[]) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        const errorMessage = rejectedFiles[0].errors[0]?.message || "Invalid file";
        setError(errorMessage);
        return;
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        
        // Revoke previous blob URL if exists
        if (preview && preview.startsWith("blob:")) {
          URL.revokeObjectURL(preview);
        }

        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        setPreview(previewUrl);
        onChange(file);
      }
    },
    [onChange, preview]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
    disabled,
  });

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      
      // Revoke blob URL if exists
      if (preview && preview.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
      
      setPreview(null);
      setError(null);
      onChange(null);
    },
    [onChange, preview]
  );

  const formatMaxSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb}MB`;
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden",
          "min-h-[160px]",
          // Base styles
          "bg-muted/30 border-border hover:bg-muted/50 hover:border-primary/50",
          // Drag active styles
          isDragActive && !isDragReject && "bg-primary/5 border-primary",
          // Drag reject styles
          isDragReject && "bg-destructive/5 border-destructive",
          // Disabled styles
          disabled && "opacity-50 cursor-not-allowed hover:bg-muted/30 hover:border-border",
          // Has preview
          preview && "border-solid border-border"
        )}
      >
        <input {...getInputProps()} />

        {preview ? (
          // Image Preview State
          <div className="relative w-full h-full min-h-[160px] flex items-center justify-center p-2">
            <div className="relative w-full h-40 rounded-md overflow-hidden bg-muted">
              <Image
                src={preview}
                alt="Preview"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            
            {/* Remove Button */}
            {!disabled && (
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-warm-md"
                onClick={handleRemove}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove image</span>
              </Button>
            )}
          </div>
        ) : (
          // Empty State
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full mb-3 transition-colors",
                isDragActive && !isDragReject
                  ? "bg-primary/10 text-primary"
                  : isDragReject
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isDragReject ? (
                <X className="h-6 w-6" />
              ) : (
                <UploadCloud className="h-6 w-6" />
              )}
            </div>

            <p
              className={cn(
                "text-sm font-medium mb-1 transition-colors",
                isDragActive && !isDragReject
                  ? "text-primary"
                  : isDragReject
                  ? "text-destructive"
                  : "text-foreground"
              )}
            >
              {isDragActive
                ? isDragReject
                  ? "File type not accepted"
                  : "Drop your image here"
                : "Drag & drop an image here, or click to select"}
            </p>

            <p className="text-xs text-muted-foreground">
              JPG, PNG, WebP up to {formatMaxSize(maxSize)}
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 flex items-center gap-1.5 text-sm text-destructive">
          <ImageIcon className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}


































