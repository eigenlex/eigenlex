// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";
import manifest from "./manifest";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

describe("what names the site to a machine", () => {
  it("keeps crawlers off the API and points them at the sitemap", () => {
    const r = robots();
    expect(r.rules).toMatchObject({ allow: "/", disallow: "/api/" });
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  // Every word is query state on the same page, so there is one URL to list.
  it("lists the one page, on the production origin", () => {
    expect(sitemap().map((e) => e.url)).toEqual([SITE_URL]);
  });

  it("describes the app the same way everywhere", () => {
    const m = manifest();
    expect(m.name).toBe(SITE_NAME);
    expect(m.description).toBe(SITE_DESCRIPTION);
    expect(m.icons?.[0]?.src).toBe("/icon.svg");
  });
});

// Next merges metadata shallowly: a child naming `openGraph` replaces the parent's whole
// object. Returning only `title` here leaves a shared deeplink previewing as "eigenlex".
describe("a deeplink's word reaches the preview, not only the tab", () => {
  // @spec URL-7
  it("carries the word into the Open Graph and Twitter titles", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({ searchParams: Promise.resolve({ word: "Wasser" }) });
    expect(meta.title).toBe("eigenlex: Wasser");
    expect(meta.openGraph.title).toBe("eigenlex: Wasser");
    expect(meta.twitter.title).toBe("eigenlex: Wasser");
    expect(meta.openGraph.description).toBe(SITE_DESCRIPTION);
    expect(meta.openGraph.siteName).toBe(SITE_NAME);
  });
});
