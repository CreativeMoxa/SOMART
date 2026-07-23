import type { Metadata } from "next";
import { requireModule } from "@/lib/auth";
import EmployeesManager from "./EmployeesManager";

export const metadata: Metadata = { title: "Employees" };
export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  // The panel layout already renders "Access denied" for other roles; this is
  // a second, explicit gate so the module can never render without permission.
  const user = await requireModule("employees");
  if (!user) return null;
  return <EmployeesManager />;
}
