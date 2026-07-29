// @realestategear/tokens — shared design tokens, cn(), and the per-app theme compiler.
// CSS is consumed directly: `@import "@realestategear/tokens/preset.css"` (structural,
// brand-neutral) + a per-app palette (palette.default.css, or a theme.config.ts
// compiled via compileThemeCss).
export { cn } from "./cn";
export {
  ThemeConfigSchema,
  defineTheme,
  compileThemeCss,
  type ThemeConfig,
} from "./theme";
