import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts", "cn.ts", "theme.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: false,
  splitting: true,
  target: "es2022",
});
