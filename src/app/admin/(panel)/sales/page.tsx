import type { Metadata } from "next";
import SalesManager from "./SalesManager";

export const metadata: Metadata = { title: "Sales — Admin" };
export const dynamic = "force-dynamic";

export default function AdminSalesPage() {
  return <SalesManager />;
}
