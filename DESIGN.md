# Design System — Real Estate Gear

## Product Context
- **What this is:** Real Estate Gear is a real-estate product system with two visible faces: public property-search websites and an internal agent workspace.
- **Who it's for:** Home shoppers, listing browsers, and residential real-estate agents who need a fast CRM and workflow console.
- **Space/industry:** Residential real estate. Reference patterns include premium IDX/property sites and agent CRM dashboards such as Sierra Interactive and Luxury Presence.
- **Project type:** Multi-app web platform with branded public sites and a dashboard-style internal tool.

## Design Thesis
Real Estate Gear should feel like one product family built from the same taste: **compact soft brutalism**.

That means:
- border-first structure instead of relying on glow and depth
- cooler warm-neutral surfaces instead of parchment-heavy warmth
- tight radius discipline instead of bubbly rounding
- dense, legible layout before decorative flourish
- near-white standout panels against a quieter canvas
- small type and icons that make the interface feel fast
- one neutral primary accent used for intent, not wallpaper

Agent HQ is the strongest current expression of that taste. Public sites should adapt the same DNA for customer-facing browsing rather than switching to a different editorial language.

## Shared Foundation
- **Aesthetic direction:** Compact soft brutalism with real-estate polish. Structured, tactile, calm, and slightly IDE-like in density.
- **Decoration level:** Low. Use contrast, border rhythm, and image choice before gradients, blur, shadows, or ornamental effects.
- **Layout approach:** Grid-disciplined first. Public pages may loosen the grid slightly around imagery, but should still read as structured surfaces rather than magazine spreads.
- **Motion approach:** Intentional and restrained. Motion should confirm state, not add personality by itself.

## Safe Choices
- **Search-first structure:** Public experiences should make search, filters, saved context, and map/list relationships immediately legible because that is still table stakes.
- **Dense but readable CRM views:** Agent HQ should preserve clear tables, pipeline views, and workflow surfaces because operators care about scan speed more than novelty.
- **Semantic token contract:** All apps should keep shared token names such as `background`, `foreground`, `card`, `primary`, `muted`, `border`, and `ring` so themes remain portable.

## Deliberate Risks
- **Soft brutalism as the house style:** Public sites should inherit Agent HQ’s border-first confidence instead of defaulting to glossy luxury-site tropes. This makes the system more distinctive, but it requires discipline to avoid feeling too severe.
- **Cooler warm-neutral shell everywhere:** The repo should avoid both blue-gray enterprise chrome and overly cozy parchment. The gain is precision and tactility; the tradeoff is less plush real-estate warmth.
- **Accent sparingness:** Each app should reserve its strongest contrast accent for action, navigation state, and focused emphasis. This creates hierarchy, but only if secondary surfaces stay quiet.

## Expressions

### Public Sites
- **Role:** Showcase listings, build trust, and make search feel direct.
- **Mood:** Structured, calm, customer-facing.
- **Interaction bias:** Clear search affordances, flatter panels, stronger visible borders, restrained marketing copy, and fewer “hero” gestures.
- **Not this:** magazine-style typography, luxury-template theatrics, decorative gradients, or overly softened card shapes.

### Agent HQ
- **Role:** Help agents triage, communicate, and move deals forward.
- **Mood:** Calm, focused, operator-grade.
- **Interaction bias:** More information density, tighter spacing, persistent navigation, and explicit state.
- **Distribution:** Commercial product interfaces are maintained outside this repository but share the public token contract.

## Typography
- **Shared UI font:** `Geist Sans` for UI, labels, body copy, navigation, and headings across all apps.
- **Shared mono/data font:** `Geist Mono` for tabular metrics, timestamps, IDs, and compact secondary metadata.
- **Rule:** Do not introduce `Inter` as the primary UI font in any app.
- **Rule:** Public sites should not depend on a decorative display font for identity. Structure, spacing, imagery, and copy should carry the tone.
- **Density rule:** Default product UI should sit at `body-sm` or `body-md`; reserve large display sizes for true marketing moments.
- **Icon rule:** Default UI icons should be 14-16px. Metadata, badges, and inline status icons should be 12-14px. Touch-only triggers may keep larger hit targets while the glyph stays small.
- **Scale:**
  - `display-xl`: 3.25rem / 1.0 / tight
  - `display-lg`: 2.5rem / 1.05 / tight
  - `heading-xl`: 1.875rem / 1.1
  - `heading-lg`: 1.5rem / 1.15
  - `heading-md`: 1.25rem / 1.2
  - `body-lg`: 1rem / 1.55
  - `body-md`: 1rem / 1.6
  - `body-sm`: 0.875rem / 1.45
  - `body-xs`: 0.8125rem / 1.4
  - `meta-xs`: 0.75rem / 1.35 / uppercase or mono only when needed

## Color
- **Approach:** Shared semantic roles, app-specific palettes.
- **Foundation neutrals:**
  - `background`: cooler soft off-white or quiet dark, never default app gray
  - `foreground`: ink-charcoal in light mode, chalk-off-white in dark mode
  - `card`: close to white in light mode and visibly distinct from `background`, primarily through border and tone rather than heavy shadow
  - `popover`: close to white and flat; overlays should feel like panels, not floating glass
  - `border`: always visible enough to carry structure
- **Semantic colors:**
  - `success`: confident green, not neon
  - `warning`: amber with strong text contrast
  - `error`: brick or signal red
  - `info`: derived from the active accent where possible
- **Dark mode strategy:** Rebuild surfaces instead of simply inverting them. Preserve border contrast and reduce saturation slightly.

