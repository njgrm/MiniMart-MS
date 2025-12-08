"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface PageHeaderState {
  title: string;
  description: string;
}

interface PageHeaderContextType {
  header: PageHeaderState;
  setHeader: (title: string, description: string) => void;
}

const PageHeaderContext = createContext<PageHeaderContextType | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<PageHeaderState>({
    title: "Dashboard",
    description: "Welcome back! Here's an overview of your store.",
  });

  const setHeader = useCallback((title: string, description: string) => {
    setHeaderState({ title, description });
  }, []);

  return (
    <PageHeaderContext.Provider value={{ header, setHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader() {
  const context = useContext(PageHeaderContext);
  if (!context) {
    throw new Error("usePageHeader must be used within a PageHeaderProvider");
  }
  return context;
}


