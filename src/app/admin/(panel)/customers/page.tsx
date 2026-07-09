import type { Metadata } from "next";
import CustomersManager from "./CustomersManager";

export const metadata: Metadata = { title: "Customers — Admin" };
export const dynamic = "force-dynamic";

export default function AdminCustomersPage() {
  return <CustomersManager />;
}
