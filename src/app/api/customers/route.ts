import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { isAdmin } from "@/lib/auth";
import { stampAudit, recordAction } from "@/lib/audit";

const SELECT = "name phone email address notes createdAt";

// Reduce a phone number to its comparable digits: drop spaces/dashes/(), the
// Somalia country code (252) and any leading local-trunk zero. So "634401054",
// "252 63 4401054" and "0634401054" all become "634401054".
function phoneDigits(raw: unknown): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("252")) d = d.slice(3);
  d = d.replace(/^0+/, "");
  return d;
}

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

    let customers;
    if (phoneLike) {
      const target = phoneDigits(q);
      const all = await Customer.find()
        .select(SELECT)
        .sort({ createdAt: -1 })
        .limit(5000)
        .batchSize(5000)
        .lean();
      customers = target
        ? all.filter((c) => phoneDigits(c.phone).includes(target))
        : all;
    } else {
      const filter = q
        ? {
            $or: [
              { name: { $regex: q, $options: "i" } },
              { phone: { $regex: q, $options: "i" } },
              { email: { $regex: q, $options: "i" } },
            ],
          }
        : {};
      customers = await Customer.find(filter)
        .select(SELECT)
        .sort({ createdAt: -1 })
        .limit(2000)
        .batchSize(2000)
        .lean();
    }
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
