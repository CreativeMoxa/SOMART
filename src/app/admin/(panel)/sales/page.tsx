import type { Metadata } from "next";
import SalesManager from "./SalesManager";

export const metadata: Metadata = { title: "Sales — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string; product?: string }>;
}) {
  const { range, start, end, product } = await searchParams;
  return (
    <SalesManager
      initialRange={range ?? ""}
      initialStart={start ?? ""}
      initialEnd={end ?? ""}
      initialProduct={product ?? ""}
    />
  );
}
