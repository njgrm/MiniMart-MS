"use client";

import { useEffect } from "react";
import { usePageHeader } from "@/contexts/page-header-context";

interface PageHeaderProps {
  title: string;
  description: string;
}

/**
 * Component to set the page header in the top navigation.
 * Place this at the top of each page component.
 */
export function PageHeader({ title, description }: PageHeaderProps) {
  const { setHeader } = usePageHeader();

  useEffect(() => {
    setHeader(title, description);
  }, [title, description, setHeader]);

  return null;
}


