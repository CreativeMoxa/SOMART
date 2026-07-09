import type { Metadata } from "next";
import ProductsManager from "./ProductsManager";

export const metadata: Metadata = { title: "Products — Admin" };
export const dynamic = "force-dynamic";

export default function AdminProductsPage() {
  return <ProductsManager />;
}
