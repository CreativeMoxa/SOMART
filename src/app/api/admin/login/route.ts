import { NextRequest, NextResponse } from "next/server";
import { checkCredentials, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!checkCredentials(username ?? "", password ?? "")) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }
    await createSession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/admin/login failed:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
