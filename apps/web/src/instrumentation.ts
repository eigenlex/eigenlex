// Runs at server init (including the static-generation workers during `next build`),
// before any route module renders — the earliest guaranteed point to install the
// server-side DOM stand-ins that Fondue's non-SSR-safe components need to load.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./ssr-dom-globals");
  }
}
