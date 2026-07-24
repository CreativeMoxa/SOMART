import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, moduleForPath, linksForRole } from "@/lib/roles";
import AdminSidebar from "@/components/admin/AdminSidebar";
import ConfirmHost from "@/components/admin/ConfirmDialog";

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");

  // Server-side permission check — typing a URL for a module you cannot open
  // gives an Access Denied screen, never the module itself.
  const h = await headers();
  const pathname = h.get("x-pathname") || h.get("x-invoke-path") || "";
  const moduleKey = pathname ? moduleForPath(pathname) : null;
  const denied = moduleKey !== null && !canAccess(user.role, moduleKey);
  const home = linksForRole(user.role)[0]?.href ?? "/admin/login";

  return (
    <div className="mx-auto flex w-full max-w-[1400px] gap-6 px-4 py-8 sm:px-6">
      <AdminSidebar role={user.role} />
      <div className="min-w-0 flex-1">
        {denied ? (
          <div className="mx-auto max-w-lg rounded-3xl border border-line bg-surface p-10 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-red-400">
              Access denied
            </p>
            <h1 className="mt-2 text-2xl font-bold">You don&apos;t have access to this module</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Your role ({user.role.replace("-", " ")}) doesn&apos;t include this
              section. If you think this is a mistake, contact the Founder &amp; CEO.
            </p>
            <Link
              href={home}
              className="mt-6 inline-block cursor-pointer rounded-full bg-gold-bright px-6 py-3 text-sm font-bold uppercase tracking-[0.1em]"
            >
              Go to my area
            </Link>
          </div>
        ) : (
          children
        )}
      </div>
      <ConfirmHost />
    </div>
  );
}
