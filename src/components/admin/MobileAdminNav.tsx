"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoutIcon, MenuIcon, XIcon } from "@/components/icons";
import NotificationsBell from "@/components/admin/NotificationsBell";
import { adminLinks, isActiveLink } from "@/components/admin/adminLinks";

// Mobile/tablet navigation for the admin panel: a hamburger button (shown
// below the `lg` breakpoint, where the desktop sidebar is hidden) that opens a
// slide-out drawer with the exact same links as the sidebar.
export default function MobileAdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Portal target only exists in the browser; render the overlay after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close the drawer whenever the route changes (i.e. a link was tapped).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // While open: allow Escape to close and lock background scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setOpen(false);
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="-ml-1 cursor-pointer rounded-lg p-2 text-foreground transition-colors duration-200 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold lg:hidden"
      >
        <MenuIcon className="h-6 w-6" />
      </button>

      {/* The overlay is portaled to <body>: the sticky header's backdrop-blur
          makes the header the containing block for fixed descendants, which
          would trap the "full-screen" drawer inside the 64px header. */}
      {mounted &&
        createPortal(
          <>
      {/* Backdrop — tapping outside closes the drawer. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Slide-out drawer. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        className={`fixed left-0 top-0 z-[70] flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-line bg-background p-4 shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="px-1 text-[10px] font-bold uppercase tracking-[0.25em] text-gold">
            Store Manager
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="cursor-pointer rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-surface hover:text-foreground"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <NotificationsBell />

        <nav className="flex flex-col gap-1">
          {adminLinks.map((link) => {
            const active = isActiveLink(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                style={{ "--accent": link.accent } as CSSProperties}
                className={`cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold ${
                  active ? "bg-foreground text-background" : "nav-glow text-muted"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition-colors duration-200 hover:bg-surface hover:text-red-500"
        >
          <LogoutIcon className="h-4 w-4" /> Logout
        </button>
      </aside>
          </>,
          document.body
        )}
    </>
  );
}
