import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product, cleanVariants, sumVariants } from "@/models/Product";
import { isAdmin } from "@/lib/auth";

// When variants are supplied, keep stockQty (the sellable total) as their sum.
function applyVariantTotals(body: Record<string, unknown>) {
  if (Array.isArray(body.variants)) {
    const variants = cleanVariants(body.variants);
    body.variants = variants;
    if (variants.length > 0) {
      body.stockQty = sumVariants(variants);
      body.inStock = (body.stockQty as number) > 0;
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = req.nextUrl;
    const filter: Record<string, unknown> = {};

    // Non-admin callers only ever see public (visible) products.
    if (!(await isAdmin())) filter.visible = { $ne: false };

    const category = searchParams.get("category");
    if (category) filter.category = category;

    const gender = searchParams.get("gender");
    if (gender) filter.gender = gender;

    if (searchParams.get("featured") === "true") filter.featured = true;

    const q = searchParams.get("q");
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { brand: { $regex: q, $options: "i" } },
      ];
    }

    // slim=1 returns only what pickers/lists need, cutting payload size sharply.
    const slim = searchParams.get("slim") === "1";
    const query = Product.find(filter).sort({ createdAt: -1 });
    if (slim) {
      query.select("name slug brand category price discountPercent imageUrl stockQty inStock link1688 variants");
    }
    const products = await query.lean();
    return NextResponse.json(products);
  } catch (err) {
    console.error("GET /api/products failed:", err);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const body = await req.json();
    applyVariantTotals(body);
    const product = await Product.create(body);
    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error("POST /api/products failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create product";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
