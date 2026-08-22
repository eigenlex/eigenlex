import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// One page. Every word is a query string on it, and a sitemap of 40,000 words per
// language would be a list of the same URL with the state a crawler cannot act on.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, changeFrequency: "monthly", priority: 1 }];
}
