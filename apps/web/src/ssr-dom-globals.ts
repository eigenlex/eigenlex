// Fondue's components (shipped without a "use client" directive) reference DOM
// constructors like `HTMLButtonElement` at module scope for `instanceof` checks.
// Under Next's server prerender/SSR there is no DOM, so evaluating those modules
// throws `ReferenceError: HTMLButtonElement is not defined`. Provide inert
// stand-ins on the server so the modules can load; `instanceof` against them is
// simply always false there, which is fine because the server has no real nodes.
//
// Imported first thing in the root layout and from `instrumentation.ts`, so it runs
// before any Fondue module is evaluated. No-ops in the browser, where these exist.
if (typeof globalThis.HTMLElement === "undefined") {
  class ServerHTMLElement {}
  const names = [
    "HTMLElement",
    "HTMLButtonElement",
    "HTMLAnchorElement",
    "HTMLInputElement",
    "HTMLSpanElement",
    "HTMLDivElement",
  ] as const;
  for (const name of names) {
    (globalThis as Record<string, unknown>)[name] ??= ServerHTMLElement;
  }
}

export {};
