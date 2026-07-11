import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { isAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const q = req.nextUrl.searchParams.get("q");
    const filter = q
      ? {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { phone: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
          ],
        }
      : {};
    // batchSize matches the limit so remote Atlas returns everything in one roundtrip.
    const customers = await Customer.find(filter)
      .select("name phone email address notes createdAt")
      .sort({ createdAt: -1 })
      .limit(2000)
      .batchSize(2000)
      .lean();
    return NextResponse.json(customers);
  } catch (err) {
    console.error("GET /api/customers failed:", err);
    return NextResponse.json({ error: "Failed to load customers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const body = await req.json();
    if (!body.name || !body.phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
    }
    const customer = await Customer.create(body);
    return NextResponse.json(customer, { status: 201 });
  } catch (err) {
    console.error("POST /api/customers failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create customer";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
