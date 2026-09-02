import type { Metadata } from "next";
import AccountingManager from "./AccountingManager";

export const metadata: Metadata = { title: "Accounting — Admin" };
export const dynamic = "force-dynamic";

export default function AdminAccountingPage() {
  return <AccountingManager />;
}
