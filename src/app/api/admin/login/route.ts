import { NextRequest, NextResponse } from "next/server";
import { checkEnvCredentials, createSession, newSessionId } from "@/lib/auth";

// Break-glass owner login from .env.local (ADMIN_USERNAME / ADMIN_PASSWORD).
// Employees sign in with their email + password via /api/auth/login.
export async function POST(req: NextRequest) {
  try {
    const { username, password, remember } = await req.json();
    if (!checkEnvCredentials(username ?? "", password ?? "")) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }
    await createSession(
      { sub: "env-admin", role: "founder-ceo", sid: newSessionId(), sv: 0 },
      remember === true
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/admin/login failed:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
