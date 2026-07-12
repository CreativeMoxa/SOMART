// Single source of truth for the admin navigation, shared by the desktop
// sidebar (AdminSidebar) and the mobile drawer (MobileAdminNav) so they never
// drift apart.
export const adminLinks = [
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
] as const;

// Dashboard is an exact match; every other section matches by prefix so its
// sub-pages (e.g. /admin/invoices/[id]/print) keep the parent highlighted.
export function isActiveLink(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}
