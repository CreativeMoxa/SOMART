import type { Metadata } from "next";
import ExpensesManager from "./ExpensesManager";

export const metadata: Metadata = { title: "Expenses — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  return <ExpensesManager initialRange={range ?? ""} />;
}
