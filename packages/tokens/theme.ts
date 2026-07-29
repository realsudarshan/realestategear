// Per-app theme config — the "components.json" of the import-based distribution.
// An app provides a `theme.config.ts` (validated by ThemeConfigSchema), and
// `compileThemeCss` turns it into a `:root`/`.dark` OKLCH override that layers on
// top of preset.css. Only brand tokens change; the structural contract (token
// names, spacing, the @theme map) is inherited from the preset and never edited.
//
import { converter, wcagContrast, clampChroma } from "culori";
import { z } from "zod";

const Hex = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, "expected a hex color like #065f46");

const CssRadius = z
  .string()
  .max(24)
  .regex(
    /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em))$/,
    "expected 0 or a non-negative px, rem, or em length",
  );

export const ThemeConfigSchema = z.object({
  /** Brand colors as hex. `primary` is required; the rest fall back to the
   *  canonical default palette so a minimal config is just a primary color. */
  palette: z.object({
    primary: Hex,
    accent: Hex.optional(),
    ring: Hex.optional(),
    background: Hex.optional(),
    foreground: Hex.optional(),
    destructive: Hex.optional(),
    success: Hex.optional(),
    warning: Hex.optional(),
  }),
  /** Base radius. Constrained to safe length units before CSS interpolation. */
  radius: CssRadius.default("0.375rem"),
});

export type ThemeConfig = z.input<typeof ThemeConfigSchema>;

/** Identity helper for editor autocomplete in an app's theme.config.ts. */
export function defineTheme(config: ThemeConfig): ThemeConfig {
  return config;
}

// --- canonical default palette (mirrors palette.default.css) ----------------

const DEFAULT_LIGHT: Record<string, string> = {
  "--radius": "0.375rem",
  "--background": "oklch(0.975 0.006 88)",
  "--foreground": "oklch(0.22 0.015 252)",
  "--card": "oklch(0.995 0.003 88)",
  "--card-foreground": "oklch(0.22 0.015 252)",
  "--popover": "oklch(0.997 0.002 88)",
  "--popover-foreground": "oklch(0.22 0.015 252)",
  "--primary": "oklch(0.205 0 0)",
  "--primary-foreground": "oklch(0.99 0 0)",
  "--secondary": "oklch(0.95 0.004 255)",
  "--secondary-foreground": "oklch(0.24 0.014 252)",
  "--muted": "oklch(0.946 0.004 255)",
  "--muted-foreground": "oklch(0.54 0.014 252)",
  "--accent": "oklch(0.948 0.008 252)",
  "--accent-foreground": "oklch(0.24 0.014 252)",
  "--destructive": "oklch(0.577 0.245 27.325)",
  "--success": "oklch(0.62 0.17 150)",
  "--success-foreground": "oklch(0.99 0 0)",
  "--warning": "oklch(0.75 0.14 72)",
  "--warning-foreground": "oklch(0.22 0.015 252)",
  "--border": "oklch(0.855 0.006 255)",
  "--input": "oklch(0.855 0.006 255)",
  "--ring": "oklch(0.34 0 0)",
  "--chart-1": "oklch(0.646 0.222 41.116)",
  "--chart-2": "oklch(0.6 0.118 184.704)",
  "--chart-3": "oklch(0.398 0.07 227.392)",
  "--chart-4": "oklch(0.828 0.189 84.429)",
  "--chart-5": "oklch(0.769 0.188 70.08)",
};

const DEFAULT_DARK: Record<string, string> = {
  "--background": "oklch(0.11 0.012 260)",
  "--foreground": "oklch(0.96 0.006 260)",
  "--card": "oklch(0.15 0.014 260)",
  "--card-foreground": "oklch(0.96 0.006 260)",
  "--popover": "oklch(0.15 0.014 260)",
  "--popover-foreground": "oklch(0.96 0.006 260)",
  "--primary": "oklch(0.92 0 0)",
  "--primary-foreground": "oklch(0.12 0 0)",
  "--secondary": "oklch(0.22 0.02 260)",
  "--secondary-foreground": "oklch(0.96 0.006 260)",
  "--muted": "oklch(0.2 0.018 260)",
  "--muted-foreground": "oklch(0.68 0.025 260)",
  "--accent": "oklch(0.22 0.02 260)",
  "--accent-foreground": "oklch(0.96 0.006 260)",
  "--destructive": "oklch(0.65 0.2 22)",
  "--success": "oklch(0.68 0.16 150)",
  "--success-foreground": "oklch(0.11 0.01 260)",
  "--warning": "oklch(0.76 0.14 72)",
  "--warning-foreground": "oklch(0.11 0.01 260)",
  "--border": "oklch(0.36 0.03 260)",
  "--input": "oklch(0.32 0.025 260)",
  "--ring": "oklch(0.92 0 0)",
  "--chart-1": "oklch(0.488 0.243 264.376)",
  "--chart-2": "oklch(0.696 0.17 162.48)",
  "--chart-3": "oklch(0.769 0.188 70.08)",
  "--chart-4": "oklch(0.627 0.265 303.9)",
  "--chart-5": "oklch(0.645 0.246 16.439)",
};

