import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Setting, getSettings } from "@/models/Setting";
import { isAdmin } from "@/lib/auth";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    return NextResponse.json(await getSettings());
  } catch (err) {
    console.error("GET /api/settings failed:", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const body = await req.json();
    delete body._id;
    delete body.key;
    const settings = await Setting.findOneAndUpdate(
      { key: "business" },
      { $set: body },
      { new: true, upsert: true, runValidators: true }
    ).lean();
    return NextResponse.json(settings);
  } catch (err) {
    console.error("PATCH /api/settings failed:", err);
    const message = err instanceof Error ? err.message : "Failed to update settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
