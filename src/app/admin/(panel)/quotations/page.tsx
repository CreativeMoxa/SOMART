import type { Metadata } from "next";
import DocumentsManager from "@/components/admin/DocumentsManager";

export const metadata: Metadata = { title: "Quotations — Admin" };
export const dynamic = "force-dynamic";

export default function AdminQuotationsPage() {
  return <DocumentsManager kind="quotation" />;
}
