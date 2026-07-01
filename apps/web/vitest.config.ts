import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws when imported outside an RSC bundle; stub it so the
      // server lib can be exercised under Node.
      "server-only": fileURLToPath(new URL("./test/server-only.stub.ts", import.meta.url)),
    },
  },
  // tsconfig uses jsx:"preserve" (Next transforms it); vitest goes through
  // esbuild, so enable the automatic React runtime for JSX in tests.
  esbuild: { jsx: "automatic" },
  test: {
    // Default to node; component tests opt into jsdom via a per-file
    // `// @vitest-environment jsdom` docblock.
    environment: "node",
    setupFiles: ["./test/setup.ts"],
  },
});
