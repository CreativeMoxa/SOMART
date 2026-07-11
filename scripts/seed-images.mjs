import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

// Minimal .env.local parser so the script runs without extra dependencies.
function loadEnv() {
  const envPath = resolve(import.meta.dirname, "..", ".env.local");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

loadEnv();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const productSchema = new mongoose.Schema(
  { slug: String, category: String, imageUrl: String, images: [String] },
  { timestamps: true, strict: false }
);
const Product = mongoose.models.Product ?? mongoose.model("Product", productSchema);

const unsplash = (id) =>
  `https://images.unsplash.com/${id}?w=900&q=80&auto=format&fit=crop`;

// Curated example photo per seeded product.
const photoBySlug = {
  "aria-round-classic": "photo-1509695507497-903c140c43b0",
  "metro-titanium-slim": "photo-1574258495973-f010dfbb5371",
  "luna-cat-eye": "photo-1577803645773-f96470509666",
  "junior-flex-sport": "photo-1591076482161-42ce6da69f67",
  "malibu-aviator": "photo-1473496169904-658ba7c44d8a",
  "costa-wayfarer": "photo-1511499767150-a48a237f0083",
  "sierra-sport-wrap": "photo-1572635196237-14b3f281503f",
  "regent-chronograph": "photo-1547996160-81dfa63595aa",
  "aurelia-minimal": "photo-1523275335684-37898b6baf30",
  "voyager-field-watch": "photo-1524592094714-0f0654e20314",
  "gold-chain-glasses-strap": "photo-1590874103328-eac38a683ce7",
  "silk-cleaning-pouch": "photo-1606760227091-3dd870d97f1d",
  "leather-glasses-case": "photo-1553062407-98eeb64c6a62",
  "anti-slip-sport-strap": "photo-1622434641406-a158123450f9",
};

// Fallback per category for products added outside the seed script.
const photoByCategory = {
  eyeglasses: "photo-1574258495973-f010dfbb5371",
  sunglasses: "photo-1511499767150-a48a237f0083",
  watches: "photo-1524592094714-0f0654e20314",
  accessories: "photo-1606760227091-3dd870d97f1d",
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const missing = await Product.find({
    $or: [{ imageUrl: "" }, { imageUrl: null }, { imageUrl: { $exists: false } }],
  });
  console.log(`${missing.length} product(s) without an image.`);

  for (const product of missing) {
    const photoId = photoBySlug[product.slug] ?? photoByCategory[product.category];
    if (!photoId) {
      console.log(`- ${product.slug}: no example photo mapped, skipping`);
      continue;
    }
    const source = unsplash(photoId);
    let url = source;
    try {
      // Re-host on the project's Cloudinary so images live in one place.
      const uploaded = await cloudinary.uploader.upload(source, {
        folder: "somart/products",
        public_id: product.slug,
        overwrite: false,
      });
      url = uploaded.secure_url;
    } catch (err) {
      console.log(`  Cloudinary upload failed for ${product.slug} (${err.message}); using source URL directly.`);
    }
    product.imageUrl = url;
    product.images = [url];
    await product.save();
    console.log(`- ${product.slug}: ${url}`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
