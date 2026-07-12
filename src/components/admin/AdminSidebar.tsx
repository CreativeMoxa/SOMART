"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoutIcon } from "@/components/icons";
import NotificationsBell from "@/components/admin/NotificationsBell";
import { adminLinks, isActiveLink } from "@/components/admin/adminLinks";

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside className="sticky top-24 hidden h-fit w-52 shrink-0 flex-col gap-1 print:hidden lg:flex">
      <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-gold">
        Store Manager
      </p>
      <NotificationsBell />
      {adminLinks.map((link) => {
        const active = isActiveLink(pathname, link.href);
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
