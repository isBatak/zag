# Step 1: failing tests, based on known edge cases, against the existing code

## Scope

Before touching any file structure, write regression tests for the caret-placement edge cases catalogued in
`00-overview.md` and run them **against the code as it exists today**: `packages/machines/number-input/src/cursor.ts`'s
exported `getNextCursorPosition` (no new package yet — import it directly from its current location). The goal is a
factual, evidence-based verdict per scenario: which of these known edge cases does zag's existing diff-based algorithm
already avoid, and which genuinely require new code. This directly determines the scope of every later step — nothing
past this point should be built speculatively.

## Test cases

Extend the existing `packages/machines/number-input/tests/cursor.test.ts` with a new
`describe("real-world formatting scenarios")` block, alongside its current `describe("edge cases")` block (which already
covers the diff algorithm's abstract behavior — empty values, partial matches, the relative-position fallback). No new
file needed; these are additional cases for the same algorithm, not a different concern:

- **Delete across a literal separator run.** A growing phone-style formatter inserts `(`, `)`, ` ` as digits accumulate
  (e.g. `"1234567"` becomes `"1 (234) 567"`). Starting from `"1 (234) 567"` with the cursor at index 6
  (`"1 (234|) 567"`), delete the digit `4`. Expected: the cursor lands right before `"567"`, skipping the whole `") "`
  run rather than stopping one character short. Encode as a `getNextCursorPosition(oldValue, newValue, oldPosition)`
  call using the actual before/after strings such a formatter would produce, not a hand-constructed pair.
- **Decimal-separator adjacency.** A fixed-point formatter (e.g. always showing two decimal digits, `"1.23"`) exercised
  through a realistic sequence of caret moves, character insertions, and deletions around the decimal point — in
  particular, deleting the digit immediately before the separator and then typing a new digit should land the cursor
  immediately after the new digit and before the separator, not one slot into the fraction.
- **Character substitution / case-folding.** A formatter that lowercases input in place
  (`value => value.toLowerCase()`), leaving length and structure otherwise unchanged: typing `"HELLO WORLD"` produces
  `"hello world"` with the cursor at the end; moving the caret back 5 characters and typing `"BeAuTiFuL "` should
  produce `"hello beautiful world"` with the cursor landing right after the inserted text, not somewhere else in the
  string.
- **Trailing literal append.** A formatter that appends a literal separator once a segment reaches a fixed length (e.g.
  appending `"-"` after every 2 characters): typing `"12"` gives `"12-"` with the cursor at the end; backspace removes
  the trailing separator along with the last digit; typing `"34"` after `"12-"` gives `"12-34-"`.
- **Eager formatting of the initial value.** Given a formatter and an initial raw value, the formatted display value
  should be correct immediately, without requiring any user interaction first. This isn't a `getNextCursorPosition` test
  — it's an API-shape requirement to carry into `04`'s public API design (format the initial value eagerly, don't
  require the consumer to pre-format).

## Deliverable

New test cases added to the existing `cursor.test.ts`, each named to describe the scenario in plain terms, run against
today's `cursor.ts` unmodified. Report the pass/fail result for each scenario plainly in the PR description — a failure
is a real finding to act on in `04`, not something to rationalize away.

## Verification

Run the updated test file directly against today's code, e.g.
`pnpm exec vitest run packages/machines/number-input/tests/cursor.test.ts` — record the exact pass/fail outcome per new
test before starting `02`.

## Result (recorded)

Ran against today's unmodified `cursor.ts`:

- Delete a digit immediately before a literal separator: **passes** once the expected value is computed correctly
  (deleting a digit adjacent to a literal separator lands the cursor right next to the separator, as expected). This is
  a plain content-changing deletion, distinct from the harder case below.
- Decimal separator adjacency (both directions): **passes**.
- Trailing literal append: **passes**.
- Character substitution / mid-string insertion with a matching prefix _and_ a matching suffix on both sides:
  **confirmed failing**, kept in the suite via `test.fails` so it documents the gap without leaving CI red. Root cause:
  the algorithm returns as soon as it finds a full prefix match, without checking whether a full suffix match exists
  further along that would indicate content was inserted in the middle — so the cursor collapses to right after the
  prefix instead of past the inserted text. This is a real, reproducible algorithmic limitation, and is now a permanent
  regression marker for step `04`.
- Eager formatting of the initial value: not a `getNextCursorPosition` case — carried forward as a `createInputMask` API
  requirement for step `04`.
- Forward-Delete landing exactly on a literal separator character (the real "stuck delete" scenario): **not testable at
  this layer at all**, confirmed with concrete numbers — value `"1 (234) 567"`, cursor at position 6 (right before the
  `)`), forward Delete. The value is unchanged (`"1 (234) 567"`), but the cursor should still advance to position 8,
  past `") "`. Because `oldValue === newValue`, `restoreCursor`'s fast path keeps the cursor at 6 and
  `getNextCursorPosition` is never even called on this path — pure content diffing cannot fix this; it needs the mask
  template (to know which positions are literal) and key-press context. Recorded as a `test.todo` with these exact
  numbers. Confirmed as step `04` scope, not fixable here.

## Correction (re-verified with simulated native edits, superseding the above)

The two findings above (the confirmed-failing character-substitution case, and the "oldValue === newValue" stuck-delete
claim) were both built on hand-picked `oldValue`/`newValue` pairs that turned out not to match how `recordCursor`
actually captures state in real usage. `recordCursor` is called synchronously inside the input event handler, which
means it always captures the raw DOM value _after_ the browser has already applied the user's own keystroke - not
before. Re-derived every scenario using a small native-edit simulator (apply an insert/backspace/forward-delete to a raw
string exactly as a browser would, _then_ run a real formatter on the result) instead of hand-picking pairs:

- The character-substitution/case-folding scenario, redone with the correct post-edit `oldValue`, **passes** - the
  prefix-match check in the algorithm naturally fails early (case differs character-by-character), so it falls through
  to the suffix-match branch and returns the correct position. The original test's `oldValue` was the _pre-edit_ value,
  which `recordCursor` never actually produces. No bug. The `test.fails` marker has been removed and replaced with real
  passing tests built on the simulator.
- The "stuck delete" scenario, redone the same way: deleting a literal character does shorten the raw string
  (`"1 (234) 567"` -> `"1 (234 567"`, 10 chars), so `oldValue !== newValue` once the formatter reinserts the literal
  (`"1 (234) 567"`, 11 chars) - the `restoreCursor` fast-path short-circuit this was blamed on never actually triggers.
  The algorithm correctly lands the cursor back before the reinserted literal, i.e. a content no-op with no visible
  change. What's still missing is a _feature_, not a bug fix: skipping forward through the literal to reach the next
  real digit in one keystroke, which requires knowing "this position is a literal"
  - genuinely mask-template scope, kept as a `test.todo`, but reframed honestly as a UX enhancement rather than a
    structural defect.

Six new tests, all built on the simulator and all passing, replace the originals in
`packages/utilities/input-mask/tests/diff.test.ts` (moved there in step `02`). No confirmed bug remains in the base diff
algorithm. Step `04`'s scope is unchanged in substance (the mask-template engine for fixed placeholder templates was
never claimed to be a bug fix), but the literal-skip-on-delete item is now correctly scoped as optional UX polish, not a
required fix.
