import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Shipment } from "@/models/Shipment";
import {
  FREIGHT_META,
  FREIGHT_TYPES,
  SHIPMENT_STATUSES,
  type FreightType,
  type ShipmentStatus,
} from "@/lib/freight";
import { shapeShipmentPayload, nextFreeShipmentNumber } from "@/lib/shipment";
import { receiveItem, unreceiveItem, syncShipmentStatus } from "@/lib/shipmentReceive";
import { isAdmin } from "@/lib/auth";
import { recordAction } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const shipment = await Shipment.findById(id).lean();
    if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    return NextResponse.json(shipment);
  } catch (err) {
    console.error("GET /api/shipments/[id] failed:", err);
    return NextResponse.json({ error: "Failed to load shipment" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const shipment = await Shipment.findById(id);
    if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

    // ── Transfer to the other freight (Air ⇄ Sea) ───────────────────────────
    // Moves ALL the data across and gives it the next number in the target
    // freight (e.g. AIR-0002 → SEA-0001). Existing shipments keep their numbers
    // — the vacated number is simply left as a gap, nothing is renumbered.
    if (body.action === "transfer") {
      const current = shipment.freightType as FreightType;
      const target = FREIGHT_TYPES.find((t) => t !== current) as FreightType;
      const from = shipment.number;
      const newNumber = await nextFreeShipmentNumber(target);
      shipment.freightType = target;
      shipment.number = newNumber;
      await shipment.save();
      await recordAction(
        `transferred ${from} to ${FREIGHT_META[target].label} as ${newNumber}`,
        target === "air" ? "air-freight" : "sea-freight",
        newNumber
      );
      return NextResponse.json(shipment.toObject());
    }

    // ── Per-item verification: receive / unreceive one product line ─────────
    if (body.action === "receive-item" || body.action === "unreceive-item") {
      const index = Math.floor(Number(body.index));
      const item = shipment.items[index];
      if (!item) return NextResponse.json({ error: "Product line not found" }, { status: 400 });

      if (body.action === "receive-item") {
        if (item.received) {
          return NextResponse.json({ error: "This product is already received" }, { status: 400 });
        }
        await receiveItem(shipment, item);
      } else {
        if (!item.received) {
          return NextResponse.json({ error: "This product is not received yet" }, { status: 400 });
        }
        await unreceiveItem(shipment, item);
      }
      syncShipmentStatus(shipment);
      await shipment.save();
      return NextResponse.json(shipment.toObject());
    }

    // ── Receive everything at once (also used by status → received) ─────────
    if (body.action === "receive") {
      for (const item of shipment.items) await receiveItem(shipment, item);
      syncShipmentStatus(shipment);
      await shipment.save();
      return NextResponse.json(shipment.toObject());
    }

    // ── Full edit (allowed at any time; received lines pass through) ────────
    if (body.items) {
      const shaped = shapeShipmentPayload(body);
      const wasReceived = shipment.status === "received";
      shipment.set(shaped);
      // Status ⇄ received transitions behave like invoice paid/unpaid:
      if (!wasReceived && shaped.status === "received") {
        for (const item of shipment.items) await receiveItem(shipment, item);
      } else if (wasReceived && shaped.status !== "received") {
        for (const item of shipment.items) await unreceiveItem(shipment, item);
        shipment.receivedAt = null;
      }
      syncShipmentStatus(shipment);
      // Respect an explicitly chosen non-received status when nothing is received.
      if (
        shipment.items.every((i) => !i.received) &&
        SHIPMENT_STATUSES.includes(shaped.status) &&
        shaped.status !== "received"
      ) {
        shipment.status = shaped.status;
      }
      await shipment.save();
      return NextResponse.json(shipment.toObject());
    }

    // ── Status-only / metadata update ────────────────────────────────────────
    if (body.status && SHIPMENT_STATUSES.includes(body.status as ShipmentStatus)) {
      const next = body.status as ShipmentStatus;
      if (next === "received" && shipment.status !== "received") {
        for (const item of shipment.items) await receiveItem(shipment, item);
      } else if (shipment.status === "received" && next !== "received") {
        // Going back from received pulls all products out of inventory again.
        for (const item of shipment.items) await unreceiveItem(shipment, item);
        shipment.receivedAt = null;
      }
      shipment.status = next;
      if (next === "received") shipment.receivedAt = shipment.receivedAt ?? new Date();
    }
    if (body.name !== undefined) shipment.name = String(body.name);
    if (body.cargo !== undefined) shipment.cargo = String(body.cargo);
    if (body.trackingNumber !== undefined) shipment.trackingNumber = String(body.trackingNumber);
    if (body.shippingDate !== undefined) shipment.shippingDate = String(body.shippingDate);
    if (body.expectedArrival !== undefined) shipment.expectedArrival = String(body.expectedArrival);
    if (body.notes !== undefined) shipment.notes = String(body.notes);

    await shipment.save();
    return NextResponse.json(shipment.toObject());
  } catch (err) {
    console.error("PATCH /api/shipments/[id] failed:", err);
    const message = err instanceof Error ? err.message : "Failed to update shipment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const shipment = await Shipment.findById(id);
    if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    // Stock from received lines lives in inventory — unreceive them first.
    if (shipment.items.some((i) => i.received)) {
      return NextResponse.json(
        { error: "Some products are already received into inventory. Un-receive them first, then delete." },
        { status: 400 }
      );
    }
    await shipment.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/shipments/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete shipment" }, { status: 500 });
  }
}
