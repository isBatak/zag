# Follow-up: formatMode runtime gating and bundle size

**Update: a real zero-bundle-cost redesign was prototyped and reverted.** A later pass replaced
`formatMode: "blur" | "change"` with an injected `format` strategy prop
(`format?: (locale, formatOptions) => InputMaskController`), plus a matching no-op `blurFormat` export for symmetry.
Verified with a real bundler (esbuild, minify + tree-shaking) that this genuinely achieves the goal below of zero added
bytes for consumers who never opt in - about +485 B gzip when a consumer does opt in, 0 B when they don't, confirmed by
grepping the tree-shaken output for the live-format symbols. Reverted anyway: review judged the `blurFormat` no-op
export not worth carrying (it does nothing but document a default that already exists via `undefined`), and preferred
the plain `"blur" | "change"` enum's simplicity over a real but sub-kilobyte bundle-size win. The runtime-gating fix in
this file stayed as the final state - `formatMode` again, still gated on itself so `"blur"` mode never constructs the
mask.

Follow-up to `05-number-input-live-format-mode.md`, filed after review flagged that `formatMode` was bundling both
formatting code paths together instead of being an explicit, gated choice.

## Problem

The first pass computed the `changeModeMask` (decoration extraction + `createInputMask`) any time `formatOptions` was
set, regardless of `formatMode`. `"blur"` users who also set `formatOptions` were paying to construct and re-run the
live-formatter's setup on every locale/formatOptions change, even though nothing ever consumed the result. `formatMode`
was a filter applied after the fact in `setValue`, not an actual gate.

## Fix

Folded `formatMode` into the `changeModeMask` memo's own dependency array so the mask/decoration logic only executes
when the user has explicitly opted into `"change"`:

```ts
changeModeMask: memo(
  ({ prop }) => [prop("formatMode"), prop("locale"), prop("formatOptions")],
  ([formatMode, locale, formatOptions]) =>
    formatMode === "change" ? createChangeModeMask(locale, formatOptions) : undefined,
),
```

`"blur"` mode (the default) now never constructs an `Intl.NumberFormat` for decoration purposes, never builds a mask
controller, and never runs the live-formatter — the single `formatMode` prop is a real switch, not a filter on top of
always-on work.

## What this fix does _not_ do: reduce bundle size

Measured directly (built `@zag-js/number-input` before/after via `git stash`, comparing the unminified ESM dist that a
downstream bundler consumes and then minifies/gzips itself):

| file                       | before   | after    | delta      |
| -------------------------- | -------- | -------- | ---------- |
| `number-input.machine.mjs` | 15,634 B | 16,051 B | +417 B     |
| `number-input.utils.mjs`   | 1,068 B  | 3,695 B  | +2,627 B   |
| **gzip (both files)**      | 3,911 B  | 4,763 B  | **+852 B** |

~3 KB raw / ~0.85 KB gzipped added to the package's dist. No new dependency — `@zag-js/input-mask` was already pulled in
for cursor recording, so this is purely the new `getNumberDecoration`/`createChangeModeMask` functions plus wiring.

The runtime gate above stops wasted _computation_, but `createChangeModeMask` is still a plain function reachable from
`number-input.utils.ts`'s module scope. A consumer's bundler ships it whether or not `formatMode: "change"` is ever used
— static analysis can't prove it's dead code from a runtime prop check. Every consumer of `@zag-js/number-input` pays
the ~0.85 KB gzip, not just those who opt into `"change"`.

## Alternative considered: code-split the change-mode formatter

Move `getNumberDecoration`/`createChangeModeMask` into their own module and load it lazily (e.g. a dynamic `import()`
inside an effect, triggered only when `prop("formatMode") === "change"`), swapping the mask into `computed` once the
chunk resolves.

- **Pro:** blur-only consumers ship zero bytes for the live-formatter.
- **Con:** introduces an async gap — typing during the window before the chunk resolves would need a fallback (likely
  raw passthrough), which is a real behavioral edge case, not just an implementation detail.
- **Con:** every other machine in this codebase is synchronous top-to-bottom; this would be the first one with an
  async-loaded code path, which is a bigger architectural precedent than this feature warrants.
- **Con:** the saving is ~0.85 KB gzipped — smaller than this paragraph will be once minified.

## Decision

Keep the current single-module, runtime-gated implementation. The complexity and precedent cost of code-splitting isn't
justified by sub-kilobyte savings. Worth revisiting only if `06` (presets) adds substantially more change-mode-only code
and the cumulative always-shipped weight becomes real (tens of KB, not under 1).
