import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";

// Minimal .env.local parser so the script runs without extra dependencies.
function loadEnv() {
  const envPath = resolve(import.meta.dirname, "..", ".env.local");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

loadEnv();

const productSchema = new mongoose.Schema(
  {
    name: String,
    slug: { type: String, unique: true },
    brand: String,
    category: String,
    price: Number,
    costPrice: Number,
    discountPercent: Number,
    description: String,
    imageUrl: String,
    images: [String],
    specs: [{ label: String, value: String }],
    colors: [String],
    material: String,
    gender: String,
    stockQty: Number,
    inStock: Boolean,
    soldCount: Number,
    featured: Boolean,
  },
  { timestamps: true }
);

const Product = mongoose.models.Product ?? mongoose.model("Product", productSchema);

const products = [
  {
    name: "Aria Round Classic",
    slug: "aria-round-classic",
    brand: "SOMART Collection",
    category: "eyeglasses",
    price: 129,
    costPrice: 55,
    discountPercent: 0,
    description:
      "Timeless round frames in featherweight acetate. A versatile everyday pair that suits nearly every face shape.",
    colors: ["Tortoise", "Matte Black", "Crystal"],
    material: "Acetate",
    specs: [
      { label: "Frame Width", value: "138mm" },
      { label: "Lens Width", value: "49mm" },
      { label: "Weight", value: "22g" },
    ],
    gender: "unisex",
    stockQty: 14,
    featured: true,
  },
  {
    name: "Metro Titanium Slim",
    slug: "metro-titanium-slim",
    brand: "SOMART Collection",
    category: "eyeglasses",
    price: 189,
    costPrice: 88,
    discountPercent: 0,
    description:
      "Ultra-light titanium frames with adjustable nose pads — barely there comfort for long workdays.",
    colors: ["Gunmetal", "Gold", "Silver"],
    material: "Titanium",
    specs: [
      { label: "Frame Width", value: "140mm" },
      { label: "Weight", value: "14g" },
    ],
    gender: "men",
    stockQty: 8,
    featured: true,
  },
  {
    name: "Luna Cat-Eye",
    slug: "luna-cat-eye",
    brand: "Vista Moda",
    category: "eyeglasses",
    price: 149,
    costPrice: 62,
    discountPercent: 15,
    description:
      "A modern take on the classic cat-eye silhouette with subtle metallic accents at the temples.",
    colors: ["Burgundy", "Emerald", "Black"],
    material: "Acetate & Steel",
    gender: "women",
    stockQty: 11,
    featured: false,
  },
  {
    name: "Malibu Aviator",
    slug: "malibu-aviator",
    brand: "SunCoast",
    category: "sunglasses",
    price: 159,
    costPrice: 70,
    discountPercent: 0,
    description:
      "Iconic aviator styling with polarized lenses and 100% UV protection for glare-free days.",
    colors: ["Gold/Green", "Silver/Blue"],
    material: "Stainless Steel",
    specs: [
      { label: "Lens", value: "Polarized, UV400" },
      { label: "Lens Width", value: "58mm" },
    ],
    gender: "unisex",
    stockQty: 20,
    featured: true,
  },
  {
    name: "Costa Wayfarer",
    slug: "costa-wayfarer",
    brand: "SunCoast",
    category: "sunglasses",
    price: 139,
    costPrice: 58,
    discountPercent: 20,
    description:
      "The classic wayfarer shape with scratch-resistant polarized lenses and spring hinges.",
    colors: ["Matte Black", "Havana"],
    material: "Acetate",
    gender: "unisex",
    stockQty: 16,
    featured: false,
  },
  {
    name: "Sierra Sport Wrap",
    slug: "sierra-sport-wrap",
    brand: "TrailView",
    category: "sunglasses",
    price: 119,
    costPrice: 48,
    discountPercent: 0,
    description:
      "Wrap-around sport sunglasses with grippy temples and shatterproof lenses — made for the outdoors.",
    colors: ["Black/Red", "White/Blue"],
    material: "TR-90 Polymer",
    gender: "men",
    stockQty: 0,
    featured: false,
  },
  {
    name: "Junior Flex Sport",
    slug: "junior-flex-sport",
    brand: "KidSight",
    category: "eyeglasses",
    price: 79,
    costPrice: 30,
    discountPercent: 0,
    description:
      "Virtually unbreakable flexible frames built for active kids, with a snug wrap-around fit.",
    colors: ["Blue", "Red", "Green"],
    material: "TR-90 Flexible Polymer",
    gender: "kids",
    stockQty: 9,
    featured: false,
  },
  {
    name: "Regent Chronograph",
    slug: "regent-chronograph",
    brand: "SOMART Time",
    category: "watches",
    price: 249,
    costPrice: 110,
    discountPercent: 0,
    description:
      "A statement chronograph with a brushed steel case, sapphire-coated glass and a genuine leather strap.",
    colors: ["Silver/Black", "Gold/Brown"],
    material: "Stainless Steel & Leather",
    specs: [
      { label: "Case", value: "42mm stainless steel" },
      { label: "Movement", value: "Quartz chronograph" },
      { label: "Water Resistance", value: "5 ATM" },
    ],
    gender: "men",
    stockQty: 7,
    featured: true,
  },
  {
    name: "Aurelia Minimal",
    slug: "aurelia-minimal",
    brand: "SOMART Time",
    category: "watches",
    price: 199,
    costPrice: 85,
    discountPercent: 10,
    description:
      "Slim, minimal and endlessly elegant — a rose-gold case with a mesh strap that dresses any outfit up.",
    colors: ["Rose Gold", "Silver"],
    material: "Stainless Steel Mesh",
    specs: [
      { label: "Case", value: "34mm rose gold" },
      { label: "Movement", value: "Japanese quartz" },
      { label: "Water Resistance", value: "3 ATM" },
    ],
    gender: "women",
    stockQty: 10,
    featured: true,
  },
  {
    name: "Voyager Field Watch",
    slug: "voyager-field-watch",
    brand: "TrailView",
    category: "watches",
    price: 159,
    costPrice: 68,
    discountPercent: 0,
    description:
      "A rugged field watch with luminous hands, canvas strap and scratch-resistant crystal.",
    colors: ["Olive", "Sand", "Black"],
    material: "Steel & Canvas",
    gender: "unisex",
    stockQty: 12,
    featured: false,
  },
  {
    name: "Gold Chain Glasses Strap",
    slug: "gold-chain-glasses-strap",
    brand: "SOMART Collection",
    category: "accessories",
    price: 39,
    costPrice: 12,
    discountPercent: 0,
    description:
      "Elegant gold-tone chain that keeps your glasses close and your look elevated.",
    colors: ["Gold", "Silver"],
    material: "Plated Brass",
    gender: "women",
    stockQty: 25,
    featured: false,
  },
  {
    name: "Silk Cleaning Pouch",
    slug: "silk-cleaning-pouch",
    brand: "SOMART Collection",
    category: "accessories",
    price: 19,
    costPrice: 6,
    discountPercent: 25,
    description:
      "A soft silk pouch that protects your frames and doubles as a cleaning cloth.",
    colors: ["Black", "Champagne", "Emerald"],
    material: "Silk",
    gender: "unisex",
    stockQty: 30,
    featured: false,
  },
  {
    name: "Leather Glasses Case",
    slug: "leather-glasses-case",
    brand: "SOMART Collection",
    category: "accessories",
    price: 29,
    costPrice: 10,
    discountPercent: 0,
    description:
      "Handsome hard-shell case in vegan leather with soft microsuede lining.",
    colors: ["Brown", "Black", "Forest Green"],
    material: "Vegan Leather",
    gender: "unisex",
    stockQty: 18,
    featured: false,
  },
  {
    name: "Anti-Slip Sport Strap",
    slug: "anti-slip-sport-strap",
    brand: "TrailView",
    category: "accessories",
    price: 12,
    costPrice: 4,
    discountPercent: 0,
    description:
      "Adjustable silicone strap that keeps glasses secure during sports and workouts.",
    colors: ["Black", "Neon Green"],
    material: "Silicone",
    gender: "unisex",
    stockQty: 40,
    featured: false,
  },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not found in .env.local");

  console.log("Connecting to MongoDB…");
  await mongoose.connect(uri);

  for (const product of products) {
    await Product.updateOne(
      { slug: product.slug },
      {
        $set: { ...product, inStock: product.stockQty > 0 },
        $setOnInsert: { soldCount: 0, imageUrl: "", images: [] },
      },
      { upsert: true }
    );
    console.log(`  ✔ upserted ${product.slug}`);
  }

  const count = await Product.countDocuments();
  console.log(`Done. ${count} products in the database.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
