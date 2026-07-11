import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Shipment } from "@/models/Shipment";
import { FREIGHT_TYPES, type FreightType } from "@/lib/freight";
import { nextShipmentNumber, shapeShipmentPayload } from "@/lib/shipment";
import { isAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const sp = req.nextUrl.searchParams;
    const type = sp.get("type");
    const status = sp.get("status");
    const q = sp.get("q");

    const filter: Record<string, unknown> = {};
    if (type && FREIGHT_TYPES.includes(type as FreightType)) filter.freightType = type;
    if (status) filter.status = status;
    if (q) {
      filter.$or = [
        { number: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
        { trackingNumber: { $regex: q, $options: "i" } },
        { "items.name": { $regex: q, $options: "i" } },
      ];
    }

    const shipments = await Shipment.find(filter)
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    return NextResponse.json(shipments);
  } catch (err) {
    console.error("GET /api/shipments failed:", err);
    return NextResponse.json({ error: "Failed to load shipments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const body = await req.json();
    const freightType = body.freightType as FreightType;
    if (!FREIGHT_TYPES.includes(freightType)) {
      return NextResponse.json({ error: "Invalid freight type" }, { status: 400 });
    }
    const shaped = shapeShipmentPayload(body);
    const shipment = await Shipment.create({
      ...shaped,
      freightType,
      number: await nextShipmentNumber(freightType),
    });
    return NextResponse.json(shipment, { status: 201 });
  } catch (err) {
    console.error("POST /api/shipments failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create shipment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
