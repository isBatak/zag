# Step 7 (proposal, not implemented): preserve precision across increment/decrement

## Bug

Reproduced live: with `formatOptions: { style: "currency", currency: "USD" }` and `step: 0.001`, clicking increment does
_nothing_ - `aria-valuenow` stays `"0"` across 8 clicks. With `step: 1`, increment works fine ($1.00 → $2.00 → $3.00).
So it's specifically `step < the format's rounding precision` (USD defaults to 2 fraction digits) that breaks it.

## Root cause

`increment`/`decrement`/`setClampedValue`/`setRawValue`/`incrementToMax`/ `decrementToMin` in `number-input.machine.ts`
all do:

```ts
context.set("value", formatValue(nextValue, { computed, prop }))
```

`context.value` is a single string, and it's also the _only_ source `valueAsNumber` reads from
(`parseValue(context.get("value"), ...)`). Storing the already-rounded, currency-formatted string means the next
increment reparses a value that's already lost anything below 2 decimal places:

```
click 1: valueAsNumber=0, +0.001 = 0.001 -> formatValue -> "$0.00" -> stored
click 2: valueAsNumber = parse("$0.00") = 0, +0.001 = 0.001 -> "$0.00" -> stored
... forever
```

This is distinct from `setFormattedValue` (used on blur/Enter), which _intentionally_ collapses to the format's
precision - that's correct, expected "commit and normalize" behavior for a completed edit, and several existing e2e
tests depend on it (`should handle zero variations`, leading-zero normalization, etc.). The bug is specifically that
increment/decrement reuse the same collapse-on-write pattern for an operation that isn't a commit.

## Proposed fix

Add a private, non-serialized "precise value" shadow to context that increment-family actions read from and write to, so
the display string can stay formatted (nothing about the public API/rendering changes) without that formatted string
being the _only_ record of the number:

```ts
// context()
preciseValue: bindable<number | null>(() => ({ defaultValue: null })),

// computed
valueAsNumber: ({ context, computed, prop }) =>
  context.get("preciseValue") ?? parseValue(context.get("value"), { computed, prop }),
```

- `increment`, `decrement`, `setClampedValue`, `setRawValue`, `incrementToMax`, `decrementToMin`: after computing
  `nextValue`, set both `context.set("preciseValue", nextValue)` and
  `context.set("value", formatValue(nextValue, ...))` - display unchanged, precision no longer lost.
- `setValue` (raw typing) and any external `value` prop change: set `preciseValue` back to `null` - once the user or the
  consumer supplies a literal string, that string becomes authoritative again and there's no "precise number"
  independent of it.
- `setFormattedValue` (blur/Enter): also resets `preciseValue` to `null` - this is the intentional
  collapse-to-display-precision point and should stay exactly as it behaves today.

## Alternative considered and rejected

Simpler fix: have increment/decrement store the raw unformatted number (`context.set("value", String(nextValue))`)
instead of the formatted string, relying on `syncInputElement`'s existing `computed("formattedValue")` branch for
non-`CHANGE` events to render the DOM correctly.

Rejected: `onValueChange` fires from the `value` bindable's own `onChange`, which reports the raw `context.value`, not
`formattedValue`. Consumers currently receive the _formatted_ string in `onValueChange` during increment/decrement
(`"$1.00"`, not `"1"`) - this alternative would silently change that public callback's payload for every existing
currency/percent consumer. The shadow-field approach touches nothing observable from outside the machine.

## Verification plan

- Unit: `valueAsNumber`/`preciseValue` interplay - increment N times with `step` finer than `formatOptions`' rounding
  precision, assert the underlying number actually advances (not just that the display eventually changes).
- e2e: repeat the currency + `step: 0.001` repro above, assert `aria-valuenow` changes on each click; re-run existing
  formatOptions e2e tests (`pressing enter trigger format`, `should maintain cursor position`, the `blur`/`change`
  formatMode tests) unchanged, to confirm the blur-commit collapse behavior they depend on is untouched.

## Status

Proposal only. Not implemented - scoped separately from the `formatMode` work in `05`/`05a`; this is a pre-existing
machine behavior, not something introduced by it.
