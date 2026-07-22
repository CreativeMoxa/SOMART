import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product, cleanVariants, sumVariants } from "@/models/Product";
import { isAdmin } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectDB();
    const { slug } = await params;
    const product = await Product.findOne({ slug }).lean();
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (err) {
    console.error("GET /api/products/[slug] failed:", err);
    return NextResponse.json({ error: "Failed to load product" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const { slug } = await params;
    const body = await req.json();
    delete body._id;

    // Keep stockQty in sync with variant counts when variants are edited.
    if (Array.isArray(body.variants)) {
      const variants = cleanVariants(body.variants);
      body.variants = variants;
      if (variants.length > 0) {
        body.stockQty = sumVariants(variants);
        body.inStock = body.stockQty > 0;
      }
    }

    const product = await Product.findOneAndUpdate(
      { slug },
      { $set: body },
      { new: true, runValidators: true }
    ).lean();

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (err) {
    console.error("PATCH /api/products/[slug] failed:", err);
    const message = err instanceof Error ? err.message : "Failed to update product";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const { slug } = await params;
    const product = await Product.findOneAndDelete({ slug }).lean();
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/products/[slug] failed:", err);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
