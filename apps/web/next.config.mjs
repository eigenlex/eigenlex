/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@eigenlex/core", "@eigenlex/adapters", "@eigenlex/analysis"],
  // `next dev` and `next build` both default to `.next`; building into it while a
  // dev server is live corrupts the server. `build:check` overrides this so a
  // verification build lands in a separate dir and can't clobber dev.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // graph.ts reads the precomputed model at runtime via a computed path, so the
  // tracer can't discover it — force it into every API function's bundle. Missing
  // (e.g. a build without the model) is fine: the glob just matches nothing.
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/webster-model.json"],
  },
};

export default nextConfig;
