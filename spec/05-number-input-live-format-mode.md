# Step 5: number-input live-formatting mode (depends on step 04)

## Scope

Add a `formatMode: "blur" | "change"` prop to `number-input`, defaulting to `"blur"` (today's unchanged behavior: the
field shows the raw typed value while focused and only reformats on blur/Enter/increment/decrement). `"change"` mode
reformats as the user types, built on top of the mask-template engine from `04-mask-template-engine.md` rather than as a
one-off number-input hack.

## Why this needs the mask engine, not just a different trigger

Investigated the current flow precisely: `INPUT.CHANGE` calls the `setValue` action, which stores the raw typed string
with no formatting at all. Formatting only happens via `setFormattedValue`, called on
`INPUT.BLUR`/`INPUT.ENTER`/increment/decrement, which round-trips the value through `parseValue`/`formatValue` - thin
wrappers around `@internationalized/number`'s `NumberParser`/`Intl.NumberFormat`.

Checked `NumberParser` and `NumberFormatter`'s full type definitions directly: neither exposes anything for
partial/in-progress values. `parse()` and `format()` only operate on complete numbers. Naively calling the existing
`formatValue` on every keystroke breaks decimal entry: typing `"12."` would round-trip as
`parse("12.") -> 12 -> format(12) -> "12"`, silently deleting the decimal point on the next render. Same failure for a
lone `"-"`, or a trailing `"0"` in the fraction depending on `minimumFractionDigits`. This is a structural mismatch
between "format a finished number" and "format a number still being typed," not a bug to patch.

The known-working pattern for this problem: split the raw value at the decimal separator, live-format only the integer
portion with grouping, and leave the fractional tail exactly as typed until commit - so the in-progress part never
passes through the all-or-nothing formatter. This requires exactly the "which positions are literal/decoration vs.
editable" concept the mask engine already needs for fixed templates (currency symbol prefix, percent suffix, grouping
separators) - so building this mode on `createInputMask` means one real, concrete consumer proves that abstraction,
instead of solving the same problem twice with divergent logic.

## API

```ts
formatMode?: "blur" | "change" // default: "blur"
```

Naming: an enum, not a boolean, chosen deliberately over the terser `formatOnChange: boolean` alternative so a future
third mode (e.g. debounced formatting) doesn't require a breaking prop-shape change later.

## Design sketch (to refine once 04 lands)

- In `"change"` mode, `INPUT.CHANGE` builds the live-formatted string via a `createInputMask`-style formatter configured
  with the integer-grouping-only strategy above, instead of the plain `setValue` passthrough.
- The mask engine's literal-position awareness (from `04`) handles the currency/percent decoration and grouping
  separators for cursor placement, reusing the same `recordCursor`/`restoreCursor` machinery already wired into
  `syncInputElement` - no separate cursor logic needed for this mode.
- `onBeforeInput`'s existing `isValidPartialNumber` gate stays as the first line of defense (rejecting keystrokes that
  can't lead to a valid number at all); live formatting only changes what's displayed for keystrokes that pass that
  gate.

## Deliverable

`formatMode` prop wired into `number-input.types.ts`/`.props.ts`, the `"change"` mode implemented via
`@zag-js/input-mask`, `"blur"` mode's existing tests unchanged and still passing, new tests for decimal/negative-sign/
currency-decoration live typing under `"change"` mode.

## Verification

`pnpm exec vitest run packages/machines/number-input` plus a manual smoke test in the number-input example: type a
decimal currency value under `formatMode: "change"` and confirm the decimal point and trailing zeros can actually be
entered.

## Follow-up

See `05a-formatmode-runtime-gating-and-bundle-size.md`: made `formatMode` a real runtime gate (not just a post-hoc
filter), measured that this doesn't reduce bundle size for consumers who never use `"change"`, and documents a
zero-bundle-cost redesign that was prototyped, verified to work, and then reverted in favor of keeping the simpler
`"blur" | "change"` enum.