// --- color math -------------------------------------------------------------

const toOklch = converter("oklch");

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/** An sRGB-gamut-safe OKLCH color from a hex, optionally forcing lightness.
 *  clampChroma reduces chroma until the color fits sRGB, so forcing a dark-mode
 *  lightness on a saturated brand hue can't emit an oklch() the browser clips
 *  unpredictably. */
function oklchColor(hex: string, forceL?: number) {
  const c = toOklch(hex);
  if (!c) throw new Error(`theme: invalid color ${hex}`);
  const target = forceL != null ? { ...c, l: forceL } : c;
  return toOklch(clampChroma(target, "oklch")) ?? target;
}

function fmt(c: { l?: number; c?: number; h?: number }): string {
  return `oklch(${round(c.l ?? 0, 4)} ${round(c.c ?? 0, 4)} ${round(c.h ?? 0, 2)})`;
}

const FG_LIGHT = "oklch(0.99 0 0)";
const FG_DARK = "oklch(0.18 0.02 260)";

/** Pick near-white or near-black foreground by real WCAG contrast against the
 *  surface (not a lightness threshold), so a mid-lightness brand color can't
 *  ship sub-4.5:1 label text. */
function bestForeground(surface: string): string {
  return wcagContrast(surface, FG_DARK) > wcagContrast(surface, FG_LIGHT)
    ? FG_DARK
    : FG_LIGHT;
}

/** A brand surface + a readable foreground, guaranteeing WCAG AA (4.5:1). For
 *  saturated mid-lightness hues where neither flat foreground clears 4.5:1, the
 *  surface is nudged darker (keeping hue) until the best foreground passes — a
 *  small, deterministic accessibility correction rather than shipping unreadable
 *  labels. */
function brandSurface(hex: string, forceL?: number): { surface: string; fg: string } {
  let color = oklchColor(hex, forceL);
  let surface = fmt(color);
  let guard = 0;
  while (
    Math.max(wcagContrast(surface, FG_DARK), wcagContrast(surface, FG_LIGHT)) < 4.5 &&
    (color.l ?? 1) > 0.25 &&
    guard++ < 24
  ) {
    color = oklchColor(hex, (color.l ?? 0) - 0.03);
    surface = fmt(color);
  }
  return { surface, fg: bestForeground(surface) };
}

/** Compile a theme config to a `:root { … } .dark { … }` CSS string. Non-brand
 *  tokens are copied from the canonical default palette; brand tokens are
 *  derived from the config (dark variants by a lightness shift). */
export function compileThemeCss(input: ThemeConfig): string {
  const cfg = ThemeConfigSchema.parse(input);
  const light: Record<string, string> = { ...DEFAULT_LIGHT };
  const dark: Record<string, string> = { ...DEFAULT_DARK };

  light["--radius"] = cfg.radius;

  const { palette } = cfg;

  // primary (+ ring defaults to primary). brandSurface picks a WCAG-AA
  // foreground and gamut-clamps; dark variants are forced to a readable lightness.
  const pL = brandSurface(palette.primary);
  light["--primary"] = pL.surface;
  light["--primary-foreground"] = pL.fg;
  const pD = brandSurface(palette.primary, 0.72);
  dark["--primary"] = pD.surface;
  dark["--primary-foreground"] = pD.fg;

  const ring = palette.ring ?? palette.primary;
  light["--ring"] = fmt(oklchColor(ring));
  dark["--ring"] = fmt(oklchColor(ring, 0.72));

  if (palette.accent) {
    const aL = brandSurface(palette.accent);
    light["--accent"] = aL.surface;
    light["--accent-foreground"] = aL.fg;
    const aD = brandSurface(palette.accent, 0.3);
    dark["--accent"] = aD.surface;
    dark["--accent-foreground"] = aD.fg;
  }

  for (const key of ["background", "foreground", "destructive", "success", "warning"] as const) {
    const v = palette[key];
    if (v) light[`--${key}`] = fmt(oklchColor(v));
  }

  return `${block(":root", light)}\n\n${block(".dark", dark)}\n`;
}

function block(selector: string, vars: Record<string, string>): string {
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `${selector} {\n${body}\n}`;
}
