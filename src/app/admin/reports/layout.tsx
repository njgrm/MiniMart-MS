import { ReportsLayoutClient } from "./layout-client";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ReportsLayoutClient>{children}</ReportsLayoutClient>;
}
