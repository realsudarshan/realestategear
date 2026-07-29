// Compiles theme.config.ts → app/theme.generated.css via the @realestategear/tokens
// compiler. Runs before `dev` and `build`; run manually with `npm run gen:theme`.
// Excluded from the app's tsc program (tsconfig "exclude") — tsx runs it directly.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compileThemeCss } from "@realestategear/tokens/theme";
import theme from "../theme.config";

const out = fileURLToPath(new URL("../app/theme.generated.css", import.meta.url));
const css = `/* GENERATED from theme.config.ts by scripts/gen-theme.mts — do not edit. */\n${compileThemeCss(theme)}`;
writeFileSync(out, css);
console.log(`gen:theme → ${out}`);
