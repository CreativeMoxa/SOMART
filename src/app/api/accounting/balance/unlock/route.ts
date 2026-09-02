import { NextRequest, NextResponse } from "next/server";
import { verifyPin, setUnlock, clearUnlock, canAccessBalance } from "@/lib/businessBalance";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { requestContext } from "@/lib/auth";

// POST { password } → unlock Business Balance for a short time. DELETE → lock.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canAccessBalance(user.role)) {
    return NextResponse.json({ error: "Not authorized to access Business Balance." }, { status: 403 });
  }
  const { ip } = await requestContext();
  const limited = rateLimit(`bbpin:${user.id}:${ip}`, 6, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: `Too many attempts. Try again in ${limited.retryAfterSeconds}s.` }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  if (!(await verifyPin(String(body.password ?? "")))) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }
  await setUnlock(user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearUnlock();
  return NextResponse.json({ ok: true });
}
