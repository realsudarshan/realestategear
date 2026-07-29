# @realestategear/ui

Accessible, brand-neutral React primitives for Real Estate Gear applications. Brand
assets and product-specific compositions belong to consuming applications.

The package requires React 19 and `@realestategear/tokens`. Applications using
Tailwind v4 must register `@realestategear/ui/dist` as a source in their global CSS.

For example, from a conventional Next.js `app/globals.css`:

```css
@import "@realestategear/tokens/preset.css";
@source "../../node_modules/@realestategear/ui/dist";
```

Adjust the relative path for the stylesheet location.
