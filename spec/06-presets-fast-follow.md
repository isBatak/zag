# Step 6 (deferred, optional): number/currency presets

## Scope

`numberMask`/`currencyMask` preset builders wrapping `@internationalized/number`'s `NumberParser`/`Intl.NumberFormat` —
the same tools `number-input.utils.ts` already uses — so locale/digit-grouping bugs (non-Latin numerals, locale-specific
grouping) can't resurface in a hand-rolled reimplementation. No date/phone/ credit-card presets: those are `mask`
template strings a consumer supplies directly, documented as README recipes rather than shipped as one-off preset
functions per format.

## Why deferred

Nothing in steps 1-4 depends on it; pure sugar on a stable API, safe to skip or postpone without blocking anything.

## Deliverable

`presets.ts` + tests + README section. Optionally, a follow-up look at whether `number-input`'s `onBeforeInput`
partial-number gate could reuse the preset's `accept` predicate — noted as a possibility, not committed to here.
