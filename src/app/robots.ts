import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// https://shopsomart.com/robots.txt
// Allow search engines to crawl the public storefront; keep the admin panel and
// API endpoints out of the index. The sitemap is advertised for discovery.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
