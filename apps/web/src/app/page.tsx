import { headers } from "next/headers";
import ThemeToggle from "@/components/ThemeToggle";
import Workspace from "@/components/WorkspaceLazy";
import { pageTitle } from "@/lib/scenario";

// A shared deeplink names its word in the tab and in link previews, before any client
// JS runs. `Workspace` recases it to the corpus's spelling once the lookup lands.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ word?: string | string[] }>;
}) {
  const { word } = await searchParams;
  return { title: pageTitle(Array.isArray(word) ? word[0] : word) };
}

export default async function Home() {
  // Vercel resolves the client IP to a country, which seeds the source language for a
  // first-time visitor. Absent everywhere else, which falls back to English. The root
  // layout already reads cookies, so this route is dynamic either way.
  const country = (await headers()).get("x-vercel-ip-country");
  // The word card and chip grid need more room than 1100px gave them — and on a
  // phone the gutter is room taken off them, so it stays narrow until there is some.
  return (
    <main
      className="Home tw-mx-auto tw-max-w-[1400px] tw-px-3 min-[700px]:tw-px-6 min-[900px]:tw-px-10 tw-pb-16 tw-pt-10"
      id="main"
      tabIndex={-1}
    >
      <header className="tw-mb-6">
        <div className="tw-mb-1 tw-flex tw-items-start tw-justify-between tw-gap-4">
          <h1 className="tw-heading-xx-large-strong">eigenlex</h1>
          <ThemeToggle />
        </div>
        {/* line-height 1.5 for blocks of text (WCAG 1.4.8); the Fondue type token
            sets a tighter value, so override it inline. */}
        <p className="tw-body-large tw-max-w-[60ch] text-muted-aaa" style={{ lineHeight: 1.5 }}>
          Which words to learn first.
        </p>
      </header>
      <Workspace country={country} />
    </main>
  );
}
