import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { canAccessBalance } from "@/lib/businessBalance";
import BusinessBalanceManager from "./BusinessBalanceManager";

export const metadata: Metadata = { title: "Business Balance — Admin" };
export const dynamic = "force-dynamic";

export default async function BusinessBalancePage() {
  const user = await getCurrentUser();
  if (!user || !canAccessBalance(user.role)) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-line bg-surface p-10 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-red-400">Restricted</p>
        <h1 className="mt-2 text-2xl font-bold">Business Balance is owner-only</h1>
        <p className="mt-3 text-sm text-muted">
          This sensitive area is only available to the Founder &amp; CEO. Contact the owner if you need access.
        </p>
        <Link href="/admin/accounting" className="mt-6 inline-block rounded-full bg-gold-bright px-6 py-3 text-sm font-bold uppercase tracking-[0.1em] text-black">
          Back to Accounting
        </Link>
      </div>
    );
  }
  return <BusinessBalanceManager />;
}
