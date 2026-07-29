import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { PageView } from "@/models/PageView";

export const dynamic = "force-dynamic";

// Public beacon: records one storefront page view. Fire-and-forget — the
// browser doesn't read the response, so we keep it cheap and never throw.
export async function POST(req: NextRequest) {
  try {
    let path = "";
    try {
      const body = await req.json();
      path = typeof body?.path === "string" ? body.path.slice(0, 300) : "";
    } catch {
      // sendBeacon may deliver an empty/blob body — a view still counts.
    }
    // Never record admin or API traffic as a "web view".
    if (path.startsWith("/admin") || path.startsWith("/api")) {
      return NextResponse.json({ ok: true });
    }
    await connectDB();
    await PageView.create({ path });
    return NextResponse.json({ ok: true });
  } catch {
    // A failed view must never surface to the visitor.
    return NextResponse.json({ ok: false });
  }
}
