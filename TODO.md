# Public Roadmap

## Shared UI

- Add generic Command primitives while keeping each product's command catalog local.
- Promote Calendar after defining its locale, date-boundary, and accessibility contract.
- Promote DateTimePicker after adding clear behavior, timezones, bounds, disabled states, IDs, and errors.
- Add an accessible selection-card composition using radio or `aria-pressed` semantics.
- Add a sortable table-heading helper that owns `aria-sort` behavior.
- Decouple the generic sidebar shell from Agent HQ storage, breakpoints, labels, and shortcuts before sharing it.
- Revisit DataTable only after keyboard-accessible row navigation and an optional TanStack boundary exist.
- Add Chart as an optional package only if a second product adopts Recharts.
- Replace the `radix-ui` barrel dependency with the specific Radix primitives used by the shared package.
- Migrate Agent HQ compatibility re-exports to direct `@realestategear/ui/*` imports.

Product-specific property search, CRM workflows, transaction interfaces,
command behavior, navigation composition, and branding stay in their owning applications.
