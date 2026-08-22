import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Nothing here is private and the API answers JSON a crawler has no use for, so the
// rule is: index the page, leave /api alone.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
