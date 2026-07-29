import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Server-code tests (route handlers, lib/) run in the default 'node'
// environment. Component tests should opt into jsdom per-file with a
// `// @vitest-environment jsdom` comment at the top of the file.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**"],
  },
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
});
