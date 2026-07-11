import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Shipment } from "@/models/Shipment";
import { Product, PRODUCT_CATEGORIES } from "@/models/Product";
import { SHIPMENT_STATUSES, type ShipmentStatus } from "@/lib/freight";
import { shapeShipmentPayload } from "@/lib/shipment";
import { applyStock } from "@/lib/inventory";
import { isAdmin } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

    // ── Receive: move every product into store inventory (once) ──────────────
    if (body.action === "receive") {
      if (shipment.status === "received") {
        return NextResponse.json({ error: "Shipment already received" }, { status: 400 });
      }
      const movementType = shipment.freightType === "sea" ? "received-sea" : "received-air";

      for (const item of shipment.items) {
        let product = item.productId ? await Product.findById(item.productId) : null;

        if (!product) {
          // Create a new store product from the shipment line.
          const category = PRODUCT_CATEGORIES.includes(
            item.category as (typeof PRODUCT_CATEGORIES)[number]
          )
            ? item.category
            : "accessories";
          const base = slugify(item.name) || "product";
          let slug = base;
          for (let attempt = 0; attempt < 5; attempt++) {
            const exists = await Product.exists({ slug });
            if (!exists) break;
            slug = `${base}-${Date.now().toString(36).slice(-4)}${attempt}`;
          }
          product = await Product.create({
            name: item.name,
            slug,
            brand: "Imported",
            category,
            price: item.sellingPrice || item.costPrice || 0,
            costPrice: item.costPrice || 0,
            imageUrl: item.imageUrl || "",
            images: item.imageUrl ? [item.imageUrl] : [],
            stockQty: 0,
            inStock: false,
          });
          item.productId = product._id;
        } else {
          // Fill in cost/selling if the product had none yet.
          if ((product.costPrice ?? 0) === 0 && item.costPrice) product.costPrice = item.costPrice;
          if ((product.price ?? 0) === 0 && item.sellingPrice) product.price = item.sellingPrice;
        }

        await applyStock(product, item.qty, movementType, {
          reference: shipment.number,
          bumpRestocked: true,
          note: item.name,
        });
      }

      shipment.status = "received";
      shipment.receivedAt = new Date();
      await shipment.save();
      return NextResponse.json(shipment.toObject());
    }

    // ── Regular edit ─────────────────────────────────────────────────────────
    if (body.items) {
      if (shipment.status === "received") {
        return NextResponse.json(
          { error: "A received shipment's products can no longer be edited" },
          { status: 400 }
        );
      }
      const shaped = shapeShipmentPayload(body);
      shipment.set(shaped);
    } else {
      if (body.status && SHIPMENT_STATUSES.includes(body.status as ShipmentStatus)) {
        shipment.status = body.status;
      }
      if (body.name !== undefined) shipment.name = String(body.name);
      if (body.trackingNumber !== undefined) shipment.trackingNumber = String(body.trackingNumber);
      if (body.shippingDate !== undefined) shipment.shippingDate = String(body.shippingDate);
      if (body.expectedArrival !== undefined) shipment.expectedArrival = String(body.expectedArrival);
      if (body.notes !== undefined) shipment.notes = String(body.notes);
    }
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
    // Received shipments are permanent history and cannot be deleted.
    if (shipment.status === "received") {
      return NextResponse.json(
        { error: "Received shipments are kept as permanent history and cannot be deleted" },
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
