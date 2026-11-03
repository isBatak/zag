# Overview: format-as-you-type masking for zag.js

## Why

A common need for text inputs is "format-as-you-type": reformatting the displayed value on every keystroke (currency
grouping, phone numbers, dates, credit cards) while keeping the text caret in the expected place. zag.js's
`number-input` machine already solves this for numeric formatting with a private algorithm at
`packages/machines/number-input/src/cursor.ts`. That algorithm does a plain longest-common-prefix/suffix **string diff**
between the old and new displayed value to relocate the caret — it never assumes anything about the _identity_ of
individual characters, only about how the two strings differ. That property matters: a whole class of caret-placement
bugs shows up in other format-as-you-type implementations specifically because they track caret position by matching
"accepted" characters and assuming their order and identity survive formatting — an assumption that breaks under
character substitution (e.g. reformatting a decimal separator) or when literal separators shift around during editing. A
pure string-diff approach sidesteps that assumption entirely.

The gap: zag's algorithm is private to one machine, has no dedicated regression coverage for known edge cases in this
problem space, and has no support for fixed placeholder templates (phone/SSN/date masks like `__-__-____`) — which is
the most common reason to want format-as-you-type masking in the first place.

## Evidence base

Catalogued a set of known, recurring edge cases in caret-preserving format-as-you-type inputs, gathered from general
prior art in this space (open-source input-masking libraries, their issue trackers, and their test suites). These are
used purely as a checklist of scenarios worth verifying — not as a dependency, reference implementation, or attribution
— and are restated below in our own terms as test scenarios in `01-failing-tests-baseline.md`.

## Ranked scenarios and what they actually require

| Scenario                                                                                                                                                                      | What it is                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Delete across a run of literal separator characters (e.g. `") "`) gets "stuck" one character short, so repeated deletes become no-ops                                         | Free-form/growing-format bug: the caret recompute only skips one non-content character instead of the whole literal run                        |
| Deleting the digit right before a decimal separator lands the next typed digit one slot too late                                                                              | Same class as above — free-form format, no fixed template involved                                                                             |
| Reformatting that substitutes one content character for another (e.g. changing a decimal separator, or case-folding text) breaks caret placement                              | Only happens under an approach that tracks caret position by character _identity_ — structural, not a patchable bug in that class of algorithm |
| Caret doesn't land before appended trailing literal text after formatting                                                                                                     | Same class as the substitution case above                                                                                                      |
| Fixed-template masks (`__-__-____`) silently overwrite already-typed digits with no length cap; insert-vs-overwrite editing semantics are often undocumented and inconsistent | Distinct feature: a fixed placeholder template needs an explicit max length and an explicit insert-vs-overwrite mode, not a caret-diff fix     |
| Consumers having to manually pre-format the initial value before passing it in                                                                                                | DX footgun — the initial value should be formatted eagerly by the library, not left to the caller                                              |
| Locale-formatted numbers (non-Latin numerals, locale-specific grouping) misbehaving without special handling                                                                  | Only matters for an optional number/currency preset built on locale-aware parsing                                                              |
| Denylist-style "reject these characters" configuration being confusing and error-prone compared to an allowlist                                                               | API-naming lesson: prefer an explicit allowlist (`accept`) over a denylist                                                                     |

**The literal-run and decimal-adjacency scenarios are a free-form-format problem** the existing diff engine may already
solve — this must be proven with real test data, not assumed, which is exactly why writing failing tests comes before
any refactor. **The fixed-template overwrite/max-length scenario is a genuinely new feature.** The substitution/append
scenarios are a property of choosing a diff-based core over a character-identity-tracking approach, verified alongside
the same test pass. The DX and API-naming scenarios are shape decisions applied at zero extra cost when the new
package's public API is designed.

## Overall decision

Build `@zag-js/input-mask` under `packages/utilities/input-mask` (scaffolded via `pnpm generate-util`, matching the
`highlight-word`/`date-utils` package shape). `number-input` becomes its first consumer rather than the algorithm being
built directly into it — the diff engine has zero numeric awareness today, and locking it inside a numeric machine would
block reuse for phone/date/credit-card masks, which are the actual reason to want format-as-you-type masking as a
general capability. This mirrors the existing convention where utility packages (`date-utils`, `color-utils`) hold
framework-agnostic logic that machines depend on, never the reverse.

## Execution order

`01` (failing tests, no structural change) -> `02` (extract, informed by `01`'s verdict) -> `03` (adopt in number-input,
dedup checkpoint) -> `04` (new mask-template feature, scoped by `01`'s findings) -> `05` (number-input live-formatting
mode, depends on `04`) -> `06` (presets, deferred/optional).

Status: `01`-`05` done, including the `05a` follow-up (runtime gating for `formatMode`; a zero-bundle-cost
strategy-injection redesign was prototyped, verified, and reverted in favor of the simpler enum - see `05a`). `06`
(presets, deferred/optional) is next, if wanted.
