import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { isAdmin } from "@/lib/auth";
import { stampAudit, recordAction } from "@/lib/audit";
import { phoneDigits, escapeRegex } from "@/lib/phone";

const SELECT = "name phone email address notes createdAt";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

    // A number-only query (with or without country code / spaces) searches by
    // phone, matching regardless of formatting. Text queries search name/email.
    const digits = q.replace(/\D/g, "");
    const phoneLike = q !== "" && digits.length >= 3 && /^[+\d\s()\-]+$/.test(q);

    // Phone search hits the normalised phoneDigits field directly, so it returns
    // only the matches (fast + incremental, like name search) instead of
    // scanning every customer in memory.
    let filter: Record<string, unknown> = {};
    if (phoneLike) {
      const target = phoneDigits(q);
      if (target) filter = { phoneDigits: { $regex: escapeRegex(target) } };
    } else if (q) {
      filter = {
        $or: [
          { name: { $regex: escapeRegex(q), $options: "i" } },
          { phone: { $regex: escapeRegex(q), $options: "i" } },
          { email: { $regex: escapeRegex(q), $options: "i" } },
        ],
      };
    }
    const customers = await Customer.find(filter)
      .select(SELECT)
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
    await stampAudit(body, "create");
    const customer = await Customer.create(body);
    await recordAction(`added Customer ${customer.name}`, "customers", customer.name);
    return NextResponse.json(customer, { status: 201 });
  } catch (err) {
    console.error("POST /api/customers failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create customer";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
