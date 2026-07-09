import type { Metadata } from "next";
import DocumentsManager from "@/components/admin/DocumentsManager";

export const metadata: Metadata = { title: "Invoices — Admin" };
export const dynamic = "force-dynamic";

export default function AdminInvoicesPage() {
  return <DocumentsManager kind="invoice" />;
}
