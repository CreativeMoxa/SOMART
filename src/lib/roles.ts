// Role-Based Access Control — client-safe (no mongoose imports).
//
// Design goal: roles only decide WHICH EXISTING MODULES a user can open.
// They never create alternate versions of a module, so any future work on a
// module is automatically inherited by every role that can access it.
//
// Adding a new role later = add one entry to ROLE_MODULES. Nothing else.
// Adding a new module later = add one entry to MODULES (+ ADMIN_LINKS); roles
// set to "*" pick it up automatically.

export const MODULES = [
  "dashboard",
  "products",
  "inventory",
  "air-freight",
  "sea-freight",
  "sales",
  "quotations",
  "invoices",
  "customers",
  "marketing",
  "accounting",
  "reports",
  "employees",
  "settings",
] as const;

export type ModuleKey = (typeof MODULES)[number];

export const ROLES = ["founder-ceo", "founder-sales", "cashier", "marketer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  "founder-ceo": "Founder & CEO",
  "founder-sales": "Founder & Sales",
  cashier: "Cashier",
  marketer: "Marketer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  "founder-ceo": "Full access to everything, including Employees and Settings.",
  "founder-sales": "Every business module except Employees and Settings.",
  cashier: "Invoices only — create, edit, send, print and search customers.",
  marketer: "Marketing module only.",
};

// "*" means every module, now and in the future.
export const ROLE_MODULES: Record<Role, readonly ModuleKey[] | "*"> = {
  "founder-ceo": "*",
  "founder-sales": MODULES.filter(
    (m): m is ModuleKey => m !== "employees" && m !== "settings"
  ),
  cashier: ["invoices"],
  marketer: ["marketing"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function allowedModules(role: Role): readonly ModuleKey[] {
  const spec = ROLE_MODULES[role];
  return spec === "*" ? MODULES : spec;
}

export function canAccess(role: Role, moduleKey: ModuleKey): boolean {
  const spec = ROLE_MODULES[role];
  return spec === "*" || spec.includes(moduleKey);
}

// ── Module ⇄ route mapping ────────────────────────────────────────────────
// Single source of truth shared by the sidebar, the mobile drawer and the
// server-side route guard, so a link can never be shown without permission.
export type AdminLink = {
  module: ModuleKey;
  href: string;
  label: string;
  accent: string;
};

export const ADMIN_LINKS: readonly AdminLink[] = [
  { module: "dashboard", href: "/admin", label: "Dashboard", accent: "#eab308" },
  { module: "products", href: "/admin/products", label: "Products", accent: "#38bdf8" },
  { module: "inventory", href: "/admin/inventory", label: "Inventory", accent: "#2dd4bf" },
  { module: "air-freight", href: "/admin/air-freight", label: "Air Freight", accent: "#a78bfa" },
  { module: "sea-freight", href: "/admin/sea-freight", label: "Sea Freight", accent: "#60a5fa" },
  { module: "sales", href: "/admin/sales", label: "Sales", accent: "#34d399" },
  { module: "quotations", href: "/admin/quotations", label: "Quotations", accent: "#fbbf24" },
  { module: "invoices", href: "/admin/invoices", label: "Invoices", accent: "#fb923c" },
  { module: "customers", href: "/admin/customers", label: "Customers", accent: "#f472b6" },
  { module: "marketing", href: "/admin/marketing", label: "Marketing", accent: "#e879f9" },
  // The existing Expenses module — surfaced as "Accounting" in the menu.
  { module: "accounting", href: "/admin/expenses", label: "Accounting", accent: "#fb7185" },
  { module: "reports", href: "/admin/reports", label: "Reports", accent: "#818cf8" },
  { module: "employees", href: "/admin/employees", label: "Employees", accent: "#22d3ee" },
  { module: "settings", href: "/admin/settings", label: "Settings", accent: "#94a3b8" },
];

export function linksForRole(role: Role): readonly AdminLink[] {
  return ADMIN_LINKS.filter((l) => canAccess(role, l.module));
}

// Resolve which module a pathname belongs to, so the route guard can check a
// URL that was typed manually. Longest href wins (/admin matches last).
export function moduleForPath(pathname: string): ModuleKey | null {
  const match = [...ADMIN_LINKS]
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match ? match.module : null;
}

// Dashboard is an exact match; every other section matches by prefix so its
// sub-pages (e.g. /admin/invoices/[id]/print) keep the parent highlighted.
export function isActiveLink(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}
