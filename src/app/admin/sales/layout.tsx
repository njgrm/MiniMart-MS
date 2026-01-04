"use client";

/**
 * Sales Layout - Simple pass-through layout (no tabs)
 */
export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full flex flex-col">
      {children}
    </div>
  );
}







