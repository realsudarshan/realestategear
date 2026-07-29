import { defineTheme } from "@realestategear/tokens/theme";

// Edit these values to match the portal brand. The token compiler turns them into
// app/theme.generated.css (an OKLCH :root/.dark override layered on top of
// the brand-neutral preset, WCAG-AA + sRGB-gamut guaranteed).
// Regenerate after editing: `npm run gen:theme`.
export default defineTheme({
  palette: {
    primary: "#56664e",
    accent: "#8a5a3c",
  },
});
