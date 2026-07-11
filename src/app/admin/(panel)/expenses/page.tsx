import type { Metadata } from "next";
import ExpensesManager from "./ExpensesManager";

export const metadata: Metadata = { title: "Expenses — Admin" };
export const dynamic = "force-dynamic";

export default function AdminExpensesPage() {
  return <ExpensesManager />;
}
