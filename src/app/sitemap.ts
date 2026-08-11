import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";

// Refresh the sitemap at most once an hour so newly added products appear
// without rebuilding.
export const revalidate = 3600;

// https://shopsomart.com/sitemap.xml
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Real, public, indexable pages that actually exist in the project.
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Add a URL for every publicly visible product. Guarded so a database issue
  // never breaks the build or the sitemap response.
  let productEntries: MetadataRoute.Sitemap = [];
  try {
    await connectDB();
    const products = await Product.find({ visible: { $ne: false } })
      .select("slug updatedAt")
      .lean();
    productEntries = products
      .filter((p) => p.slug)
      .map((p) => ({
        url: `${SITE_URL}/products/${p.slug}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
  } catch (err) {
    console.error("sitemap: failed to load products", err);
  }

  return [...staticEntries, ...productEntries];
}
