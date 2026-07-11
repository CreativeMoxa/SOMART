"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoutIcon } from "@/components/icons";
import NotificationsBell from "@/components/admin/NotificationsBell";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/air-freight", label: "Air Freight" },
  { href: "/admin/sea-freight", label: "Sea Freight" },
  { href: "/admin/sales", label: "Sales" },
  { href: "/admin/quotations", label: "Quotations" },
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/marketing", label: "Marketing" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/expenses", label: "Expenses" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside className="sticky top-24 hidden h-fit w-52 shrink-0 flex-col gap-1 print:hidden md:flex">
      <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-gold">
        Store Manager
      </p>
      <NotificationsBell />
      {links.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 ${
              active
                ? "bg-foreground text-background"
                : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={handleLogout}
        className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500"
      >
        <LogoutIcon className="h-4 w-4" /> Logout
      </button>
    </aside>
  );
}
