import type { Metadata } from "next";
import DocumentsManager from "@/components/admin/DocumentsManager";

export const metadata: Metadata = { title: "Invoices — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return <DocumentsManager kind="invoice" initialStatus={status ?? ""} />;
}
