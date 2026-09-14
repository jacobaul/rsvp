import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the `@/*` path mapping in tsconfig.json.
      "@": root,
      // `server-only` throws outside a Next server bundle; tests import the
      // same modules directly, so swap it for a no-op.
      "server-only": `${root}test/server-only-stub.ts`,
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/__tests__/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/db-harness.ts"],
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
