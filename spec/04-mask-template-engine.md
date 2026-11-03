# Step 4: fixed placeholder-template masks

## Scope

A genuinely new, small feature: a `mask` template with placeholder slots (`__-__-____`), explicit max-length derived
from slot count, and an explicit `editMode: "insert" | "overwrite"` — plus the public `createInputMask`/
`attachInputMask` entry points.

Step 1's original verdict on the base diff algorithm was re-verified with simulated native edits (see the "Correction"
section in `01-failing-tests-baseline.md`) and no confirmed bug survived - both cases originally flagged as failing
turned out to be test-construction artifacts. So there is no bug-driven cursor refinement to build here. The one
remaining item, skipping forward through a literal on delete so it doesn't take an extra keystroke to reach the next
real digit, is a deliberate UX feature this engine should still provide (it requires knowing which positions are
literal, which only the mask template has) - build it as part of the mask engine's normal design, not as a fix for a bug
that turned out not to exist.

## API

Naming: `accept` (an explicit allowlist), never a denylist-style option — see the API-naming lesson in `00-overview.md`.
Initial value is formatted eagerly inside `createInputMask`, not left to the consumer, per the DX finding recorded in
step 1.

```ts
// packages/utilities/input-mask/src/mask.ts
export interface MaskTemplate {
  slots: number[]
  literals: Map<number, string>
}
export function parseMaskTemplate(mask: string, placeholder?: string): MaskTemplate
export function applyMask(template: MaskTemplate, rawChars: string): string // truncates once slots are full — the max-length fix

// packages/utilities/input-mask/src/index.ts
export interface InputMaskOptions {
  format: (value: string) => string
  accept?: RegExp | ((char: string) => boolean)
  mask?: string
  placeholder?: string // default "_"
  editMode?: "insert" | "overwrite" // explicit, documented insert-vs-overwrite semantics
}
export function createInputMask(options: InputMaskOptions): {
  format(rawValue: string): string // called eagerly on the initial value
  recordCursor(el): Selection | undefined
  restoreCursor(el, selection): void
}
export function attachInputMask(el: HTMLInputElement, options: InputMaskOptions): () => void
```

## Test cases

Cover the following sequences against `applyMask`/`parseMaskTemplate`:

- Deleting repeatedly through a fully-populated date-like template (`"18-08-1978"`) with the cursor moved into the
  middle: each delete should make forward progress and skip over literal separators, until no digits remain to delete,
  at which point further deletes are a genuine no-op (not a stuck state).
- Typing a non-matching character (e.g. a letter into a digits-only template) is rejected outright — the value and
  cursor stay unchanged.
- Applying a template to a raw digit string one character longer than the template's slot count truncates the extra
  character rather than overwriting or shifting already-placed digits — this is the explicit max-length fix.
- `editMode: "overwrite"` replaces the character at the current slot without shifting trailing characters; the default
  `editMode: "insert"` shifts trailing characters as in a normal text field.

## Deliverable

`mask.ts`, `mask.test.ts`, and the public `createInputMask`/`attachInputMask` API with a README documenting the `insert`
vs `overwrite` distinction plainly.

## Verification

`pnpm --filter @zag-js/input-mask test typecheck lint`.
