import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: false,
  splitting: false,
  target: "node20",
});
