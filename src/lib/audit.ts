import { getCurrentUser, requestContext } from "@/lib/auth";
import { logActivity } from "@/models/ActivityLog";
import type { ModuleKey } from "@/lib/roles";

// The schema columns live in their own dependency-free module (models must not
// pull in next/headers); re-exported here for convenience.
export { auditFields } from "@/lib/auditFields";

/** Who is acting right now, as a display name. */
export async function actorName(): Promise<string> {
  const user = await getCurrentUser();
  return user ? user.name || user.email : "";
}

/** Stamp audit columns onto a create/update payload. */
export async function stampAudit(
  body: Record<string, unknown>,
  mode: "create" | "update"
) {
  const who = await actorName();
  if (mode === "create") {
    body.createdBy = who;
    body.updatedBy = who;
  } else {
    body.updatedBy = who;
    // Never let a client overwrite who originally created the record.
    delete body.createdBy;
  }
  return body;
}

/**
 * Record one line in the 7-day activity log, e.g.
 *   recordAction("created Invoice INV-1024", "invoices", "INV-1024")
 * Silently does nothing when there is no signed-in user.
 */
export async function recordAction(
  action: string,
  moduleKey: ModuleKey,
  reference?: string
) {
  const user = await getCurrentUser();
  if (!user) return;
  const ctx = await requestContext();
  await logActivity({
    employeeId: user.isEnvAdmin ? null : user.id,
    employeeName: user.name,
    employeeRole: user.role,
    action,
    module: moduleKey,
    reference,
    ...ctx,
  });
}
