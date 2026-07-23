import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { allowedModules, ROLE_LABELS } from "@/lib/roles";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    modules: allowedModules(user.role),
  });
}
