import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { Employee } from "@/models/Employee";

export async function POST() {
  const user = await getCurrentUser();
  // Clearing the active-session marker means a normal logout → next sign-in
  // won't be treated as a device takeover (no code needed). Leaving it set
  // (e.g. just closing the app) is what triggers the device-confirmation code.
  if (user && !user.isEnvAdmin) {
    try {
      await connectDB();
      await Employee.updateOne({ _id: user.id }, { $set: { currentSessionId: "" } });
    } catch {
      // logout should still succeed even if this write fails
    }
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
