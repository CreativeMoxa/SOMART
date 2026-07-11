import type { Metadata } from "next";
import ProductsManager from "./ProductsManager";

export const metadata: Metadata = { title: "Products — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  return <ProductsManager initialFilter={filter ?? ""} />;
}
