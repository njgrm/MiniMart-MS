import { getReturnsHistory } from "@/actions/inventory";
import { ReturnsClient } from "./returns-client";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const initialData = await getReturnsHistory("all", "all", 1, 20);
  
  return <ReturnsClient initialData={initialData} />;
}