### Default Public Palette
- **Background:** `#F5F3EE`
- **Surface:** `#FEFCF8`
- **Foreground:** `#1E2329`
- **Primary:** `#56664E`
- **Secondary accent:** `#8A5A3C`
- **Muted text:** `#66707C`
- **Border:** `#DAD7CE`

### Default Agent HQ Palette
- **Background:** `#F6F4EF`
- **Surface:** `#FEFCF8`
- **Foreground:** `#1F2430`
- **Primary:** `oklch(0.205 0 0)` near-black neutral
- **Muted text:** `#667085`
- **Border:** `#D8DDE5`
- **Success:** `#2F855A`

### Brand Override Rule
Branded public sites may replace `primary` and supporting accent hues while keeping the same token contract, spacing scale, radius discipline, and action hierarchy.

## Spacing
- **Base unit:** 8px
- **Density:** Compact across the repo. Public pages can open up around imagery, but component chrome should stay tight.
- **Scale:** `2xs` 4, `xs` 8, `sm` 12, `md` 16, `lg` 24, `xl` 32, `2xl` 48, `3xl` 64
- **Rule:** Agent HQ should mostly live between `2xs` and `lg`. Public sites may stretch to `2xl` in sectional layouts, not in component chrome.

## Layout
- **Grid:** 12-column responsive layout for public pages. CRM shell uses sidebar plus content rail with predictable inner grids.
- **Max content width:** 1280px for standard page content, up to 1440px for property-search layouts with map/list split.
- **Border radius:** `6px` base, `8px` for larger public-facing media cards only when needed. Avoid large, universal rounding.
- **Shadows:** Minimal. Borders, tone separation, and hierarchy should do most of the work.

## Motion
- **Approach:** Intentional
- **Easing:** `ease-out` for enter, `ease-in` for exit, `ease-in-out` for position changes
- **Duration:** micro `75-100ms`, short `150-200ms`, medium `220-320ms`, long `350-500ms`
- **Rules:**
  - Buttons and inputs should not bounce or scale aggressively.
  - Button hover states may animate child icons with a 1-2px shift or a 2deg rotation.
  - Maps, filters, drawers, dialogs, and inline save states should feel crisp and immediate.
  - AI-related affordances may get a slight emphasis treatment, but never novelty animation.
  - Respect reduced-motion preferences; color and border changes must still communicate state.

## Component Philosophy
- **Primary actions:** one filled action per area
- **Secondary actions:** outline or subtle surface treatment
- **Tertiary actions:** ghost or inline text
- **Cards:** use borders first, shadow second
- **Cards:** standout panels should use near-white `card`/`popover` surfaces against the quieter background
- **Tables and lists:** optimize for scan rhythm, stable row height, smaller icons, and clean status hierarchy
- **Forms:** labels always visible; placeholders are assistive, not structural
- **Maps and search:** the most valuable search affordance should be visible above the fold
- **Inline feedback:** success and failure should appear next to the triggering action or inside the affected panel; avoid toast-only feedback for actions that change local state

## Token Alignment Priorities

### `apps/portal/app/globals.css`
- Keep the warm public palette and visible border structure.
- Remove dependence on decorative display-font tokens.
- Keep `--radius` at the small end of the scale and treat brand colors as token overrides, not separate aesthetics.

## Surface Revision Priorities
- **First:** `apps/portal` homepage, search, and listing primitives.
- **Second:** shared public-site navigation, footer, and listing-page filter surfaces.

## App Notes

### Public Sites
- Favor direct copy, strong search structure, flatter cards, and obvious map/list relationships.
- Use imagery and layout rhythm to create desirability, not decorative type or premium-template tropes.
- Avoid purple gradients, feature-grid fluff, oversized rounding, and too much glass or blur.

## Current Codebase Alignment
- `apps/portal/app/globals.css` is the current public implementation of the intended language.
- Shared components in `packages/ui` should preserve the same radius discipline, border weight, and low-decoration philosophy.

## Reference Sites
- [Sierra Interactive](https://www.sierrainteractive.com/)
- [Luxury Presence](https://www.luxurypresence.com/)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-14 | Defined one shared foundation with two expressions | Public listing experiences and CRM workflows need different surface behavior, but should still share token semantics and interaction principles |
| 2026-04-14 | Standardized shared UI typography on Geist Sans + Geist Mono | The codebase already loads Geist, so aligning CSS to it removes drift and keeps implementation friction low |
| 2026-04-14 | Re-centered the repo on soft brutalism | Agent HQ already showed the strongest product taste, so the house style should grow from that instead of splitting into unrelated visual families |
| 2026-04-29 | Tightened the system toward compact precision | The suite should keep the shared soft-brutalist language while reducing warmth, radius, type scale, icon size, and excess spacing for a faster Zed-like product feel |
| 2026-06-16 | Centralized primitives into `@realestategear/ui`; kept Geist + 0.375rem radius + 1px borders after visual A/Bs | Agent HQ's design was already well-tuned; the shared library preserves it. Apps consume the package and customize via a per-app `theme.config.ts` |
| 2026-06-16 | Switched Agent HQ's primary from blue to teal (`oklch(0.52 0.11 200)`) | A/B in the `@realestategear/ui` gallery: teal read calmer/more fintech-professional while keeping the one-accent discipline. Scope was Agent HQ only at the time; CGH kept its own fairway green via `theme.config.ts` |
| 2026-06-28 | Switched the main product accent from teal/blue to neutral black (`oklch(0.205 0 0)`) | A neutral primary better fits the compact soft-brutalist direction, reduces brand-color noise, and keeps hierarchy driven by contrast, borders, and surface tone |
