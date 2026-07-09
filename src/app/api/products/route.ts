import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { isAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = req.nextUrl;
    const filter: Record<string, unknown> = {};

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

    const products = await Product.find(filter).sort({ createdAt: -1 }).lean();
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
    const product = await Product.create(body);
    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error("POST /api/products failed:", err);
    const message = err instanceof Error ? err.message : "Failed to create product";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
