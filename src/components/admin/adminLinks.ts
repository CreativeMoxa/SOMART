// Single source of truth for the admin navigation, shared by the desktop
// sidebar (AdminSidebar) and the mobile drawer (MobileAdminNav) so they never
// drift apart. `accent` drives each module's hover tint/glow (via the
// .nav-glow CSS class); label text keeps the theme foreground for contrast.
export const adminLinks = [
  { href: "/admin", label: "Dashboard", accent: "#eab308" },
  { href: "/admin/products", label: "Products", accent: "#38bdf8" },
  { href: "/admin/inventory", label: "Inventory", accent: "#2dd4bf" },
  { href: "/admin/air-freight", label: "Air Freight", accent: "#a78bfa" },
  { href: "/admin/sea-freight", label: "Sea Freight", accent: "#60a5fa" },
  { href: "/admin/sales", label: "Sales", accent: "#34d399" },
  { href: "/admin/quotations", label: "Quotations", accent: "#fbbf24" },
  { href: "/admin/invoices", label: "Invoices", accent: "#fb923c" },
  { href: "/admin/customers", label: "Customers", accent: "#f472b6" },
  { href: "/admin/marketing", label: "Marketing", accent: "#e879f9" },
  { href: "/admin/reports", label: "Reports", accent: "#818cf8" },
  { href: "/admin/expenses", label: "Expenses", accent: "#fb7185" },
  { href: "/admin/settings", label: "Settings", accent: "#94a3b8" },
] as const;

// Dashboard is an exact match; every other section matches by prefix so its
// sub-pages (e.g. /admin/invoices/[id]/print) keep the parent highlighted.
export function isActiveLink(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}
