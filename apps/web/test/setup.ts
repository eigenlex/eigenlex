// Registers @testing-library/jest-dom matchers on vitest's `expect`. Only the
// matcher definitions load here (no DOM access), so this is safe under the node
// environment the lib/API tests use; component tests opt into jsdom per file.
import "@testing-library/jest-dom/vitest";

// jsdom omits these browser APIs; Fondue's Tabs (built on Radix) constructs an
// IntersectionObserver and scrolls the active trigger into view on mount, so
// stub them where a DOM exists. Guarded so the node-environment tests are untouched.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = NoopObserver as unknown as typeof IntersectionObserver;
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = NoopObserver as unknown as typeof ResizeObserver;
}
if (typeof window !== "undefined" && !window.Element.prototype.scrollIntoView) {
  window.Element.prototype.scrollIntoView = () => {};
}
