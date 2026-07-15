/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next dev` and `next build` both default to `.next`; building into it while a
  // dev server is live corrupts the server. `build:check` overrides this so a
  // verification build lands in a separate dir and can't clobber dev.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // bands.ts imports data/word-bands.json directly, so the tracer bundles it
  // automatically — no outputFileTracingIncludes needed.
};

export default nextConfig;
