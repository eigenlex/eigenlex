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
});
