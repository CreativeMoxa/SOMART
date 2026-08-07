import type { Metadata } from "next";
import SalesManager from "./SalesManager";

export const metadata: Metadata = { title: "Sales — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string }>;
}) {
  const { range, start, end } = await searchParams;
  return (
    <SalesManager
      initialRange={range ?? ""}
      initialStart={start ?? ""}
      initialEnd={end ?? ""}
    />
  );
}
