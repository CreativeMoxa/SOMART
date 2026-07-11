import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { isAdmin } from "@/lib/auth";

type ImportRow = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  address?: unknown;
  notes?: unknown;
};

// Bulk import from an Excel/CSV upload (parsed client-side).
// Rows are deduplicated by phone number against existing customers.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const body = await req.json();
    const rows: ImportRow[] = Array.isArray(body.customers) ? body.customers : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: "No rows to import" }, { status: 400 });
    }
    if (rows.length > 5000) {
      return NextResponse.json(
        { error: "Too many rows — import at most 5000 at a time" },
        { status: 400 }
      );
    }

    const existing = await Customer.find({}, { phone: 1 }).lean();
    const seenPhones = new Set(existing.map((c) => c.phone.replace(/\s+/g, "")));

    let imported = 0;
    let duplicates = 0;
    let invalid = 0;
    const toInsert = [];

    for (const row of rows) {
      const name = String(row.name ?? "").trim();
      const phone = String(row.phone ?? "").trim();
      if (!name || !phone) {
        invalid++;
        continue;
      }
      const phoneKey = phone.replace(/\s+/g, "");
      if (seenPhones.has(phoneKey)) {
        duplicates++;
        continue;
      }
      seenPhones.add(phoneKey);
      toInsert.push({
        name,
        phone,
        email: String(row.email ?? "").trim(),
        address: String(row.address ?? "").trim(),
        notes: String(row.notes ?? "").trim(),
      });
      imported++;
    }

    if (toInsert.length > 0) await Customer.insertMany(toInsert);

    return NextResponse.json({ imported, duplicates, invalid, total: rows.length });
  } catch (err) {
    console.error("POST /api/customers/import failed:", err);
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
