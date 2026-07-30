# Real Estate Gear Design Contract

This document defines the public Portal and shared-package design contract.
Commercial and customer-specific applications may consume the same packages, but
their product history and private interface decisions do not belong here.

## Design Thesis

Real Estate Gear uses compact soft brutalism: structured, calm, border-first
interfaces with restrained motion and real-estate polish.

- Prefer visible borders and tonal separation over glow, blur, and heavy shadow.
- Use small, disciplined radii instead of universally rounded containers.
- Optimize for legibility and direct action before decorative flourish.
- Keep standout panels near white against a quieter warm-neutral canvas.
- Reserve strong contrast for actions, navigation state, and focused emphasis.
- Let listing imagery carry desirability; interface chrome should remain quiet.

## Public Portal

The Portal serves home shoppers and listing browsers. It should make search,
filters, saved context, listing eligibility, and inquiry actions immediately
legible.

- Use a structured responsive grid and direct, concise copy.
- Keep search and the highest-value action visible without relying on a theatrical
  hero treatment.
- Favor flat listing cards, obvious map/list relationships, and stable filter
  surfaces.
- Avoid magazine typography, decorative gradients, glass effects, oversized
  rounding, and generic luxury-template styling.

## Typography

- Use Geist Sans for UI, labels, body copy, navigation, and headings.
- Use Geist Mono for tabular metrics, timestamps, IDs, and compact metadata.
- Do not introduce Inter as the primary UI font.
- Do not require a decorative display font for public-site identity.
- Default product text should use compact body sizes; reserve display sizes for
  genuine marketing moments.
- Default icons should be 14-16px, with larger accessible hit targets when needed.

## Color And Tokens

Shared components use semantic roles rather than brand values:

- `background`, `foreground`, `card`, and `popover` define surfaces;
- `primary`, `secondary`, `muted`, and `accent` define hierarchy;
- `border`, `input`, and `ring` define structure and focus;
- `success`, `warning`, `destructive`, and `info` communicate state.

Applications may replace brand hues while preserving token names, contrast,
spacing, radius discipline, and action hierarchy. Dark mode must preserve surface
and border distinctions rather than simply invert colors.

The default public palette is a warm-neutral foundation with an ink foreground,
near-white surfaces, visible neutral borders, and a restrained natural primary.

## Spacing And Layout

- Use an 8px base unit with 4px half steps for compact component details.
- Standard page content should remain within 1280px.
- Search layouts may expand to 1440px for map/list composition.
- Use a 6px base radius; larger media cards may use 8px when necessary.
- Borders and surface tone should carry hierarchy before shadows.
- Public sections may open around imagery, but component chrome stays compact.

## Motion

- Use motion to confirm state, not to add personality by itself.
- Micro interactions should generally complete within 75-200ms.
- Drawers, dialogs, filters, and save states should feel immediate.
- Buttons and inputs must not bounce or scale aggressively.
- Respect reduced-motion preferences; color, text, and borders must still
  communicate state.

## Components

- Use one filled primary action per area.
- Use outline or quiet surfaces for secondary actions.
- Keep labels visible; placeholders are assistive, not structural.
- Put success and error feedback near the affected action or panel.
- Do not rely on toast-only feedback for local state changes.
- Optimize tables and lists for scan rhythm, stable row height, and clear status.
- Shared components must be accessible, brand-neutral, and free of product copy,
  routes, persistence policy, or business workflow assumptions.

## Source Of Truth

- `packages/tokens` owns shared semantic tokens and theme compilation.
- `packages/ui` owns reusable accessible primitives.
- `apps/portal/app/globals.css` is the current public implementation.
- Application-specific branding and compositions remain in the application.

Review this contract before changing shared UI or Portal-wide styling. A durable
change to these principles should update this document in the same pull request.
