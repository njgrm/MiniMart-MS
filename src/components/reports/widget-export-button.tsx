"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface WidgetExportButtonProps {
  href: string;
  disabled?: boolean;
}

export function WidgetExportButton({ href, disabled = false }: WidgetExportButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs gap-1",
              disabled && "opacity-40 cursor-not-allowed"
            )}
            disabled={disabled}
            onClick={(e) => {
              if (!disabled) {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `${href}?export=xlsx`;
              }
            }}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {disabled ? "Nothing to export" : "Download Excel"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
